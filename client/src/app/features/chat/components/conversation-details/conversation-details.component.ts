import { Component, computed, input, output } from '@angular/core';
import { Account } from '../../../../core/models/account.models';
import { Icon } from '../../../../shared/components/icon/icon.component';
import { UserAvatar } from '../../../../shared/components/user-avatar/user-avatar.component';
import { UserName } from '../../../../shared/components/user-name/user-name.component';
import { Membership } from '../../models/chat.models';
import { conversationTitle, otherParticipant } from '../../utils/conversations';

@Component({
  selector: 'app-conversation-details',
  imports: [Icon, UserAvatar, UserName],
  templateUrl: './conversation-details.component.html',
  styleUrl: './conversation-details.component.css',
  host: {
    class: 'details-panel',
    role: 'complementary',
    'aria-label': 'Conversation and account details',
  },
})
export class ConversationDetails {
  readonly account = input<Account | null>(null);
  readonly room = input<Membership>();
  readonly canManage = input(false);
  readonly busy = input(false);
  readonly close = output<void>();
  readonly manageMembers = output<void>();
  readonly signOut = output<void>();
  readonly title = computed(() =>
    this.room() ? conversationTitle(this.room()!, this.account()?._id ?? '') : '',
  );
  readonly peer = computed(() =>
    this.room() ? otherParticipant(this.room()!, this.account()?._id ?? '') : undefined,
  );
}
