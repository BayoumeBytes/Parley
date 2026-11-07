import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
const storageKey = 'parley-theme';
const asTheme = (value: string | null): Theme | null =>
  value === 'light' || value === 'dark' ? value : null;

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media = window.matchMedia?.('(prefers-color-scheme: dark)');
  private preference: Theme | null = this.readPreference();
  private readonly current = signal<Theme>(this.resolve());
  readonly theme = this.current.asReadonly();
  readonly dark = computed(() => this.theme() === 'dark');

  constructor() {
    this.apply(this.current());
    const systemChanged = () => {
      if (!this.preference) this.apply(this.resolve());
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return;
      this.preference = asTheme(event.newValue);
      this.apply(this.resolve());
    };
    this.media?.addEventListener('change', systemChanged);
    window.addEventListener('storage', storageChanged);
    inject(DestroyRef).onDestroy(() => {
      this.media?.removeEventListener('change', systemChanged);
      window.removeEventListener('storage', storageChanged);
    });
  }

  toggle(): void {
    const next = this.dark() ? 'light' : 'dark';
    this.preference = next;
    this.apply(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* Keep the in-memory choice. */
    }
  }

  private readPreference(): Theme | null {
    try {
      return asTheme(localStorage.getItem(storageKey));
    } catch {
      return null;
    }
  }

  private resolve(): Theme {
    return this.preference ?? (this.media?.matches ? 'dark' : 'light');
  }

  private apply(theme: Theme): void {
    this.current.set(theme);
    document.documentElement.dataset['theme'] = theme;
    document.documentElement.style.colorScheme = theme;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#141917' : '#f6f6f2';
  }
}
