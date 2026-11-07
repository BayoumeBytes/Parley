import { Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Icon } from '../../../../shared/components/icon/icon.component';
import { MAX_MESSAGE_LENGTH } from '../../models/chat.models';

@Component({
  selector: 'app-message-composer',
  imports: [FormsModule, Icon],
  templateUrl: './message-composer.component.html',
  styleUrl: './message-composer.component.css',
})
export class MessageComposer {
  readonly draft = model('');
  readonly sending = input(false);
  readonly typingCount = input(0);
  readonly sendRequested = output<void>();
  readonly typingChanged = output<void>();
  readonly blurred = output<void>();
  readonly maxLength = MAX_MESSAGE_LENGTH;
  submit(): void {
    if (this.draft().trim() && !this.sending()) this.sendRequested.emit();
  }
  keydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.submit();
    }
  }
  update(value: string): void {
    this.draft.set(value);
    this.typingChanged.emit();
  }
}
