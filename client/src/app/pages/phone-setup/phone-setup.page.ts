import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SessionService } from '../../core/services/session.service';
import { PhoneInput } from '../../shared/components/phone-input/phone-input.component';
import { ThemeToggle } from '../../shared/components/theme-toggle/theme-toggle.component';
import { UserAvatar } from '../../shared/components/user-avatar/user-avatar.component';
import { UserName } from '../../shared/components/user-name/user-name.component';

@Component({
  selector: 'app-phone-setup-page',
  imports: [FormsModule, PhoneInput, ThemeToggle, UserAvatar, UserName],
  templateUrl: './phone-setup.page.html',
  styleUrl: './phone-setup.page.css',
})
export class PhoneSetupPage {
  readonly session = inject(SessionService);
  phoneNumber = '';
  submit(): void {
    void this.session.savePrimaryPhone(this.phoneNumber);
  }
}
