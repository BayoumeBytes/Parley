import { Component, input } from '@angular/core';

type IconName =
  | 'chat'
  | 'plus'
  | 'search'
  | 'back'
  | 'refresh'
  | 'info'
  | 'close'
  | 'send'
  | 'paper-plane'
  | 'sun'
  | 'moon';

@Component({
  selector: 'app-icon',
  template: `
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <use [attr.href]="'icons.svg#' + name()" />
    </svg>
  `,
  styles:
    ':host { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 18px; width: 18px; height: 18px; }',
})
export class Icon {
  readonly name = input.required<IconName>();
}
