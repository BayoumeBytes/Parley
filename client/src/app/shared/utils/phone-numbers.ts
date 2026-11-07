import {
  CountryCode,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js/min';

const names = new Intl.DisplayNames(['en'], { type: 'region' });
export const phoneCountries = getCountries()
  .map((code) => ({
    code,
    name: names.of(code) ?? code,
    callingCode: getCountryCallingCode(code),
    flag: String.fromCodePoint(...[...code].map((letter) => 127397 + letter.charCodeAt(0))),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function internationalPhone(country: CountryCode | '', national: string): string {
  if (!country || !national.trim()) return '';
  const number = parsePhoneNumberFromString(national, { defaultCountry: country, extract: false });
  return number?.isPossible() && number.countryCallingCode === getCountryCallingCode(country)
    ? number.number
    : '';
}
