import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { ApiError, ApiService } from './api.service';
import { Membership } from './chat.models';

const { socket, listeners } = vi.hoisted(() => {
  const listeners: Record<string, (...args: any[]) => void> = {};
  const socket = {
    on: vi.fn((event, callback) => {
      listeners[event] = callback;
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
    emit: vi.fn(),
  };
  return { socket, listeners };
});
vi.mock('socket.io-client', () => ({ io: () => socket }));

describe('Parley application', () => {
  let api: { request: ReturnType<typeof vi.fn> };
  const room: Membership = {
    room: 'a'.repeat(24),
    role: 'owner',
    user: { _id: 'b'.repeat(24), username: 'alice' },
    roomDetails: { _id: 'a'.repeat(24), type: 'group', name: 'Design studio' },
  };
  beforeEach(async () => {
    vi.clearAllMocks();
    api = { request: vi.fn().mockResolvedValue({ result: [room] }) };
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: ApiService, useValue: api }],
    }).compileComponents();
  });
  async function create() {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  it('restores the session and displays real room names', async () => {
    const fixture = await create();
    expect(fixture.componentInstance.phase()).toBe('chat');
    expect(fixture.nativeElement.textContent).toContain('Design studio');
    expect(socket.connect).toHaveBeenCalledOnce();
  });
  it('shows sign-in when there is no authenticated session', async () => {
    api.request.mockRejectedValue(new ApiError('Unauthorized', 401));
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('h2').textContent).toContain('Welcome back');
    expect(fixture.componentInstance.error()).toBe('');
  });
  it('reconciles a live message arriving while history is loading', async () => {
    const fixture = await create();
    const app = fixture.componentInstance;
    const message = {
      _id: 'message',
      room: room.room,
      sender: room.user._id,
      message: 'Hi',
      createdAt: '2026-01-01',
    };
    api.request.mockResolvedValue({ History: [message] });
    app.selectRoom(room);
    listeners['newMessage'](message);
    await fixture.whenStable();
    expect(app.activeMessages()).toEqual([message]);
  });
  it('keeps unsent text after a failed send', async () => {
    const fixture = await create();
    const app = fixture.componentInstance;
    app.selectedId.set(room.room);
    app.draft = 'Keep this message';
    api.request.mockRejectedValue(new ApiError('Unable to save', 500));
    await app.send();
    expect(app.draft).toBe('Keep this message');
    expect(app.sending()).toBe(false);
    expect(app.error()).toBe('Unable to save');
  });
  it('sends once over REST and reconciles the broadcast echo', async () => {
    const fixture = await create();
    const app = fixture.componentInstance;
    app.selectedId.set(room.room);
    app.draft = 'Hello';
    const message = {
      _id: 'message',
      room: room.room,
      sender: room.user._id,
      message: 'Hello',
      createdAt: '2026-01-01',
    };
    api.request.mockResolvedValue({ message });
    await app.send();
    listeners['newMessage'](message);
    expect(app.activeMessages()).toEqual([message]);
    expect(app.draft).toBe('');
    expect(socket.emit).not.toHaveBeenCalledWith('sendMessage', expect.anything());
  });
  it('clears private state when the server revokes a session', async () => {
    const fixture = await create();
    listeners['disconnect']('io server disconnect');
    expect(fixture.componentInstance.phase()).toBe('auth');
    expect(fixture.componentInstance.rooms()).toEqual([]);
    expect(fixture.componentInstance.messages()).toEqual({});
  });
  it('restricts group management to owner and admin roles', async () => {
    const fixture = await create();
    const app = fixture.componentInstance;
    app.selectedId.set(room.room);
    expect(app.canManage()).toBe(true);
    app.rooms.set([{ ...room, role: 'member' }]);
    expect(app.canManage()).toBe(false);
  });
  it('uses the other participant username for direct chats and the required name for groups', async () => {
    const fixture = await create();
    const app = fixture.componentInstance;
    const direct: Membership = {
      ...room,
      roomDetails: { _id: room.room, type: 'direct' },
      participants: [room.user, { _id: 'c'.repeat(24), username: 'bob' }],
    };
    app.rooms.set([direct]);
    fixture.detectChanges();
    expect(app.roomName(direct)).toBe('bob');
    expect(fixture.nativeElement.textContent).toContain('bob');
    expect(fixture.nativeElement.textContent).not.toContain('Conversation ·');
    expect(app.roomName(room)).toBe('Design studio');
    app.selectedId.set(direct.room);
    expect(app.senderName('c'.repeat(24))).toBe('bob');
  });
  it('requires a non-whitespace group name before making API calls', async () => {
    const fixture = await create();
    const app = fixture.componentInstance;
    app.openModal('create');
    app.roomType = 'group';
    app.roomTitle = '   ';
    app.memberIdentifiers = 'bob';
    api.request.mockClear();
    await app.submitModal();
    expect(app.error()).toBe('Enter a group name.');
    expect(api.request).not.toHaveBeenCalled();
  });
  it.each(['bob', 'bob@example.com', '+20 101 234 5678'])(
    'resolves %s before creating a direct chat',
    async (identifier) => {
      const fixture = await create();
      const app = fixture.componentInstance;
      const bob = { _id: 'c'.repeat(24), username: 'bob' };
      app.openModal('create');
      app.roomType = 'direct';
      app.memberIdentifiers = identifier;
      api.request
        .mockReset()
        .mockResolvedValueOnce({ users: [bob] })
        .mockResolvedValueOnce({ _id: room.room })
        .mockResolvedValueOnce({ result: [room] })
        .mockResolvedValueOnce({ History: [] });
      await app.submitModal();
      expect(api.request).toHaveBeenNthCalledWith(1, 'users/resolve', {
        identifiers: [identifier],
      });
      expect(api.request).toHaveBeenNthCalledWith(2, 'conv/creategroup', {
        type: 'direct',
        name: '',
        members: [bob._id],
      });
    },
  );
  it('does not create a conversation when a person cannot be found', async () => {
    const fixture = await create();
    const app = fixture.componentInstance;
    app.openModal('create');
    app.memberIdentifiers = 'missing';
    api.request.mockReset().mockRejectedValue(new ApiError('No user found', 404));
    await app.submitModal();
    expect(api.request).toHaveBeenCalledOnce();
    expect(app.error()).toBe('No user found');
    expect(app.modal()).toBe('create');
  });
  it('resolves comma/newline separated people for group membership changes', async () => {
    const fixture = await create();
    const app = fixture.componentInstance;
    app.selectedId.set(room.room);
    app.openModal('members');
    app.memberIdentifiers = 'bob@example.com,\n+20 101 234 5678';
    api.request
      .mockReset()
      .mockResolvedValueOnce({ users: [{ _id: 'c'.repeat(24), username: 'bob' }] })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ result: [room] });
    await app.submitModal();
    expect(api.request).toHaveBeenNthCalledWith(1, 'users/resolve', {
      identifiers: ['bob@example.com', '+20 101 234 5678'],
    });
    expect(api.request).toHaveBeenNthCalledWith(2, 'conv/addmembers', {
      roomId: room.room,
      newmembers: ['c'.repeat(24)],
    });
  });
  it('includes the primary phone number in signup', async () => {
    const fixture = await create();
    const app = fixture.componentInstance;
    app.registering.set(true);
    app.authUsername = 'alice';
    app.email = 'alice@example.com';
    app.password = 'secret';
    app.phoneNumber = '+12025550123';
    api.request.mockClear();
    await app.authenticate();
    expect(api.request).toHaveBeenCalledWith('auth/register', {
      username: 'alice',
      email: 'alice@example.com',
      password: 'secret',
      phoneNumber: '+12025550123',
    });
  });
});
