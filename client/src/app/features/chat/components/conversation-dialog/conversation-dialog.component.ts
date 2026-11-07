import {
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Icon } from '../../../../shared/components/icon/icon.component';
import { ConversationCommand, DialogKind, MemberAction, RoomType } from '../../models/chat.models';
import { parseIdentifiers } from '../../utils/conversations';

@Component({
  selector: 'app-conversation-dialog',
  imports: [FormsModule, Icon],
  templateUrl: './conversation-dialog.component.html',
  styleUrl: './conversation-dialog.component.css',
})
export class ConversationDialog {
  readonly kind = input.required<DialogKind>();
  readonly busy = input(false);
  readonly error = input('');
  readonly submitted = output<ConversationCommand>();
  readonly closed = output<void>();
  readonly validationError = signal('');
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  roomType: RoomType = 'direct';
  roomTitle = '';
  memberIdentifiers = '';
  memberAction: MemberAction = 'add';

  constructor() {
    const previousFocus = document.activeElement as HTMLElement | null;
    effect(() =>
      this.dialog()
        ?.nativeElement.querySelector<HTMLElement>('input, textarea, select, button')
        ?.focus(),
    );
    inject(DestroyRef).onDestroy(() => {
      if (previousFocus?.isConnected) previousFocus.focus();
    });
  }
  close(): void {
    if (!this.busy()) this.closed.emit();
  }
  keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.close();
    if (event.key !== 'Tab') return;
    const controls = this.dialog()?.nativeElement.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input, textarea, select',
    );
    if (!controls?.length) return;
    const first = controls[0],
      last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  submit(): void {
    if (this.busy()) return;
    this.validationError.set('');
    const identifiers = parseIdentifiers(this.memberIdentifiers);
    if (!identifiers.length) {
      this.validationError.set('Enter a username, email or primary phone number.');
      return;
    }
    if (this.kind() === 'create') {
      if (this.roomType === 'group' && !this.roomTitle.trim()) {
        this.validationError.set('Enter a group name.');
        return;
      }
      this.submitted.emit({
        kind: 'create',
        type: this.roomType,
        name: this.roomTitle.trim(),
        identifiers,
      });
    } else {
      this.submitted.emit({ kind: 'members', action: this.memberAction, identifiers });
    }
  }
}
