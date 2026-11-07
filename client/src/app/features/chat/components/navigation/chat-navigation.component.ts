import { Component, input, output } from '@angular/core';
import { Account } from '../../../../core/models/account.models';
import { Icon } from '../../../../shared/components/icon/icon.component';
import { ThemeToggle } from '../../../../shared/components/theme-toggle/theme-toggle.component';
import { UserAvatar } from '../../../../shared/components/user-avatar/user-avatar.component';

@Component({
  selector: 'app-chat-navigation',
  imports: [Icon, ThemeToggle, UserAvatar],
  template: `
    <a href="/" class="brand-mark" aria-label="Parley home">p</a>
    <button class="rail-chat active" aria-label="Conversations" (click)="showList.emit()">
      <app-icon name="chat" />
    </button>
    <div class="rail-bottom">
      <app-theme-toggle />
      <span
        class="connection-dot"
        [class.online]="connected()"
        [title]="connected() ? 'Live connection active' : 'Reconnecting'"
      ></span>
      <button
        class="account-button"
        (click)="toggleDetails.emit()"
        aria-label="Show account information"
      >
        <app-user-avatar [person]="account()" [size]="36" [round]="true" />
      </button>
    </div>
  `,
  styleUrl: './chat-navigation.component.css',
  host: { role: 'navigation', 'aria-label': 'Main navigation', class: 'rail' },
})
export class ChatNavigation {
  readonly account = input<Account | null>(null);
  readonly connected = input(false);
  readonly showList = output<void>();
  readonly toggleDetails = output<void>();
}
