import { h, esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { store } from '../lib/store.js';
import { initials, naira } from '../lib/format.js';

export const thumb = (url, width = 520) =>
  url && url.includes('res.cloudinary.com') && url.includes('/upload/')
    ? url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`)
    : url;

const shortName = name => {
  const parts = String(name || '').trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0] || '';
};

const rating = seller =>
  seller?.ratingCount
    ? `<span class="lc-rate" title="Seller rating"><b>★</b> ${Number(seller.rating).toFixed(1)} <i>(${seller.ratingCount})</i></span>`
    : '<span class="lc-rate lc-new">New seller</span>';

export const listingCard = listing => {
  const cover = listing.images?.[0];
  const saved = store.get().favs.has(listing.id);
  const name = listing.seller?.storeName || listing.seller?.fullName || '';
  return h`
    <article class="lc">
      <a class="lc-media" href="/product/${esc(listing.id)}">
        ${cover ? `<img src="${esc(thumb(cover))}" alt="${esc(listing.title)}" loading="lazy">` : '<div class="ph">Photo</div>'}
        ${listing.seller?.verified ? '<span class="tag-g">Verified</span>' : ''}
        ${listing.status === 'sold' ? '<span class="tag-g tag-b">Sold</span>' : ''}
      </a>
      <button class="heart ${saved ? 'on' : ''}" data-heart="${esc(listing.id)}" aria-label="Save listing">${icon('heart', 18)}</button>
      <a class="lc-body" href="/product/${esc(listing.id)}">
        <b class="lc-price">${naira(listing.price)}</b>
        <span class="lc-title">${esc(listing.title)}</span>
        ${rating(listing.seller)}
        <span class="lc-seller"><i>${esc(initials(name))}</i>${esc(shortName(name))}</span>
      </a>
    </article>`;
};

export const skeletonCards = (count = 6) =>
  Array.from({ length: count }, () => '<div class="lc lc-sk" aria-hidden="true"><div class="lc-media sk"></div><div class="lc-body"><i class="sk" style="width:55%"></i><i class="sk" style="width:85%"></i><i class="sk" style="width:40%"></i></div></div>').join('');
