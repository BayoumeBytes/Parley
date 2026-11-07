import { TestBed } from '@angular/core/testing';
import { ThemeToggle } from './theme-toggle.component';

describe('theme switch', () => {
  beforeEach(() => {
    localStorage.setItem('parley-theme', 'light');
    TestBed.configureTestingModule({ imports: [ThemeToggle] });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.removeItem('parley-theme');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });
  it('exposes an accessible toggle and switches its icon and pressed state', () => {
    const fixture = TestBed.createComponent(ThemeToggle);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Dark mode');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.title).toBe('Switch to light mode');
    expect(button.querySelector('use')?.getAttribute('href')).toBe('icons.svg#sun');
    expect(localStorage.getItem('parley-theme')).toBe('dark');
  });
});
