import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { account, deferred, message, room } from '../testing/fixtures';
import { App } from './app';
import { ApiError, ApiService } from './core/services/api.service';
import { SessionService } from './core/services/session.service';
import { ChatPage } from './pages/chat/chat.page';

const { socket } = vi.hoisted(() => ({
  socket: {
    on: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));
vi.mock('socket.io-client', () => ({ io: () => socket }));

describe('application screen composition', () => {
  let api: { request: ReturnType<typeof vi.fn> };
  beforeEach(async () => {
    vi.clearAllMocks();
    api = {
      request: vi.fn(async (path: string) => {
        if (path === 'auth/me' || path === 'auth/login' || path === 'auth/phone')
          return { user: account };
        if (path === 'conv/getuserrooms')
          return { result: [{ ...room, unreadCount: 3, lastMessage: message }] };
        if (path.startsWith('msg/getroomhistory')) return { History: [message] };
        return {};
      }),
    };
    await TestBed.configureTestingModule({
      deferBlockBehavior: DeferBlockBehavior.Playthrough,
      imports: [App],
      providers: [{ provide: ApiService, useValue: api }],
    }).compileComponents();
  });
  async function create() {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.componentInstance.session.restore();
    fixture.detectChanges();
    const chat = fixture.debugElement.query(By.directive(ChatPage))?.componentInstance as
      ChatPage | undefined;
    if (chat) await chat.chat.initialize();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  it('composes the chat page and restores offline previews and unread badges', async () => {
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('app-chat-page')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.room-title').textContent.trim()).toBe(
      'Design studio',
    );
    expect(fixture.nativeElement.querySelector('.room-preview').textContent.trim()).toBe('Hello');
    expect(fixture.nativeElement.querySelector('.unread').textContent.trim()).toBe('3');
    expect(socket.connect).toHaveBeenCalledOnce();
  });
  it('shows sign-in for an absent session', async () => {
    api.request.mockRejectedValue(new ApiError('Unauthorized', 401));
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('app-auth-page')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('h2').textContent).toContain('Sign in to Parley');
  });
  it('blocks the workspace at phone setup, including after page restoration', async () => {
    api.request.mockResolvedValue({ user: { ...account, phoneNumber: null, requiresPhone: true } });
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('#required-phone').required).toBe(true);
    expect(fixture.nativeElement.querySelector('.workspace')).toBeNull();
    expect(api.request).toHaveBeenCalledExactlyOnceWith('auth/me');
    expect(socket.connect).not.toHaveBeenCalled();
  });
  it('keeps the phone screen when a protected chat API reports missing setup', async () => {
    api.request
      .mockResolvedValueOnce({ user: account })
      .mockRejectedValueOnce(new ApiError('Phone needed', 403, 'PHONE_REQUIRED'));
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('app-phone-setup-page')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.workspace')).toBeNull();
  });
  it.each([false, true])(
    'preserves Enter focus and retains only failed drafts (failure: %s)',
    async (fails) => {
      const fixture = await create();
      fixture.nativeElement.querySelector('.room-item').click();
      await fixture.whenStable();
      const input = fixture.nativeElement.querySelector('#message') as HTMLTextAreaElement;
      input.value = 'Hello again';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await fixture.whenStable();
      input.focus();
      const pending = deferred<unknown>();
      const fallback = api.request.getMockImplementation() as (
        path: string,
        body?: unknown,
      ) => Promise<unknown>;
      api.request.mockImplementation((path: string, body?: unknown) =>
        path === 'msg/sendmsg' ? pending.promise : fallback(path, body),
      );
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      fixture.detectChanges();
      expect(input.disabled).toBe(false);
      expect(input.readOnly).toBe(true);
      expect(document.activeElement).toBe(input);
      if (fails) pending.reject(new ApiError('Unable to save', 500));
      else
        pending.resolve({
          message: { ...message, _id: 'own', sender: account._id, message: 'Hello again' },
        });
      await expect
        .poll(() => {
          fixture.detectChanges();
          return input.readOnly;
        })
        .toBe(false);
      expect(document.activeElement).toBe(input);
      expect(input.value).toBe(fails ? 'Hello again' : '');
    },
  );
  it('disposes the chat transport and removes private UI on logout', async () => {
    const fixture = await create();
    await TestBed.inject(SessionService).logout();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-chat-page')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-auth-page')).not.toBeNull();
    expect(socket.disconnect).toHaveBeenCalledOnce();
  });
  it('restores colored identity without any rooms', async () => {
    api.request.mockResolvedValue({ user: account, result: [] });
    const fixture = await create();
    const avatar = fixture.nativeElement.querySelector(
      '.account-button app-user-avatar',
    ) as HTMLElement;
    expect(avatar.style.backgroundColor).toBe('rgb(72, 230, 149)');
    expect(avatar.textContent.trim()).toBe('A');
  });
});
