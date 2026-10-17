import { esc } from '../lib/dom.js';
import { BRAND } from '../config.js';

export function logoMark(size = 40, dark = false) {
  const crate = dark ? '#FAF7F0' : '#2D5016';
  const coin = '#8FBF5A';
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${esc(BRAND.name)}"><rect x="14" y="14" width="34" height="34" fill="${crate}"/><rect x="52" y="14" width="34" height="34" fill="${crate}"/><rect x="14" y="52" width="34" height="34" fill="${crate}"/><circle cx="69" cy="69" r="17" fill="${coin}"/></svg>`;
}

export const wordmark = (size = 20, sub = true) =>
  `<span class="wm"><b style="font-size:${size}px">Ludek<i> Market</i></b>${sub ? `<small>${esc(BRAND.campus)}</small>` : ''}</span>`;
