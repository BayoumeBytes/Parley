import { Component, computed, inject, input } from '@angular/core';
import { Person } from '../../../core/models/account.models';
import { ThemeService } from '../../../core/services/theme.service';
import { nameInk, personColor } from '../../utils/account-colors';

@Component({
  selector: 'app-user-name',
  template: `{{ label() || person()?.username || 'Former member' }}`,
  host: { '[style.color]': 'ink()' },
})
export class UserName {
  private readonly theme = inject(ThemeService);
  readonly person = input<Person | null | undefined>(null);
  readonly label = input('');
  readonly ink = computed(() =>
    nameInk(personColor(this.person()?._id ?? '', this.person()?.color), this.theme.dark()),
  );
}
