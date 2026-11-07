import { Component, input, output } from '@angular/core';
import { Icon } from '../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-chat-welcome',
  imports: [Icon],
  template: `
    <div class="welcome-art" aria-hidden="true"><span>Hello</span><span>Let’s talk</span></div>
    <span class="eyebrow">Your conversations</span>
    <h2>One person or the whole group</h2>
    <p>
      Open a chat from the list, or find someone by username, email or phone to start a
      conversation.
    </p>
    <button class="primary" (click)="createConversation.emit()">
      Start a conversation <app-icon name="send" />
    </button>
    <div class="welcome-note">
      <span class="connection-dot" [class.online]="connected()"></span
      >{{ connected() ? 'Live updates connected' : 'Connecting to your conversations…' }}
    </div>
  `,
  styleUrl: './chat-welcome.component.css',
})
export class ChatWelcome {
  readonly connected = input(false);
  readonly createConversation = output<void>();
}
