import { Component, effect, inject, signal, untracked } from '@angular/core';
import { SessionService } from '../../core/services/session.service';
import { Icon } from '../../shared/components/icon/icon.component';
import { ChatNavigation } from '../../features/chat/components/navigation/chat-navigation.component';
import { ConversationSidebar } from '../../features/chat/components/sidebar/conversation-sidebar.component';
import { ConversationHeader } from '../../features/chat/components/conversation-header/conversation-header.component';
import { ConversationDetails } from '../../features/chat/components/conversation-details/conversation-details.component';
import { ConversationDialog } from '../../features/chat/components/conversation-dialog/conversation-dialog.component';
import { MessageList } from '../../features/chat/components/message-list/message-list.component';
import { MessageComposer } from '../../features/chat/components/message-composer/message-composer.component';
import { ChatWelcome } from '../../features/chat/components/welcome/chat-welcome.component';
import {
  ConversationCommand,
  DialogKind,
  Membership,
} from '../../features/chat/models/chat.models';
import { ChatStore } from '../../features/chat/state/chat.store';
import { conversationTitle } from '../../features/chat/utils/conversations';

@Component({
  selector: 'app-chat-page',
  imports: [
    Icon,
    ChatNavigation,
    ConversationSidebar,
    ConversationHeader,
    ConversationDetails,
    ConversationDialog,
    MessageList,
    MessageComposer,
    ChatWelcome,
  ],
  providers: [ChatStore],
  templateUrl: './chat.page.html',
  styleUrl: './chat.page.css',
})
export class ChatPage {
  readonly session = inject(SessionService);
  readonly chat = inject(ChatStore);
  readonly details = signal(false);
  readonly dialog = signal<DialogKind | null>(null);
  readonly draft = signal('');
  readonly title = conversationTitle;

  constructor() {
    void this.chat.initialize();
    effect(() => {
      const room = this.chat.selectedId();
      untracked(() => {
        this.draft.set('');
        this.details.set(false);
        if (!room && this.dialog() === 'members') this.dialog.set(null);
      });
    });
  }
  selectRoom(room: Membership): void {
    this.draft.set('');
    this.details.set(false);
    this.chat.selectRoom(room);
  }
  openDialog(kind: DialogKind): void {
    this.chat.error.set('');
    this.dialog.set(kind);
  }
  async submitDialog(command: ConversationCommand): Promise<void> {
    if (await this.chat.applyConversation(command)) this.dialog.set(null);
  }
  async send(): Promise<void> {
    const room = this.chat.selectedId(),
      draft = this.draft();
    if (
      (await this.chat.send(draft)) &&
      this.chat.selectedId() === room &&
      this.draft().trim() === draft.trim()
    ) {
      this.draft.set('');
    }
  }
}
