import { esc } from '../lib/dom.js';
import { BRAND } from '../config.js';

const AWNING = 'M16 10H84L94 36A11 11 0 0 1 72 36A11 11 0 0 1 50 36A11 11 0 0 1 28 36A11 11 0 0 1 6 36Z';
const BODY = 'M14 52H86V92H14Z M38 84V72A12 12 0 0 1 62 72V84Z';
const stripes = color =>
  `<path d="M33 10H50V50H28V36Z" fill="${color}"/><path d="M67 10H84L94 36V50H72V36Z" fill="${color}"/>`;

export function logoMark(size = 40, dark = false) {
  const awning = dark ? '#FAF7F0' : '#2D5016';
  const stripe = dark ? '#8FBF5A' : '#8FBF5A';
  const body = dark ? '#FAF7F0' : '#2D5016';
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${esc(BRAND.name)}"><defs><clipPath id="lmA"><path d="${AWNING}"/></clipPath></defs><path d="${AWNING}" fill="${awning}"/><g clip-path="url(#lmA)">${stripes(stripe)}</g><path fill-rule="evenodd" d="${BODY}" fill="${body}"/></svg>`;
}

export const wordmark = (size = 20, sub = true) =>
  `<span class="wm"><b style="font-size:${size}px">Ludek<i> Market</i></b>${sub ? `<small>${esc(BRAND.campus)}</small>` : ''}</span>`;
