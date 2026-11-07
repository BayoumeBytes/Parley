import { Component, inject } from '@angular/core';
import { SessionService } from './core/services/session.service';
import { AuthPage } from './pages/auth/auth.page';
import { PhoneSetupPage } from './pages/phone-setup/phone-setup.page';
import { ChatPage } from './pages/chat/chat.page';
import { ThemeToggle } from './shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-root',
  imports: [AuthPage, PhoneSetupPage, ChatPage, ThemeToggle],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly session = inject(SessionService);
  constructor() {
    void this.session.restore();
  }
}
