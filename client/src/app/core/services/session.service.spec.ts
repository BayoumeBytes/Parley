import { TestBed } from '@angular/core/testing';
import { account, deferred } from '../../../testing/fixtures';
import { ApiError, ApiService } from './api.service';
import { SessionService } from './session.service';
import { Account } from '../models/account.models';

describe('SessionService', () => {
  let api: { request: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    api = { request: vi.fn().mockResolvedValue({ user: account }) };
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
  });
  it('restores identity independently of room memberships', async () => {
    const session = TestBed.inject(SessionService);
    await session.restore();
    expect(session.phase()).toBe('chat');
    expect(session.account()).toEqual(account);
    expect(api.request).toHaveBeenCalledExactlyOnceWith('auth/me');
  });
  it('treats an absent session as sign-in, without displaying an error', async () => {
    api.request.mockRejectedValue(new ApiError('Unauthorized', 401));
    const session = TestBed.inject(SessionService);
    await session.restore();
    expect(session.phase()).toBe('auth');
    expect(session.error()).toBe('');
  });
  it('requires phone setup after restoring a legacy session', async () => {
    api.request.mockResolvedValue({ user: { ...account, requiresPhone: true, phoneNumber: null } });
    const session = TestBed.inject(SessionService);
    await session.restore();
    expect(session.phase()).toBe('phone');
    expect(session.account()?.color).toBe(account.color);
  });
  it('sends the primary phone on registration and then logs in', async () => {
    const session = TestBed.inject(SessionService);
    await session.authenticate(
      {
        username: ' alice ',
        email: ' alice@example.com ',
        password: 'secret',
        phoneNumber: '+12025550123',
      },
      true,
    );
    expect(api.request).toHaveBeenNthCalledWith(1, 'auth/register', {
      username: 'alice',
      email: 'alice@example.com',
      password: 'secret',
      phoneNumber: '+12025550123',
    });
    expect(api.request).toHaveBeenNthCalledWith(2, 'auth/login', {
      username: 'alice',
      password: 'secret',
    });
    expect(session.phase()).toBe('chat');
  });
  it('requires phone setup immediately after legacy login', async () => {
    api.request.mockResolvedValue({ user: { ...account, phoneNumber: null, requiresPhone: true } });
    const session = TestBed.inject(SessionService);
    await session.authenticate(
      { username: 'alice', password: 'secret', email: '', phoneNumber: '' },
      false,
    );
    expect(session.phase()).toBe('phone');
    expect(api.request).toHaveBeenCalledOnce();
  });
  it('keeps the phone gate and account after a duplicate-number conflict', async () => {
    const session = TestBed.inject(SessionService);
    session.requirePhone(account);
    api.request.mockRejectedValue(new ApiError('Number already in use', 409));
    await session.savePrimaryPhone('+12025550123');
    expect(session.phase()).toBe('phone');
    expect(session.error()).toBe('Number already in use');
    expect(session.account()?.color).toBe(account.color);
    expect(session.busy()).toBe(false);
  });
  it('unlocks chat after phone completion', async () => {
    const session = TestBed.inject(SessionService);
    session.requirePhone(account);
    await session.savePrimaryPhone(' +12025550123 ');
    expect(api.request).toHaveBeenCalledWith('auth/phone', { phoneNumber: '+12025550123' });
    expect(session.phase()).toBe('chat');
  });
  it('allows logout before completing phone setup', async () => {
    const session = TestBed.inject(SessionService);
    session.requirePhone(account);
    await session.logout();
    expect(session.phase()).toBe('auth');
    expect(session.account()).toBeNull();
    expect(session.loggingOut()).toBe(false);
  });
  it('invalidates account state on revocation and handles protected phone errors', async () => {
    const session = TestBed.inject(SessionService);
    await session.restore();
    expect(session.handleSessionError(new ApiError('Phone needed', 403, 'PHONE_REQUIRED'))).toBe(
      true,
    );
    expect(session.phase()).toBe('phone');
    expect(session.handleSessionError(new ApiError('Expired', 401))).toBe(true);
    expect(session.phase()).toBe('auth');
    expect(session.account()).toBeNull();
  });
  it('does not resurrect a logged-out session from a stale restoration response', async () => {
    const pending = deferred<{ user: Account }>();
    api.request.mockImplementation((path: string) =>
      path === 'auth/me' ? pending.promise : Promise.resolve({}),
    );
    const session = TestBed.inject(SessionService);
    const restoring = session.restore();
    await session.logout();
    pending.resolve({ user: account });
    await restoring;
    expect(session.phase()).toBe('auth');
    expect(session.account()).toBeNull();
  });
});
