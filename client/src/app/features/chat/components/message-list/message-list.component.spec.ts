import { TestBed } from '@angular/core/testing';
import { account, message, peer } from '../../../../../testing/fixtures';
import { MessageList } from './message-list.component';

describe('MessageList', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [MessageList] }));
  it('groups plain messages under one avatar, name, and timestamp per sender run', () => {
    const fixture = TestBed.createComponent(MessageList);
    fixture.componentRef.setInput('account', account);
    fixture.componentRef.setInput('participants', [account, peer]);
    fixture.componentRef.setInput('messages', [
      message,
      { ...message, _id: '2', message: 'Another thought' },
      { ...message, _id: '3', sender: account._id, message: 'Reply' },
      { ...message, _id: '4', sender: account._id, message: 'Second reply' },
    ]);
    fixture.detectChanges();
    const groups = fixture.nativeElement.querySelectorAll('.message-row');
    expect(groups.length).toBe(2);
    for (const group of groups) {
      expect(group.querySelectorAll('.message-text').length).toBe(2);
      expect(group.querySelectorAll('.message-avatar').length).toBe(1);
      expect(group.querySelectorAll('strong').length).toBe(1);
      expect(group.querySelectorAll('time').length).toBe(1);
    }
    expect(groups[0].querySelector('strong').textContent.trim()).toBe('bob');
    expect(groups[1].classList.contains('mine')).toBe(true);
    expect(fixture.nativeElement.querySelector('.bubble')).toBeNull();
  });
  it('renders message content as text, not executable HTML', () => {
    const fixture = TestBed.createComponent(MessageList);
    fixture.componentRef.setInput('messages', [
      { ...message, message: '<img src=x onerror=alert(1)>' },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('.message-text').textContent).toContain('<img');
  });
});
