import { h, esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { misc } from '../api/misc.js';
import { naira, timeAgo } from '../lib/format.js';
import { thumb } from './listing-card.js';

function chip(item) {
  if (item.kind === 'product') {
    return h`<a class="sc sc-prod" href="/product/${esc(item.id)}">${item.image ? `<img src="${esc(thumb(item.image, 120))}" alt="">` : '<i class="sc-ph">Photo</i>'}<span>${esc(item.title)} <b>${naira(item.price)}</b></span></a>`;
  }
  if (item.kind === 'admin') {
    const inner = `${icon('megaphone', 17)}<span><b>Admin</b> ${esc(item.text)}</span>`;
    return item.link ? `<a class="sc sc-admin" href="${esc(item.link)}">${inner}</a>` : `<span class="sc sc-admin">${inner}</span>`;
  }
  return h`<span class="sc sc-sale"><i class="sc-tick">${icon('check', 14)}</i><span>Sold: ${esc(item.title)} <b>${naira(item.price)}</b></span><em class="blink">${timeAgo(item.at)}</em></span>`;
}

export async function mountStrip(el) {
  if (!el) return;
  let items = [];
  try {
    items = (await misc.feed()).items || [];
  } catch {
    items = [];
  }
  if (!items.length) {
    el.remove();
    return;
  }
  const row = items.map(chip).join('');
  el.innerHTML = `<div class="strip-live glass"><i class="live"></i>LIVE</div><div class="strip-view"><div class="strip-track" style="animation-duration:${Math.max(26, items.length * 7)}s"><div class="strip-row">${row}</div><div class="strip-row" aria-hidden="true">${row}</div></div></div>`;
}
