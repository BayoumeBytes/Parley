import { Component, computed, input } from '@angular/core';
import { Person } from '../../../core/models/account.models';
import { avatarInk, personColor } from '../../utils/account-colors';
import { initials } from '../../utils/identity';

@Component({
  selector: 'app-user-avatar',
  template: `{{ group() ? '#' : initials(label() || person()?.username || '') }}`,
  host: {
    class: 'avatar',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.border-radius]': 'radius()',
    '[style.font-size.px]': 'group() || size() === 64 ? 20 : 12',
    '[style.background-color]': "group() ? 'var(--raised)' : color()",
    '[style.color]': "group() ? 'var(--secondary)' : ink()",
  },
  styles: ':host { display: inline-grid; place-items: center; flex-shrink: 0; font-weight: 500; }',
})
export class UserAvatar {
  readonly person = input<Person | null | undefined>(null);
  readonly label = input('');
  readonly group = input(false);
  readonly size = input<32 | 36 | 40 | 64>(40);
  readonly round = input(false);
  readonly color = computed(() => personColor(this.person()?._id ?? '', this.person()?.color));
  readonly ink = computed(() => avatarInk(this.color()));
  readonly radius = computed(() =>
    this.round() ? '50%' : `${this.size() === 64 ? 20 : this.size() === 32 ? 8 : 12}px`,
  );
  readonly initials = initials;
}
