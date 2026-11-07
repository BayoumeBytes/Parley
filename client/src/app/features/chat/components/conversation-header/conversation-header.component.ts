import { Component, computed, input, output } from '@angular/core';
import { Icon } from '../../../../shared/components/icon/icon.component';
import { UserAvatar } from '../../../../shared/components/user-avatar/user-avatar.component';
import { UserName } from '../../../../shared/components/user-name/user-name.component';
import { Membership } from '../../models/chat.models';
import { conversationTitle, otherParticipant } from '../../utils/conversations';

@Component({
  selector: 'app-conversation-header',
  imports: [Icon, UserAvatar, UserName],
  templateUrl: './conversation-header.component.html',
  styleUrl: './conversation-header.component.css',
  host: { class: 'chat-header' },
})
export class ConversationHeader {
  readonly room = input.required<Membership>();
  readonly currentUserId = input.required<string>();
  readonly connected = input(false);
  readonly loading = input(false);
  readonly detailsOpen = input(false);
  readonly back = output<void>();
  readonly refresh = output<void>();
  readonly toggleDetails = output<void>();
  readonly title = computed(() => conversationTitle(this.room(), this.currentUserId()));
  readonly peer = computed(() => otherParticipant(this.room(), this.currentUserId()));
}
