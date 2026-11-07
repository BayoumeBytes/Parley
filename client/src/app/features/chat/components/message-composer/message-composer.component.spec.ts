import { TestBed } from '@angular/core/testing';
import { MessageComposer } from './message-composer.component';

describe('MessageComposer', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [MessageComposer] }));
  async function create(draft = 'Hello') {
    const fixture = TestBed.createComponent(MessageComposer);
    fixture.componentRef.setInput('draft', draft);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  it('uses an accessible icon-only send button inside the field', async () => {
    const fixture = await create();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Send message');
    expect(button.textContent?.trim()).toBe('');
    expect(button.querySelector('use')?.getAttribute('href')).toBe('icons.svg#paper-plane');
    expect(fixture.nativeElement.querySelector('.composer-tools')).toBeNull();
  });
  it('emits Enter sends without losing focus or inserting a newline', async () => {
    const fixture = await create();
    const send = vi.fn();
    fixture.componentInstance.sendRequested.subscribe(send);
    const input = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    input.focus();
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(send).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('sending', true);
    fixture.detectChanges();
    expect(input.readOnly).toBe(true);
    expect(input.disabled).toBe(false);
    expect(document.activeElement).toBe(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(send).toHaveBeenCalledOnce();
  });
  it.each([{ shiftKey: true }, { isComposing: true }])(
    'preserves multiline and IME entry (%j)',
    async (options) => {
      const fixture = await create(),
        send = vi.fn();
      fixture.componentInstance.sendRequested.subscribe(send);
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
        ...options,
      });
      fixture.nativeElement.querySelector('textarea').dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(send).not.toHaveBeenCalled();
    },
  );
  it('does not emit empty sends and exposes the server message-length limit', async () => {
    const fixture = await create('  '),
      send = vi.fn();
    fixture.componentInstance.sendRequested.subscribe(send);
    fixture.componentInstance.submit();
    expect(send).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('textarea').maxLength).toBe(10000);
  });
});
