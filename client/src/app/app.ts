import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { io, Socket } from 'socket.io-client';
import { ApiError, ApiService } from './api.service';
import { Membership, Message, mergeMessages, Room } from './chat.models';

@Component({
  imports: [FormsModule, DatePipe],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnDestroy {
  private readonly api = inject(ApiService);
  private socket?: Socket;
  private typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private typingStop?: ReturnType<typeof setTimeout>;
  private readonly feed = viewChild<ElementRef<HTMLElement>>('feed');
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private previousFocus?: HTMLElement;
  readonly phase = signal<'loading' | 'auth' | 'chat'>('loading');
  readonly registering = signal(false);
  readonly busy = signal(false);
  readonly sending = signal(false);
  readonly loadingHistory = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly connected = signal(false);
  readonly userId = signal('');
  readonly username = signal('You');
  readonly rooms = signal<Membership[]>([]);
  readonly selectedId = signal('');
  readonly messages = signal<Record<string, Message[]>>({});
  readonly unread = signal<Record<string, number>>({});
  readonly typingUsers = signal<Record<string, string[]>>({});
  readonly details = signal(false);
  readonly modal = signal<'create' | 'members' | null>(null);
  readonly selected = computed(() => this.rooms().find((room) => room.room === this.selectedId()));
  readonly activeMessages = computed(() => this.messages()[this.selectedId()] ?? []);
  readonly canManage = computed(
    () =>
      this.selected()?.roomDetails?.type === 'group' &&
      ['owner', 'admin'].includes(this.selected()?.role ?? ''),
  );
  readonly search = signal('');
  readonly filteredRooms = computed(() =>
    this.rooms().filter((room) =>
      this.roomName(room).toLowerCase().includes(this.search().toLowerCase()),
    ),
  );
  authUsername = '';
  password = '';
  email = '';
  phoneNumber = '';
  draft = '';
  roomType: 'direct' | 'group' = 'direct';
  roomTitle = '';
  memberIdentifiers = '';
  memberAction: 'add' | 'remove' = 'add';
  private historyRequest = 0;
  private sessionVersion = 0;

  constructor() {
    effect(() => {
      if (this.modal()) {
        const dialog = this.dialog()?.nativeElement;
        dialog?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
      } else {
        this.previousFocus?.focus();
      }
    });
    effect(() => {
      this.activeMessages();
      const element = this.feed()?.nativeElement;
      if (element) requestAnimationFrame(() => (element.scrollTop = element.scrollHeight));
    });
    void this.restore();
  }

  private async restore() {
    try {
      await this.refreshRooms();
      this.phase.set('chat');
      this.connect();
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) this.report(error);
      this.phase.set('auth');
    }
  }

  async authenticate() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.registering()) {
        await this.api.request('auth/register', {
          username: this.authUsername.trim(),
          password: this.password,
          email: this.email.trim(),
          phoneNumber: this.phoneNumber.trim(),
        });
      }
      await this.api.request('auth/login', {
        username: this.authUsername.trim(),
        password: this.password,
      });
      this.username.set(this.authUsername.trim());
      this.password = '';
      await this.refreshRooms();
      this.phase.set('chat');
      this.connect();
    } catch (error) {
      this.report(error);
    } finally {
      this.busy.set(false);
    }
  }

  async refreshRooms() {
    const version = this.sessionVersion;
    const { result } = await this.api.request<{ result: Membership[] | string }>(
      'conv/getuserrooms',
      {},
    );
    if (version !== this.sessionVersion) return;
    const rooms = Array.isArray(result) ? result : [];
    this.rooms.set(rooms);
    if (rooms[0]?.user) {
      this.userId.set(rooms[0].user._id);
      this.username.set(rooms[0].user.username);
    }
    if (this.selectedId() && !rooms.some((room) => room.room === this.selectedId())) {
      this.stopTyping();
      this.selectedId.set('');
      this.draft = '';
    }
  }

  private connect() {
    this.socket?.disconnect();
    const socket = io({ withCredentials: true, autoConnect: false });
    this.socket = socket;
    socket.on('ready', ({ userId }: { userId: string }) => {
      this.userId.set(userId);
      this.connected.set(true);
      void this.refreshRooms()
        .then(() => {
          if (this.selectedId()) void this.loadHistory(this.selectedId());
        })
        .catch((error) => this.report(error));
    });
    socket.on('disconnect', (reason) => {
      this.connected.set(false);
      this.clearTyping();
      if (reason === 'io server disconnect') {
        this.reset();
        this.error.set('Your session ended. Please sign in again.');
      }
    });
    socket.on('connect_error', (error) => {
      this.connected.set(false);
      if (error.message === 'Unauthorized') {
        this.reset();
        this.error.set('Your session expired. Please sign in again.');
      }
    });
    socket.on('newMessage', (message: Message) => {
      const exists = this.messages()[message.room]?.some((item) => item._id === message._id);
      this.upsert(message.room, [message]);
      if (!exists && message.room !== this.selectedId() && message.sender !== this.userId()) {
        this.unread.update((counts) => ({
          ...counts,
          [message.room]: (counts[message.room] ?? 0) + 1,
        }));
      }
    });
    socket.on(
      'typing',
      ({ room, userId, isTyping }: { room: string; userId: string; isTyping: boolean }) => {
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
    for (const event of ['roomAdded', 'membersAdded', 'membersRemoved']) {
      socket.on(event, () => {
        void this.refreshRooms().catch((error) => this.report(error));
      });
    }
    socket.on('roomRemoved', ({ room }: { room: string }) => {
      this.rooms.update((rooms) => rooms.filter((entry) => entry.room !== room));
      this.messages.update((messages) => {
        const next = { ...messages };
        delete next[room];
        return next;
      });
      if (this.selectedId() === room) {
        this.selectedId.set('');
        this.draft = '';
        this.modal.set(null);
      }
      this.notice.set('Your access to a conversation was removed.');
    });
    socket.on('chatError', (error: { error: string; status: number }) =>
      this.report(new ApiError(error.error, error.status)),
    );
    socket.connect();
  }

  selectRoom(room: Membership) {
    this.stopTyping();
    this.draft = '';
    this.error.set('');
    this.selectedId.set(room.room);
    this.details.set(false);
    this.unread.update((counts) => ({ ...counts, [room.room]: 0 }));
    void this.loadHistory(room.room);
  }

  async loadHistory(room: string) {
    const request = ++this.historyRequest;
    const version = this.sessionVersion;
    this.loadingHistory.set(true);
    try {
      const { History } = await this.api.request<{ History: Message[] }>(
        `msg/getroomhistory?room=${encodeURIComponent(room)}`,
      );
      if (version === this.sessionVersion && this.rooms().some((entry) => entry.room === room)) {
        this.upsert(room, History);
      }
    } catch (error) {
      if (version === this.sessionVersion) this.report(error);
    } finally {
      if (request === this.historyRequest) this.loadingHistory.set(false);
    }
  }

  private upsert(room: string, incoming: Message[]) {
    this.messages.update((messages) => ({
      ...messages,
      [room]: mergeMessages(messages[room] ?? [], incoming),
    }));
  }

  async send() {
    const room = this.selectedId();
    const message = this.draft.trim();
    if (!room || !message || this.sending() || message.length > 10000) return;
    this.sending.set(true);
    this.error.set('');
    this.stopTyping();
    const version = this.sessionVersion;
    try {
      // One transport per action: REST persists and broadcasts to all room sockets.
      const result = await this.api.request<{ message: Message }>('msg/sendmsg', { room, message });
      if (version !== this.sessionVersion) return;
      this.upsert(room, [result.message]);
      if (this.selectedId() === room && this.draft.trim() === message) this.draft = '';
    } catch (error) {
      if (version !== this.sessionVersion) return;
      this.report(error);
      if (error instanceof ApiError && error.status === 0) {
        this.error.set(
          'Delivery is uncertain. Refresh history before sending again to avoid a duplicate.',
        );
      }
    } finally {
      this.sending.set(false);
    }
  }

  composerKey(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void this.send();
    }
  }
  typing() {
    if (this.connected())
      this.socket?.emit('typing', { room: this.selectedId(), isTyping: !!this.draft.trim() });
    clearTimeout(this.typingStop);
    this.typingStop = setTimeout(() => this.stopTyping(), 1500);
  }
  stopTyping() {
    clearTimeout(this.typingStop);
    if (this.connected() && this.selectedId())
      this.socket?.emit('typing', { room: this.selectedId(), isTyping: false });
  }
  private setTyping(room: string, user: string, active: boolean) {
    this.typingUsers.update((all) => ({
      ...all,
      [room]: [
        ...new Set([...(all[room] ?? []).filter((id) => id !== user), ...(active ? [user] : [])]),
      ],
    }));
  }
  openModal(kind: 'create' | 'members') {
    this.previousFocus = document.activeElement as HTMLElement;
    this.memberIdentifiers = '';
    this.roomTitle = '';
    this.error.set('');
    this.modal.set(kind);
  }
  dialogKey(event: KeyboardEvent) {
    if (event.key === 'Escape' && !this.busy()) this.modal.set(null);
    if (event.key !== 'Tab') return;
    const controls = this.dialog()?.nativeElement.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input, textarea, select',
    );
    if (!controls?.length) return;
    const first = controls[0],
      last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  async submitModal() {
    if (this.busy()) return;
    // Do not split on spaces: formatted international phone numbers may contain them.
    const identifiers = this.memberIdentifiers
      .split(/[,\n]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (!identifiers.length) {
      this.error.set('Enter a username, email or primary phone number.');
      return;
    }
    if (this.modal() === 'create' && this.roomType === 'group' && !this.roomTitle.trim()) {
      this.error.set('Enter a group name.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const { users } = await this.api.request<{ users: { _id: string; username: string }[] }>(
        'users/resolve',
        { identifiers },
      );
      const members = users.map((user) => user._id);
      if (
        this.modal() === 'create' &&
        this.roomType === 'direct' &&
        members.filter((id) => id !== this.userId()).length !== 1
      ) {
        throw new Error('A direct conversation needs exactly one other user.');
      }
      if (this.modal() === 'create') {
        const result = await this.api.request<Room | { room: Room }>('conv/creategroup', {
          type: this.roomType,
          name: this.roomTitle.trim(),
          members,
        });
        const room = 'room' in result ? result.room : result;
        await this.refreshRooms();
        const membership = this.rooms().find((entry) => entry.room === room._id);
        if (membership) this.selectRoom(membership);
        this.notice.set('Conversation ready. Say hello.');
      } else {
        await this.api.request(
          `conv/${this.memberAction === 'add' ? 'addmembers' : 'removemembers'}`,
          {
            roomId: this.selectedId(),
            [this.memberAction === 'add' ? 'newmembers' : 'members']: members,
          },
        );
        await this.refreshRooms();
        this.notice.set(this.memberAction === 'add' ? 'Members added.' : 'Members removed.');
      }
      this.modal.set(null);
    } catch (error) {
      this.report(error);
    } finally {
      this.busy.set(false);
    }
  }
  async logout() {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.api.request('auth/logout', {});
      this.reset();
    } catch (error) {
      this.report(error);
    } finally {
      this.busy.set(false);
    }
  }
  private reset() {
    this.sessionVersion++;
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.stopTyping();
    this.clearTyping();
    this.connected.set(false);
    this.rooms.set([]);
    this.messages.set({});
    this.unread.set({});
    this.selectedId.set('');
    this.userId.set('');
    this.draft = '';
    this.modal.set(null);
    this.notice.set('');
    this.phase.set('auth');
  }
  private report(error: unknown) {
    if (error instanceof ApiError && error.status === 401 && this.phase() === 'chat') this.reset();
    this.error.set(
      error instanceof Error ? error.message : 'Something went wrong. Please try again.',
    );
  }
  roomName(room: Membership): string {
    if (room.roomDetails?.type === 'group') return room.roomDetails.name || 'Unnamed group';
    return (
      room.participants?.find((user) => user._id !== (this.userId() || room.user._id))?.username ||
      'Deleted user'
    );
  }
  initials(name: string) {
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  preview(room: string) {
    return this.messages()[room]?.at(-1)?.message || 'Open the conversation';
  }
  senderName(sender: string) {
    if (sender === this.userId()) return 'You';
    return (
      this.selected()?.participants?.find((user) => user._id === sender)?.username ||
      'Former member'
    );
  }
  private clearTyping() {
    this.typingTimers.forEach((timer) => clearTimeout(timer));
    this.typingTimers.clear();
    this.typingUsers.set({});
  }
  ngOnDestroy() {
    this.stopTyping();
    this.clearTyping();
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
  }
}
