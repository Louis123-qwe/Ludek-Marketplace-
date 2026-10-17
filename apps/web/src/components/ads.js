import { esc } from '../lib/dom.js';
import { misc } from '../api/misc.js';
import { thumb } from './listing-card.js';

export const AD_COLOURS = [
  ['forest', 'Forest', '#2D5016', '#FAF7F0'],
  ['pale', 'Pale green', '#C8DFB0', '#1E3810'],
  ['white', 'White', '#FFFFFF', '#1E3810'],
  ['orange', 'Orange', '#D4520A', '#FFFFFF'],
  ['gold', 'Gold', '#F4C542', '#2B1D00'],
  ['sky', 'Sky', '#CFE6F7', '#12344D'],
  ['rose', 'Rose', '#F7D6DC', '#5A1A2A'],
  ['night', 'Night', '#101A09', '#FAF7F0']
];

const contrast = hex => {
  const n = parseInt(hex.slice(1), 16);
  const brightness = (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255;
  return brightness > 0.6 ? '#1A1207' : '#FFFFFF';
};

export function adColours(bg) {
  const preset = AD_COLOURS.find(item => item[0] === bg);
  if (preset) return [preset[2], preset[3]];
  if (/^#[0-9a-f]{6}$/i.test(bg || '')) return [bg, contrast(bg)];
  return [AD_COLOURS[0][2], AD_COLOURS[0][3]];
}

export const adCard = ad => {
  const [background, foreground] = adColours(ad.bg);
  const image = /^https:\/\//.test(ad.imageUrl || '') ? ad.imageUrl : '';
  const layout = image ? (ad.layout === 'full' ? 'full' : 'side') : 'plain';
  const picture = image ? `<img class="ad-img" src="${esc(thumb(image, 900))}" alt="" loading="lazy">` : '';
  const inner = `${picture}<span class="tag-g">${esc(ad.tag || 'Sponsored')}</span><b>${esc(ad.title)}</b><p>${esc(ad.body)}</p><span class="ad-btn">${esc(ad.buttonText)}</span>`;
  const attrs = `class="ad ad-c ad-${layout}" style="--ad-bg:${esc(background)};--ad-fg:${esc(foreground)}"`;
  if (!ad.link) return `<div ${attrs}>${inner}</div>`;
  const external = ad.link.startsWith('http');
  return `<a ${attrs} href="${esc(ad.link)}" ${external ? 'target="_blank" rel="noopener"' : ''}>${inner}</a>`;
};

export async function mountAds(el) {
  if (!el) return () => {};
  let items = [];
  try {
    items = (await misc.ads()).items || [];
  } catch {
    items = [];
  }
  if (!items.length) {
    el.remove();
    return () => {};
  }
  el.innerHTML = `<div class="ads-view"><div class="ads-track">${items.map(adCard).join('')}</div></div><div class="ads-dots">${items.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>`;

  const track = el.querySelector('.ads-track');
  const dots = [...el.querySelectorAll('.ads-dots i')];
  let index = 0;

  const go = next => {
    index = (next + items.length) % items.length;
    const first = track.children[0];
    const step = first.offsetWidth + 12;
    track.style.transform = `translateX(${-index * step}px)`;
    dots.forEach((dot, i) => dot.classList.toggle('on', i === index));
  };

  let timer = items.length > 1 ? setInterval(() => go(index + 1), 4500) : null;
  let startX = 0;
  track.addEventListener('touchstart', event => {
    startX = event.changedTouches[0].clientX;
    clearInterval(timer);
  }, { passive: true });
  track.addEventListener('touchend', event => {
    const delta = event.changedTouches[0].clientX - startX;
    if (Math.abs(delta) > 40) go(index + (delta < 0 ? 1 : -1));
    if (items.length > 1) timer = setInterval(() => go(index + 1), 4500);
  });

  return () => clearInterval(timer);
}
