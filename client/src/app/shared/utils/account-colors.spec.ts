import { accountColor } from '../../../../../shared/account-color.mjs';
import { avatarInk, nameInk, personColor } from './account-colors';

function luminance(hex: string): number {
  const rgb = [1, 3, 5]
    .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
describe('permanent account colors', () => {
  it('uses the same account-ID algorithm as the server', () => {
    expect(accountColor('1234567890abcdef12345678')).toBe('#a5c5e6');
    expect(personColor('1234567890abcdef12345678')).toBe('#a5c5e6');
    expect(personColor('1234567890abcdef12345678', '#48e695')).toBe('#48e695');
  });
  it('handles unavailable/deleted accounts without hashing a display name', () => {
    expect(personColor('')).toBe('#e6e6e6');
    expect(personColor('1234567890abcdef12345678', 'invalid')).toBe('#a5c5e6');
  });
  it.each(['#e6e600', '#00e600', '#0000e6', '#e60000', '#e6e6e6', '#48e695'])(
    'keeps avatar initials and username text readable for %s',
    (color) => {
      expect(contrast(color, avatarInk(color))).toBeGreaterThanOrEqual(4.5);
      expect(contrast('#e8eddf', nameInk(color))).toBeGreaterThanOrEqual(4.5);
      expect(contrast('#fffefa', nameInk(color))).toBeGreaterThanOrEqual(4.5);
      for (const surface of ['#141917', '#1b211e', '#242d27', '#2a3b30']) {
        expect(contrast(surface, nameInk(color, true))).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
