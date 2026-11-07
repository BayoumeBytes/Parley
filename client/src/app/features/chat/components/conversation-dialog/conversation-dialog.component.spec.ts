import { TestBed } from '@angular/core/testing';
import { ConversationDialog } from './conversation-dialog.component';

describe('ConversationDialog', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [ConversationDialog] }));
  async function create(kind: 'create' | 'members' = 'create') {
    const fixture = TestBed.createComponent(ConversationDialog);
    fixture.componentRef.setInput('kind', kind);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }
  it('requires a non-blank group name before emitting a request', async () => {
    const fixture = await create(),
      submit = vi.fn();
    fixture.componentInstance.submitted.subscribe(submit);
    fixture.componentInstance.roomType = 'group';
    fixture.componentInstance.roomTitle = ' ';
    fixture.componentInstance.memberIdentifiers = 'bob';
    fixture.componentInstance.submit();
    expect(submit).not.toHaveBeenCalled();
    expect(fixture.componentInstance.validationError()).toBe('Enter a group name.');
  });
  it('exposes the chosen room type and parses commas/newlines without splitting formatted phones', async () => {
    const fixture = await create(),
      submit = vi.fn();
    fixture.componentInstance.submitted.subscribe(submit);
    fixture.nativeElement.querySelectorAll('.segmented button')[1].click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelectorAll('.segmented button')[1].getAttribute('aria-pressed'),
    ).toBe('true');
    fixture.componentInstance.roomTitle = ' Team ';
    fixture.componentInstance.memberIdentifiers = 'bob,\n+20 101 234 5678';
    fixture.componentInstance.submit();
    expect(submit).toHaveBeenCalledWith({
      kind: 'create',
      type: 'group',
      name: 'Team',
      identifiers: ['bob', '+20 101 234 5678'],
    });
  });
  it('emits group membership changes separately from room creation', async () => {
    const fixture = await create('members'),
      submit = vi.fn();
    fixture.componentInstance.submitted.subscribe(submit);
    fixture.componentInstance.memberAction = 'remove';
    fixture.componentInstance.memberIdentifiers = 'bob@example.com';
    fixture.componentInstance.submit();
    expect(submit).toHaveBeenCalledWith({
      kind: 'members',
      action: 'remove',
      identifiers: ['bob@example.com'],
    });
  });
  it('traps keyboard focus, closes on Escape, and restores the opener', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const fixture = await create(),
      close = vi.fn();
    fixture.componentInstance.closed.subscribe(close);
    const first = fixture.nativeElement.querySelector('.icon-button') as HTMLButtonElement;
    const last = fixture.nativeElement.querySelector(
      '.modal-actions .primary',
    ) as HTMLButtonElement;
    first.focus();
    first.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(last);
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(close).toHaveBeenCalledOnce();
    fixture.destroy();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
