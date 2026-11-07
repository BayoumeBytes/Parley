import { Component, computed, effect, ElementRef, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Account, Person } from '../../../../core/models/account.models';
import { UserAvatar } from '../../../../shared/components/user-avatar/user-avatar.component';
import { UserName } from '../../../../shared/components/user-name/user-name.component';
import { Message } from '../../models/chat.models';
import { groupMessages } from '../../utils/messages';

@Component({
  selector: 'app-message-list',
  imports: [DatePipe, UserAvatar, UserName],
  templateUrl: './message-list.component.html',
  styleUrl: './message-list.component.css',
  host: {
    role: 'log',
    'aria-label': 'Message history',
    'aria-live': 'polite',
    '[attr.aria-busy]': 'loading()',
  },
})
export class MessageList {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly messages = input.required<Message[]>();
  readonly account = input<Account | null>(null);
  readonly participants = input<Person[]>([]);
  readonly loading = input(false);
  readonly title = input('');
  readonly groups = computed(() => groupMessages(this.messages()));
  constructor() {
    effect((onCleanup) => {
      this.messages();
      const frame = requestAnimationFrame(() => {
        const element = this.host.nativeElement;
        element.scrollTop = element.scrollHeight;
      });
      onCleanup(() => cancelAnimationFrame(frame));
    });
  }
  person(sender: string): Person {
    return (
      (sender === this.account()?._id
        ? this.account()
        : this.participants().find((person) => person._id === sender)) ?? {
        _id: sender,
        username: 'Former member',
      }
    );
  }
  label(sender: string): string {
    return sender === this.account()?._id ? 'You' : this.person(sender).username;
  }
}
