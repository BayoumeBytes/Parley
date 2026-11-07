import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule, NgModel } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { PhoneInput } from './phone-input.component';
import { internationalPhone, phoneCountries } from '../../utils/phone-numbers';

@Component({
  imports: [FormsModule, PhoneInput],
  template: `
    <label for="test-phone">Primary phone number</label>
    <app-phone-input
      inputId="test-phone"
      name="phone"
      [(ngModel)]="value"
      [disabled]="disabled()"
      describedBy="phone-help"
    />
    <p id="phone-help">Choose your country and enter your local number</p>
  `,
})
class TestHost {
  value = '';
  disabled = signal(false);
}

describe('phone country selection', () => {
  it('provides predefined country names, flags, and dialing codes', () => {
    expect(phoneCountries.length).toBeGreaterThan(200);
    expect(phoneCountries.find((country) => country.code === 'EG')).toEqual({
      code: 'EG',
      name: 'Egypt',
      callingCode: '20',
      flag: '🇪🇬',
    });
    expect(phoneCountries.find((country) => country.code === 'GB')?.callingCode).toBe('44');
  });
  it.each([
    ['EG', '01012345678', '+201012345678'],
    ['US', '(202) 555-0123', '+12025550123'],
    ['GB', '020 7946 0123', '+442079460123'],
    ['IT', '02 1234 5678', '+390212345678'],
  ] as const)(
    'normalizes %s national numbers without manually entered country codes',
    (country, local, expected) => {
      expect(internationalPhone(country, local)).toBe(expected);
    },
  );
  it('does not guess a country or accept incomplete and mismatched numbers', () => {
    expect(internationalPhone('', '01012345678')).toBe('');
    expect(internationalPhone('EG', '123')).toBe('');
    expect(internationalPhone('EG', '+442079460123')).toBe('');
    expect(internationalPhone('US', 'Call me at 2025550123')).toBe('');
  });
});

describe('PhoneInput form control', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHost] }).compileComponents();
  });
  async function create(value = '') {
    const fixture = TestBed.createComponent(TestHost);
    fixture.componentInstance.value = value;
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  async function country(fixture: Awaited<ReturnType<typeof create>>, code: string) {
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = code;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
  }
  async function number(fixture: Awaited<ReturnType<typeof create>>, value: string) {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    return input;
  }
  it('emits one complete international number through ngModel and shows its flag/code on the left', async () => {
    const fixture = await create();
    await country(fixture, 'EG');
    await number(fixture, '01012345678');
    expect(fixture.componentInstance.value).toBe('+201012345678');
    expect(fixture.nativeElement.querySelector('.country-summary').textContent).toContain('🇪🇬');
    expect(fixture.nativeElement.querySelector('.country-summary').textContent).toContain('+20');
  });
  it('detects a pasted international number without duplicating its prefix', async () => {
    const fixture = await create();
    await country(fixture, 'EG');
    const input = await number(fixture, '+1 (202) 555-0123');
    expect(fixture.nativeElement.querySelector('select').value).toBe('US');
    expect(fixture.componentInstance.value).toBe('+12025550123');
    expect(input.value).not.toContain('+1');
  });
  it('restores existing values to country selection and national number', async () => {
    const fixture = await create('+442079460123');
    expect(fixture.nativeElement.querySelector('select').value).toBe('GB');
    expect(fixture.nativeElement.querySelector('input').value).toBe('020 7946 0123');
  });
  it('recomputes the canonical value when the selected country changes', async () => {
    const fixture = await create();
    await country(fixture, 'US');
    await number(fixture, '2025550123');
    await country(fixture, 'EG');
    expect(fixture.componentInstance.value).toBe('+202025550123');
  });
  it('retains an incomplete number while editing and explains country selection on blur', async () => {
    const fixture = await create();
    const input = await number(fixture, '01012345678');
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(fixture.componentInstance.value).toBe('');
    expect(input.value).toBe('01012345678');
    expect(fixture.nativeElement.textContent).toContain('Choose a country for this number');
    expect(input.getAttribute('aria-describedby')).toBe('phone-help test-phone-error');
  });
  it('propagates form disabled state to both country and number controls', async () => {
    const fixture = await create();
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const control = fixture.debugElement.query(By.directive(PhoneInput));
    expect(control.injector.get(NgModel).control.disabled).toBe(true);
    expect((control.componentInstance as PhoneInput).disabled()).toBe(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('input').disabled).toBe(true);
  });
  it('associates the parent label with a native tel input and provides a named keyboard-accessible select', async () => {
    const fixture = await create();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.id).toBe('test-phone');
    expect(input.autocomplete).toBe('tel-national');
    expect(fixture.nativeElement.querySelector('select').getAttribute('aria-label')).toBe(
      'Phone country',
    );
    expect(fixture.nativeElement.querySelector('option[value="EG"]').textContent.trim()).toMatch(
      /^Egypt \(\+20\)/,
    );
  });
});
