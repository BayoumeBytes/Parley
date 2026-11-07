import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Account } from '../../../core/models/account.models';
import { ApiError } from '../../../core/services/api.service';
import { SessionService } from '../../../core/services/session.service';
import {
  ConversationCommand,
  MAX_MESSAGE_LENGTH,
  Membership,
  Message,
} from '../models/chat.models';
import { ChatApiService } from '../services/chat-api.service';
import { mergeMessages } from '../utils/messages';

/** Scoped to the chat page: leaving chat disposes all sockets and private state. */
@Injectable()
export class ChatStore {
  private readonly api = inject(ChatApiService);
  private readonly session = inject(SessionService);
  private readonly roomsState = signal<Membership[]>([]);
  private readonly selectedState = signal('');
  private readonly messagesState = signal<Record<string, Message[]>>({});
  private readonly unreadState = signal<Record<string, number>>({});
  private readonly typingState = signal<Record<string, string[]>>({});
  private readonly connectedState = signal(false);
  private readonly loadingState = signal(false);
  private readonly sendingState = signal(false);
  private readonly mutatingState = signal(false);
  readonly rooms = this.roomsState.asReadonly();
  readonly selectedId = this.selectedState.asReadonly();
  readonly messages = this.messagesState.asReadonly();
  readonly unread = this.unreadState.asReadonly();
  readonly typingUsers = this.typingState.asReadonly();
  readonly connected = this.connectedState.asReadonly();
  readonly loadingHistory = this.loadingState.asReadonly();
  readonly sending = this.sendingState.asReadonly();
  readonly mutating = this.mutatingState.asReadonly();
  readonly error = signal('');
  readonly notice = signal('');
  readonly selected = computed(() => this.rooms().find((room) => room.room === this.selectedId()));
  readonly activeMessages = computed(() => this.messages()[this.selectedId()] ?? []);
  readonly canManage = computed(
    () =>
      this.selected()?.roomDetails?.type === 'group' &&
      ['owner', 'admin'].includes(this.selected()?.role ?? ''),
  );
  readonly previews = computed(() =>
    Object.fromEntries(
      this.rooms().map((room) => {
        const saved = room.lastMessage,
          cached = this.messages()[room.room]?.at(-1);
        const latest =
          saved && cached ? mergeMessages([saved], [cached]).at(-1) : (saved ?? cached);
        return [room.room, latest?.message || 'Open the conversation'];
      }),
    ),
  );
  private socket?: Socket;
  private disposed = false;
  private roomRequest = 0;
  private historyRequest = 0;
  private readonly loadedRooms = new Set<string>();
  private readonly readThrough = new Map<string, string>();
  private readonly typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private typingStop?: ReturnType<typeof setTimeout>;
  private readonly visibilityChanged = () => this.markVisibleRoomRead();
  private initialization?: Promise<void>;

