import { Component, inject } from '@angular/core';
import { Icon } from '../icon/icon.component';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  imports: [Icon],
  template: `
    <button
      type="button"
      aria-label="Dark mode"
      [attr.aria-pressed]="theme.dark()"
      [title]="theme.dark() ? 'Switch to light mode' : 'Switch to dark mode'"
      (click)="theme.toggle()"
    >
      <app-icon [name]="theme.dark() ? 'sun' : 'moon'" />
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }
    :host(.auth-theme-switch) {
      position: absolute;
      top: 24px;
      right: 24px;
    }
    button {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      padding: 0;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--secondary);
    }
    button:hover {
      background: var(--raised);
      color: var(--text);
    }
  `,
})
export class ThemeToggle {
  readonly theme = inject(ThemeService);
}
