import { TestBed } from '@angular/core/testing';
import { account, deferred, message, peer, room } from '../../../../testing/fixtures';
import { ApiError } from '../../../core/services/api.service';
import { SessionService } from '../../../core/services/session.service';
import { ChatApiService } from '../services/chat-api.service';
import { ChatStore } from './chat.store';
import { Membership, Message } from '../models/chat.models';

const { socket, listeners } = vi.hoisted(() => ({
  socket: {
    on: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
  },
  listeners: {} as Record<string, (...args: any[]) => void>,
}));
vi.mock('socket.io-client', () => ({ io: () => socket }));

describe('ChatStore', () => {
  let api: {
    rooms: ReturnType<typeof vi.fn>;
    history: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    markRead: ReturnType<typeof vi.fn>;
    resolve: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    changeMembers: ReturnType<typeof vi.fn>;
  };
  let session: {
    revision: ReturnType<typeof vi.fn>;
    phase: ReturnType<typeof vi.fn>;
    userId: () => string;
    loggingOut: () => boolean;
    updateFromSocket: ReturnType<typeof vi.fn>;
    expire: ReturnType<typeof vi.fn>;
    requirePhone: ReturnType<typeof vi.fn>;
    handleSessionError: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(listeners)) delete listeners[key];
    socket.on.mockImplementation((event, callback) => {
      listeners[event] = callback;
    });
    api = {
      rooms: vi.fn().mockResolvedValue([room]),
      history: vi.fn().mockResolvedValue([]),
      send: vi.fn().mockResolvedValue(message),
      markRead: vi.fn().mockResolvedValue({}),
      resolve: vi.fn().mockResolvedValue([peer]),
      create: vi.fn().mockResolvedValue(room.roomDetails),
      changeMembers: vi.fn().mockResolvedValue({}),
    };
    session = {
      revision: vi.fn(() => 1),
      phase: vi.fn(() => 'chat'),
      userId: () => account._id,
      loggingOut: () => false,
      updateFromSocket: vi.fn(() => true),
      expire: vi.fn(),
      requirePhone: vi.fn(),
      handleSessionError: vi.fn(() => false),
    };
    TestBed.configureTestingModule({
      providers: [
        ChatStore,
        { provide: ChatApiService, useValue: api },
        { provide: SessionService, useValue: session },
      ],
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });
  async function create() {
    const store = TestBed.inject(ChatStore);
    await store.initialize();
    return store;
  }
  async function flush() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('restores unread counts and previews without fetching every history', async () => {
    api.rooms.mockResolvedValue([{ ...room, unreadCount: 3, lastMessage: message }]);
    const store = await create();
    expect(store.unread()[room.room]).toBe(3);
    expect(store.previews()[room.room]).toBe('Hello');
    expect(api.history).not.toHaveBeenCalled();
    expect(socket.connect).toHaveBeenCalledOnce();
  });
  it('reconciles live arrivals with newest-first history by persisted ID', async () => {
    const store = await create();
    const history = deferred<Message[]>();
    api.history.mockReturnValue(history.promise);
    store.selectRoom(room);
    listeners['newMessage'](message);
    history.resolve([message]);
    await flush();
    expect(store.activeMessages()).toEqual([message]);
  });
  it('sends once over REST, guards duplicate submissions, and reconciles echoes', async () => {
    const store = await create();
    store.selectRoom(room);
    await flush();
    const sending = deferred<Message>();
    api.send.mockReturnValue(sending.promise);
    const first = store.send('Hello');
    expect(await store.send('Hello')).toBe(false);
    sending.resolve(message);
    expect(await first).toBe(true);
    listeners['newMessage'](message);
    await flush();
    expect(store.activeMessages()).toEqual([message]);
    expect(api.send).toHaveBeenCalledOnce();
    expect(socket.emit).not.toHaveBeenCalledWith('sendMessage', expect.anything());
  });
  it('reports failed sends without claiming success', async () => {
    const store = await create();
    store.selectRoom(room);
    await flush();
    api.send.mockRejectedValue(new ApiError('Unable to save', 500));
    expect(await store.send('Keep this')).toBe(false);
    expect(store.error()).toBe('Unable to save');
    expect(store.sending()).toBe(false);
  });
  it('leaves badges intact after failed history or failed read persistence', async () => {
    api.rooms.mockResolvedValue([{ ...room, unreadCount: 3 }]);
    const store = await create();
    api.history.mockRejectedValueOnce(new ApiError('History unavailable', 500));
    store.selectRoom(room);
    await flush();
    expect(store.unread()[room.room]).toBe(3);
    expect(api.markRead).not.toHaveBeenCalled();
    api.history.mockResolvedValue([message]);
    api.markRead.mockRejectedValue(new ApiError('Unable to save read progress', 500));
    await store.loadHistory(room.room);
    await flush();
    expect(store.unread()[room.room]).toBe(3);
    expect(store.error()).toBe('Unable to save read progress');
  });
  it('marks only loaded visible messages read, then refreshes authoritative totals', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    api.rooms.mockResolvedValue([{ ...room, unreadCount: 3 }]);
    api.history.mockResolvedValue([message]);
    const store = await create();
    store.selectRoom(room);
    await flush();
    expect(api.markRead).not.toHaveBeenCalled();
    visibility.mockReturnValue('visible');
    api.rooms.mockResolvedValue([{ ...room, unreadCount: 0 }]);
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(api.markRead).toHaveBeenCalledWith(room.room, message._id);
    expect(store.unread()[room.room]).toBe(0);
  });
  it('refreshes other-tab read events without double-counting live echoes', async () => {
    const store = await create();
    api.rooms.mockResolvedValue([{ ...room, unreadCount: 4, lastMessage: message }]);
    listeners['newMessage'](message);
    listeners['newMessage'](message);
    await flush();
    expect(store.unread()[room.room]).toBe(4);
    api.rooms.mockResolvedValue([{ ...room, unreadCount: 0 }]);
    listeners['roomRead']({ room: room.room });
    await flush();
    expect(store.unread()[room.room]).toBe(0);
  });
  it('ignores out-of-order summary responses', async () => {
    const store = await create();
    const old = deferred<Membership[]>(),
      recent = deferred<Membership[]>();
    api.rooms.mockReturnValueOnce(old.promise).mockReturnValueOnce(recent.promise);
    const first = store.refreshRooms(),
      second = store.refreshRooms();
    recent.resolve([{ ...room, unreadCount: 4 }]);
    await second;
    old.resolve([{ ...room, unreadCount: 3 }]);
    await first;
    expect(store.unread()[room.room]).toBe(4);
  });
  it('only enables member management for owners and admins of groups', async () => {
    const store = await create();
    store.selectRoom(room);
    expect(store.canManage()).toBe(true);
    api.rooms.mockResolvedValue([{ ...room, role: 'member' }]);
    await store.refreshRooms();
    expect(store.canManage()).toBe(false);
  });
  it.each(['bob', 'bob@example.com', '+20 101 234 5678'])(
    'resolves %s before creating a conversation',
    async (identifier) => {
      const store = await create();
      expect(
        await store.applyConversation({
          kind: 'create',
          type: 'direct',
          name: '',
          identifiers: [identifier],
        }),
      ).toBe(true);
      expect(api.resolve).toHaveBeenCalledWith([identifier]);
      expect(api.create).toHaveBeenCalledWith('direct', '', [peer._id]);
      expect(store.selectedId()).toBe(room.room);
    },
  );
  it('does not create a room when lookup fails or direct-chat membership is invalid', async () => {
    const store = await create();
    api.resolve.mockRejectedValueOnce(new ApiError('No user found', 404));
    expect(
      await store.applyConversation({
        kind: 'create',
        type: 'direct',
        name: '',
        identifiers: ['missing'],
      }),
    ).toBe(false);
    api.resolve.mockResolvedValueOnce([account]);
    expect(
      await store.applyConversation({
        kind: 'create',
        type: 'direct',
        name: '',
        identifiers: ['alice'],
      }),
    ).toBe(false);
    expect(api.create).not.toHaveBeenCalled();
  });
  it('changes group members using resolved account IDs', async () => {
    const store = await create();
    store.selectRoom(room);
    expect(
      await store.applyConversation({ kind: 'members', action: 'add', identifiers: ['bob'] }),
    ).toBe(true);
    expect(api.changeMembers).toHaveBeenCalledWith(room.room, 'add', [peer._id]);
  });
  it('routes session revocation and phone-gate failures to the session owner', async () => {
    await create();
    listeners['disconnect']('io server disconnect');
    expect(session.expire).toHaveBeenCalled();
    const legacy = { ...account, requiresPhone: true, phoneNumber: null };
    listeners['connect_error'](
      Object.assign(new Error('Phone needed'), { data: { code: 'PHONE_REQUIRED', user: legacy } }),
    );
    expect(session.requirePhone).toHaveBeenCalledWith(legacy);
  });
  it('removes inaccessible conversations and their local messages', async () => {
    const store = await create();
    store.selectRoom(room);
    listeners['newMessage'](message);
    await flush();
    listeners['roomRemoved']({ room: room.room });
    expect(store.selectedId()).toBe('');
    expect(store.rooms()).toEqual([]);
    expect(store.messages()[room.room]).toBeUndefined();
  });
  it('cleans up transport and rejects late writes after page destruction', async () => {
    const store = await create();
    const history = deferred<Message[]>();
    api.history.mockReturnValue(history.promise);
    store.selectRoom(room);
    TestBed.resetTestingModule();
    history.resolve([message]);
    await flush();
    expect(store.activeMessages()).toEqual([]);
    expect(socket.removeAllListeners).toHaveBeenCalledOnce();
    expect(socket.disconnect).toHaveBeenCalledOnce();
    expect(api.markRead).not.toHaveBeenCalled();
  });
});