  constructor() {
    document.addEventListener('visibilitychange', this.visibilityChanged);
    inject(DestroyRef).onDestroy(() => {
      this.disposed = true;
      this.stopTyping();
      this.clearTyping();
      this.socket?.removeAllListeners();
      this.socket?.disconnect();
      document.removeEventListener('visibilitychange', this.visibilityChanged);
    });
  }
  initialize(): Promise<void> {
    return (this.initialization ??= this.start());
  }
  private current(version: number): boolean {
    return !this.disposed && version === this.session.revision() && this.session.phase() === 'chat';
  }
  private async start(): Promise<void> {
    const version = this.session.revision();
    try {
      await this.refreshRooms();
      if (this.current(version)) this.connect();
    } catch (error) {
      if (this.current(version)) this.report(error);
    }
  }
  async refreshRooms(): Promise<void> {
    const version = this.session.revision(),
      request = ++this.roomRequest;
    const rooms = await this.api.rooms();
    if (!this.current(version) || request !== this.roomRequest) return;
    this.roomsState.set(rooms);
    this.unreadState.set(
      Object.fromEntries(rooms.map((room) => [room.room, room.unreadCount ?? 0])),
    );
    if (this.selectedId() && !rooms.some((room) => room.room === this.selectedId()))
      this.closeRoom();
  }
  private refresh(): void {
    const version = this.session.revision();
    void this.refreshRooms().catch((error) => {
      if (this.current(version)) this.report(error);
    });
  }
  private connect(): void {
    const version = this.session.revision();
    const socket = io({ withCredentials: true, autoConnect: false });
    this.socket = socket;
    socket.on('ready', ({ user }: { user: Account }) => {
      if (!this.current(version) || (user && !this.session.updateFromSocket(user))) return;
      this.connectedState.set(true);
      this.loadedRooms.clear();
      void this.refreshRooms()
        .then(() => {
          if (this.current(version) && this.selectedId()) void this.loadHistory(this.selectedId());
        })
        .catch((error) => {
          if (this.current(version)) this.report(error);
        });
    });
    socket.on('disconnect', (reason) => {
      if (!this.current(version)) return;
      this.connectedState.set(false);
      this.clearTyping();
      if (reason === 'io server disconnect' && !this.session.loggingOut()) {
        this.session.expire('Your session ended. Please sign in again.');
      }
    });
    socket.on('connect_error', (error) => {
      if (!this.current(version)) return;
      this.connectedState.set(false);
      const data = (error as Error & { data?: { code?: string; user?: Account } }).data;
      if (data?.code === 'PHONE_REQUIRED' && data.user) this.session.requirePhone(data.user);
      else if (error.message === 'Unauthorized')
        this.session.expire('Your session expired. Please sign in again.');
    });
    socket.on('newMessage', (message: Message) => {
      if (!this.current(version)) return;
      this.upsert(message.room, [message]);
      this.markVisibleRoomRead();
      this.refresh();
    });
    socket.on(
      'typing',
      ({ room, userId, isTyping }: { room: string; userId: string; isTyping: boolean }) => {
        if (!this.current(version)) return;
        const key = `${room}:${userId}`;
        clearTimeout(this.typingTimers.get(key));
        this.setTyping(room, userId, isTyping);
        if (isTyping)
          this.typingTimers.set(
            key,
            setTimeout(() => {
              this.setTyping(room, userId, false);
              this.typingTimers.delete(key);
            }, 4000),
          );
      },
    );
    for (const event of ['roomAdded', 'membersAdded', 'membersRemoved', 'roomRead']) {
      socket.on(event, () => {
        if (this.current(version)) this.refresh();
      });
    }
    socket.on('roomRemoved', ({ room }: { room: string }) => {
      if (!this.current(version)) return;
      this.loadedRooms.delete(room);
      this.readThrough.delete(room);
      this.roomsState.update((rooms) => rooms.filter((entry) => entry.room !== room));
      this.messagesState.update((messages) => {
        const next = { ...messages };
        delete next[room];
        return next;
      });
      this.unreadState.update((counts) => {
        const next = { ...counts };
        delete next[room];
        return next;
      });
      if (this.selectedId() === room) this.closeRoom();
      this.notice.set('Your access to a conversation was removed.');
    });
    socket.on('chatError', (error: { error: string; status: number }) => {
      if (this.current(version)) this.report(new ApiError(error.error, error.status));
    });
    socket.connect();
  }
  selectRoom(room: Membership): void {
    this.stopTyping();
    this.error.set('');
    this.selectedState.set(room.room);
    this.loadedRooms.delete(room.room);
    void this.loadHistory(room.room);
  }
  closeRoom(): void {
    this.stopTyping();
    this.selectedState.set('');
  }

