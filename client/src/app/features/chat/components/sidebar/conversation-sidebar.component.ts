import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Icon } from '../../../../shared/components/icon/icon.component';
import { UserAvatar } from '../../../../shared/components/user-avatar/user-avatar.component';
import { UserName } from '../../../../shared/components/user-name/user-name.component';
import { Membership } from '../../models/chat.models';
import { conversationTitle, otherParticipant } from '../../utils/conversations';

@Component({
  selector: 'app-conversation-sidebar',
  imports: [FormsModule, Icon, UserAvatar, UserName],
  templateUrl: './conversation-sidebar.component.html',
  styleUrl: './conversation-sidebar.component.css',
  host: { class: 'sidebar', role: 'complementary', 'aria-label': 'Conversations' },
})
export class ConversationSidebar {
  readonly rooms = input.required<Membership[]>();
  readonly currentUserId = input.required<string>();
  readonly selectedId = input('');
  readonly unread = input<Record<string, number>>({});
  readonly previews = input<Record<string, string>>({});
  readonly connected = input(false);
  readonly search = signal('');
  readonly filtered = computed(() =>
    this.rooms().filter((room) =>
      this.title(room).toLowerCase().includes(this.search().toLowerCase()),
    ),
  );
  readonly roomSelected = output<Membership>();
  readonly createConversation = output<void>();
  title(room: Membership) {
    return conversationTitle(room, this.currentUserId());
  }
  peer(room: Membership) {
    return otherParticipant(room, this.currentUserId());
  }
}
