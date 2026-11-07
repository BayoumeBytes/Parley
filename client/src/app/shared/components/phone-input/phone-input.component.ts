import { booleanAttribute, Component, computed, forwardRef, input, signal } from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { internationalPhone, phoneCountries } from '../../utils/phone-numbers';

@Component({
  selector: 'app-phone-input',
  templateUrl: './phone-input.component.html',
  styleUrl: './phone-input.component.css',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PhoneInput), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => PhoneInput), multi: true },
  ],
})
export class PhoneInput implements ControlValueAccessor, Validator {
  readonly inputId = input.required<string>();
  readonly describedBy = input('');
  readonly required = input(true, { transform: booleanAttribute });
  readonly countries = phoneCountries;
  readonly country = signal<CountryCode | ''>('');
  readonly national = signal('');
  readonly disabled = signal(false);
  readonly touched = signal(false);
  readonly selection = computed(() =>
    this.countries.find((country) => country.code === this.country()),
  );
  readonly international = computed(() => internationalPhone(this.country(), this.national()));
  readonly errorText = computed(() => {
    if (!this.touched() || !this.national().trim()) return '';
    if (!this.country()) return 'Choose a country for this number';
    return this.international() ? '' : 'Enter a valid local phone number for the selected country';
  });
  readonly descriptionIds = computed(() =>
    [this.describedBy(), this.errorText() ? `${this.inputId()}-error` : '']
      .filter(Boolean)
      .join(' '),
  );
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  private onValidate: () => void = () => {};

  writeValue(value: string | null): void {
    const number = value ? parsePhoneNumberFromString(value, { extract: false }) : undefined;
    this.country.set(number?.country ?? '');
    this.national.set(number?.country ? number.formatNational() : (value ?? ''));
  }
  registerOnChange(callback: (value: string) => void): void {
    this.onChange = callback;
  }
  registerOnTouched(callback: () => void): void {
    this.onTouched = callback;
  }
  registerOnValidatorChange(callback: () => void): void {
    this.onValidate = callback;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
  validate(): ValidationErrors | null {
    if (!this.national().trim()) return this.required() ? { required: true } : null;
    return this.international() ? null : { phoneNumber: true };
  }
  changeCountry(value: string): void {
    this.country.set(this.countries.find((country) => country.code === value)?.code ?? '');
    this.emit();
  }
  changeNumber(value: string): void {
    this.national.set(value);
    if (value.trim().startsWith('+')) {
      const number = parsePhoneNumberFromString(value, { extract: false });
      if (number?.country) {
        this.country.set(number.country);
        this.national.set(number.formatNational());
      }
    }
    this.emit();
  }
  blur(): void {
    this.touched.set(true);
    this.onTouched();
  }
  private emit(): void {
    this.onChange(this.international());
    this.onValidate();
  }
}