  async loadHistory(room: string): Promise<void> {
    const version = this.session.revision(),
      request = ++this.historyRequest;
    this.loadingState.set(true);
    try {
      const history = await this.api.history(room);
      if (this.current(version) && this.rooms().some((entry) => entry.room === room)) {
        this.upsert(room, history);
        this.loadedRooms.add(room);
        this.markVisibleRoomRead();
      }
    } catch (error) {
      if (this.current(version)) this.report(error);
    } finally {
      if (request === this.historyRequest) this.loadingState.set(false);
    }
  }
  private upsert(room: string, incoming: Message[]): void {
    this.messagesState.update((all) => ({
      ...all,
      [room]: mergeMessages(all[room] ?? [], incoming),
    }));
  }
  markVisibleRoomRead(): void {
    const room = this.selectedId();
    if (document.visibilityState !== 'visible' || !this.loadedRooms.has(room)) return;
    const latest = this.messages()[room]?.at(-1);
    if (!latest || this.readThrough.get(room) === latest._id) return;
    const version = this.session.revision();
    this.readThrough.set(room, latest._id);
    void this.api
      .markRead(room, latest._id)
      .then(async () => {
        if (this.current(version)) await this.refreshRooms();
      })
      .catch((error) => {
        if (!this.current(version)) return;
        if (this.readThrough.get(room) === latest._id) this.readThrough.delete(room);
        this.report(error);
      });
  }
  async send(text: string): Promise<boolean> {
    const room = this.selectedId(),
      message = text.trim();
    if (!room || !message || this.sending() || message.length > MAX_MESSAGE_LENGTH) return false;
    this.sendingState.set(true);
    this.error.set('');
    this.stopTyping();
    const version = this.session.revision();
    try {
      const saved = await this.api.send(room, message);
      if (!this.current(version)) return false;
      this.upsert(room, [saved]);
      return true;
    } catch (error) {
      if (this.current(version)) {
        this.report(error);
        if (error instanceof ApiError && error.status === 0) {
          this.error.set(
            'Delivery is uncertain. Refresh history before sending again to avoid a duplicate.',
          );
        }
      }
      return false;
    } finally {
      this.sendingState.set(false);
    }
  }
  typing(active: boolean): void {
    if (this.connected())
      this.socket?.emit('typing', { room: this.selectedId(), isTyping: active });
    clearTimeout(this.typingStop);
    this.typingStop = setTimeout(() => this.stopTyping(), 1500);
  }
  stopTyping(): void {
    clearTimeout(this.typingStop);
    if (this.connected() && this.selectedId())
      this.socket?.emit('typing', { room: this.selectedId(), isTyping: false });
  }
  private setTyping(room: string, user: string, active: boolean): void {
    this.typingState.update((all) => ({
      ...all,
      [room]: [
        ...new Set([...(all[room] ?? []).filter((id) => id !== user), ...(active ? [user] : [])]),
      ],
    }));
  }
  async applyConversation(command: ConversationCommand): Promise<boolean> {
    if (this.mutating()) return false;
    const roomId = this.selectedId(),
      version = this.session.revision();
    this.mutatingState.set(true);
    this.error.set('');
    try {
      const people = await this.api.resolve(command.identifiers);
      if (!this.current(version)) return false;
      const members = people.map((person) => person._id);
      if (command.kind === 'create') {
        if (
          command.type === 'direct' &&
          members.filter((id) => id !== this.session.userId()).length !== 1
        ) {
          throw new Error('A direct conversation needs exactly one other user.');
        }
        const room = await this.api.create(command.type, command.name, members);
        if (!this.current(version)) return false;
        await this.refreshRooms();
        if (!this.current(version)) return false;
        const membership = this.rooms().find((entry) => entry.room === room._id);
        if (membership) this.selectRoom(membership);
        this.notice.set('Conversation ready. Say hello.');
      } else {
        if (!roomId) throw new Error('Choose a conversation first.');
        await this.api.changeMembers(roomId, command.action, members);
        if (!this.current(version)) return false;
        await this.refreshRooms();
        if (!this.current(version)) return false;
        this.notice.set(command.action === 'add' ? 'Members added.' : 'Members removed.');
      }
      return this.current(version);
    } catch (error) {
      if (this.current(version)) this.report(error);
      return false;
    } finally {
      this.mutatingState.set(false);
    }
  }
  private report(error: unknown): void {
    if (this.session.handleSessionError(error)) return;
    this.error.set(
      error instanceof Error ? error.message : 'Something went wrong. Please try again.',
    );
  }
  private clearTyping(): void {
    this.typingTimers.forEach((timer) => clearTimeout(timer));
    this.typingTimers.clear();
    this.typingState.set({});
  }
}
