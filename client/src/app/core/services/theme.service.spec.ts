import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('theme preference', () => {
  let media: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };
  let listeners: Set<() => void>;
  beforeEach(() => {
    localStorage.removeItem('parley-theme');
    listeners = new Set();
    media = {
      matches: false,
      addEventListener: vi.fn((_event, listener) => listeners.add(listener)),
      removeEventListener: vi.fn((_event, listener) => listeners.delete(listener)),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    );
    TestBed.configureTestingModule({});
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.removeItem('parley-theme');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });
  function systemDark(dark: boolean) {
    media.matches = dark;
    listeners.forEach((listener) => listener());
  }
  it('follows the system until a user makes an explicit choice', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('light');
    systemDark(true);
    expect(service.dark()).toBe(true);
    service.toggle();
    systemDark(false);
    systemDark(true);
    expect(service.theme()).toBe('light');
    expect(localStorage.getItem('parley-theme')).toBe('light');
  });
  it('restores a saved preference instead of the system setting', () => {
    localStorage.setItem('parley-theme', 'light');
    media.matches = true;
    expect(TestBed.inject(ThemeService).theme()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
  });
  it('starts dark when the system is dark and there is no preference', () => {
    media.matches = true;
    expect(TestBed.inject(ThemeService).theme()).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
  it('persists toggles and updates the root theme', () => {
    const service = TestBed.inject(ThemeService);
    service.toggle();
    expect(localStorage.getItem('parley-theme')).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    service.toggle();
    expect(localStorage.getItem('parley-theme')).toBe('light');
  });
  it('synchronizes preferences from other tabs and returns to system after clearing', () => {
    const service = TestBed.inject(ThemeService);
    window.dispatchEvent(new StorageEvent('storage', { key: 'parley-theme', newValue: 'dark' }));
    expect(service.dark()).toBe(true);
    window.dispatchEvent(new StorageEvent('storage', { key: null, newValue: null }));
    expect(service.dark()).toBe(false);
    systemDark(true);
    expect(service.dark()).toBe(true);
  });
  it('ignores unrelated storage keys', () => {
    const service = TestBed.inject(ThemeService);
    window.dispatchEvent(new StorageEvent('storage', { key: 'other-setting', newValue: 'dark' }));
    expect(service.theme()).toBe('light');
  });
  it('ignores invalid stored values', () => {
    localStorage.setItem('parley-theme', 'unknown');
    media.matches = true;
    expect(TestBed.inject(ThemeService).theme()).toBe('dark');
  });
  it('still works when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Blocked');
    });
    media.matches = true;
    const service = TestBed.inject(ThemeService);
    expect(service.dark()).toBe(true);
    expect(() => service.toggle()).not.toThrow();
    expect(service.theme()).toBe('light');
    systemDark(true);
    expect(service.theme()).toBe('light');
  });
  it('cleans up event listeners when destroyed', () => {
    TestBed.inject(ThemeService);
    expect(listeners.size).toBe(1);
    TestBed.resetTestingModule();
    expect(listeners.size).toBe(0);
    expect(media.removeEventListener).toHaveBeenCalledOnce();
  });
});
