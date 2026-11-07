import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Registration } from '../../core/models/account.models';
import { SessionService } from '../../core/services/session.service';
import { Icon } from '../../shared/components/icon/icon.component';
import { PhoneInput } from '../../shared/components/phone-input/phone-input.component';
import { ThemeToggle } from '../../shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-auth-page',
  imports: [FormsModule, Icon, PhoneInput, ThemeToggle],
  templateUrl: './auth.page.html',
  styleUrl: './auth.page.css',
})
export class AuthPage {
  readonly session = inject(SessionService);
  readonly registering = signal(false);
  readonly form: Registration = { username: '', password: '', email: '', phoneNumber: '' };
  toggleRegistration(): void {
    this.registering.update((value) => !value);
    this.session.error.set('');
  }
  async submit(): Promise<void> {
    if (await this.session.authenticate(this.form, this.registering())) this.form.password = '';
  }
}
