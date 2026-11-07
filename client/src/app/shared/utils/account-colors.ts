import { accountColor } from '../../../../../shared/account-color.mjs';

export function personColor(id: string, stored?: string): string {
  return stored && /^#[\da-f]{6}$/i.test(stored) ? stored : accountColor(id);
}

function channels(color: string): number[] {
  return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
}

function luminance(rgb: number[]): number {
  const linear = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

export function avatarInk(color: string): string {
  const light = luminance(channels(color));
  if ((light + 0.05) / (luminance(channels('#171717')) + 0.05) >= 4.5) return '#171717';
  return (light + 0.05) / 0.05 >= 4.5 ? '#000000' : '#ffffff';
}

// Adjust the displayed ink, never the saved color. Test against the selected
// row: the darkest light-mode / brightest dark-mode username surface.
export function nameInk(color: string, dark = false): string {
  const background = luminance(channels(dark ? '#2a3b30' : '#e8eddf'));
  let rgb = channels(color);
  const contrast = () =>
    (Math.max(background, luminance(rgb)) + 0.05) / (Math.min(background, luminance(rgb)) + 0.05);
  while (contrast() < 4.5) {
    rgb = rgb.map((channel) =>
      dark ? Math.ceil(channel + (255 - channel) * 0.1) : Math.floor(channel * 0.9),
    );
  }
  return '#' + rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('');
}
