import { computed, inject, Injectable, signal } from '@angular/core';
import { Account, Registration } from '../models/account.models';
import { ApiError, ApiService } from './api.service';

export type SessionPhase = 'loading' | 'auth' | 'phone' | 'chat';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(ApiService);
  private readonly phaseState = signal<SessionPhase>('loading');
  private readonly accountState = signal<Account | null>(null);
  private readonly revisionState = signal(0);
  readonly phase = this.phaseState.asReadonly();
  readonly account = this.accountState.asReadonly();
  readonly revision = this.revisionState.asReadonly();
  readonly userId = computed(() => this.account()?._id ?? '');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly loggingOut = signal(false);

  private restoration?: Promise<void>;

  restore(): Promise<void> {
    return (this.restoration ??= this.restoreSession());
  }

  private async restoreSession() {
    const revision = this.revision();
    try {
      const { user } = await this.api.request<{ user: Account }>('auth/me');
      if (revision === this.revision()) this.accept(user);
    } catch (error) {
      if (revision !== this.revision()) return;
      this.clear();
      if (!(error instanceof ApiError && error.status === 401)) this.report(error);
    }
  }

  async authenticate(form: Registration, register: boolean): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.error.set('');
    try {
      if (register) {
        await this.api.request('auth/register', {
          username: form.username.trim(),
          password: form.password,
          email: form.email.trim(),
          phoneNumber: form.phoneNumber.trim(),
        });
      }
      const { user } = await this.api.request<{ user: Account }>('auth/login', {
        username: form.username.trim(),
        password: form.password,
      });
      this.accept(user);
      return true;
    } catch (error) {
      this.report(error);
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  async savePrimaryPhone(phoneNumber: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const { user } = await this.api.request<{ user: Account }>('auth/phone', {
        phoneNumber: phoneNumber.trim(),
      });
      this.accept(user);
    } catch (error) {
      this.report(error);
    } finally {
      this.busy.set(false);
    }
  }

  async logout(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.loggingOut.set(true);
    try {
      await this.api.request('auth/logout', {});
      this.clear();
    } catch (error) {
      this.report(error);
    } finally {
      this.busy.set(false);
      this.loggingOut.set(false);
    }
  }

  updateFromSocket(user: Account): boolean {
    if (user._id !== this.userId()) {
      this.expire('Your account changed. Please sign in again.');
      return false;
    }
    if (user.requiresPhone) {
      this.requirePhone(user);
      return false;
    }
    this.accountState.set(user);
    return true;
  }

  requirePhone(user: Account): void {
    this.accept({ ...user, requiresPhone: true });
  }

  expire(message: string): void {
    this.clear();
    this.error.set(message);
  }

  /** Returns true when an error changes the session and the caller must stop. */
  handleSessionError(error: unknown): boolean {
    if (error instanceof ApiError && error.status === 401 && this.phase() !== 'auth') {
      this.expire(error.message);
      return true;
    }
    if (error instanceof ApiError && error.code === 'PHONE_REQUIRED' && this.account()) {
      this.requirePhone(this.account()!);
      this.error.set(error.message);
      return true;
    }
    return false;
  }

  private accept(user: Account): void {
    this.revisionState.update((value) => value + 1);
    this.accountState.set(user);
    this.error.set('');
    this.phaseState.set(user.requiresPhone ? 'phone' : 'chat');
  }
  private clear(): void {
    this.revisionState.update((value) => value + 1);
    this.accountState.set(null);
    this.phaseState.set('auth');
    this.error.set('');
  }
  private report(error: unknown): void {
    this.handleSessionError(error);
    this.error.set(
      error instanceof Error ? error.message : 'Something went wrong. Please try again.',
    );
  }
}
