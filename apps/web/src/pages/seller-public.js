import { sellerSeo } from '../lib/seo.js';
import { h, esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { users } from '../api/users.js';
import { listings } from '../api/listings.js';
import { listingCard } from '../components/listing-card.js';
import { bindBack } from '../components/bits.js';
import { avatar, emptyState, stars } from '../components/ui.js';
import { plural, shortDate, timeAgo, waLink } from '../lib/format.js';
import { setTitle } from '../router.js';

export default async function sellerPublic(root, ctx) {
  const id = ctx.params.id;
  let seller;
  try {
    seller = await users.publicProfile(id);
  } catch (error) {
    if (error.status !== 404) throw error;
    root.innerHTML = `<div class="pad">${emptyState({ icon: 'user', title: 'Seller not found', text: 'This profile does not exist or is no longer available.', action: '<a class="bt bt-primary bt-sm" href="/browse">Browse listings</a>' })}</div>`;
    return;
  }
  const name = seller.storeName || seller.fullName;
  sellerSeo(seller, name);

  const [items, reviews] = await Promise.all([
    listings.list({ seller: id, limit: 24 }).catch(() => ({ items: [] })),
    users.reviews(id).catch(() => ({ items: [], count: 0, rating: 0 }))
  ]);

  const facts = [
    seller.department && ['book', seller.department],
    seller.level && ['cap', `${seller.level} level`],
    ['clock', `Joined ${shortDate(seller.createdAt)}`]
  ].filter(Boolean);

  root.innerHTML = h`
    <div class="sp-banner" ${seller.bannerUrl ? `style="background-image:url('${esc(seller.bannerUrl)}')"` : ''}>
      <button class="gbtn glass" data-back aria-label="Back">${icon('chevron-left', 20)}</button>
    </div>
    <section class="pad sp-body">
      <div class="sp-av">${avatar(seller, 96)}</div>
      <h1 class="sp-name">${esc(name)}${seller.verified ? `<i class="vf">${icon('shield', 22)}</i>` : ''}</h1>
      ${seller.storeName ? `<p class="muted">${esc(seller.fullName)}</p>` : ''}
      <p class="sp-rate">${reviews.count ? stars(reviews.rating, reviews.count) : '<span class="muted">No reviews yet</span>'}</p>
      <div class="sp-cta">
        ${seller.whatsapp ? `<a class="bt bt-primary" href="${esc(waLink(seller.whatsapp, `Hi ${seller.fullName.split(' ')[0]}, I found your store on Ludek Market.`))}" target="_blank" rel="noopener">${icon('chat', 20)}Message</a>` : ''}
        ${seller.instagram ? `<a class="bt bt-ghost bt-icon" href="https://instagram.com/${esc(seller.instagram.replace('@', ''))}" target="_blank" rel="noopener" aria-label="Instagram">${icon('instagram', 22)}</a>` : ''}
      </div>
      <div class="card2 glass sp-about">${seller.bio ? `<p>${esc(seller.bio)}</p>` : ''}<ul class="pd-meta">${facts.map(([n, t]) => `<li>${icon(n, 16)}${esc(t)}</li>`)}</ul></div>
      <div class="sec-h"><h2>${plural(items.items.length, 'listing')}</h2></div>
      <div class="grid2">${items.items.length ? items.items.map(listingCard).join('') : `<div class="grid-span">${emptyState({ icon: 'box', title: 'Nothing listed right now', text: 'Check back soon.' })}</div>`}</div>
      <div class="sec-h"><h2>Reviews</h2></div>
      ${reviews.items.length ? `<ul class="reviews card2">${reviews.items.map(r => `<li>${avatar(r.reviewer, 40)}<div><b>${esc(r.reviewer?.fullName || 'Student')}</b><span>${stars(r.rating)}</span>${r.comment ? `<p>${esc(r.comment)}</p>` : ''}<small>${timeAgo(r.createdAt)}</small></div></li>`).join('')}</ul>` : '<p class="muted">This seller has no reviews yet.</p>'}
    </section>`;
  bindBack(root);
}
