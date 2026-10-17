import { productSeo } from '../lib/seo.js';
import { h, esc, on, openModal, setBusy, toast } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { store } from '../lib/store.js';
import { listings } from '../api/listings.js';
import { users } from '../api/users.js';
import { misc } from '../api/misc.js';
import { categoryName } from '../lib/categories.js';
import { listingCard, thumb } from '../components/listing-card.js';
import { bindBack } from '../components/bits.js';
import { avatar, emptyState, stars } from '../components/ui.js';
import { REPORT_REASONS } from '../config.js';
import { conditionLabel, naira, timeAgo, waLink } from '../lib/format.js';
import { navigate, setTitle } from '../router.js';

export default async function product(root, ctx) {
  const id = ctx.params.id;
  let listing;
  try {
    listing = await listings.get(id);
  } catch (error) {
    if (error.status !== 404) throw error;
    root.innerHTML = `<div class="pad">${emptyState({ icon: 'search', title: 'Listing not found', text: 'It may have been removed by the seller.', action: '<a class="bt bt-primary bt-sm" href="/browse">Browse listings</a>' })}</div>`;
    return;
  }

  productSeo(listing);
  const seller = listing.seller || {};
  const images = listing.images || [];
  const sold = listing.status === 'sold';
  const phone = listing.whatsapp || seller.whatsapp;
  const profile = store.get().profile;
  const isOwner = Boolean(profile && profile.id === listing.sellerId);
  const saved = store.get().favs.has(listing.id);
  let index = 0;

  root.innerHTML = h`
    <div class="pd">
      <div class="pd-gal" id="gal">
        ${images.length ? `<img id="gImg" src="${esc(thumb(images[0], 1100))}" alt="${esc(listing.title)}">` : '<div class="ph ph-xl">Photo</div>'}
        <div class="pd-tools">
          <button class="gbtn glass" data-back aria-label="Back">${icon('chevron-left', 20)}</button>
          <span>
            <button class="gbtn glass" id="shareBtn" aria-label="Share">${icon('share', 20)}</button>
            ${isOwner ? '' : `<button class="gbtn glass" id="reportBtn" aria-label="Report">${icon('flag', 20)}</button>`}
            <button class="gbtn glass heart ${saved ? 'on' : ''}" data-heart="${esc(listing.id)}" aria-label="Save">${icon('heart', 20)}</button>
          </span>
        </div>
        ${images.length > 1 ? `<span class="tag-g pd-count" id="gCount">1 / ${images.length}</span><span class="pd-dots glass" id="gDots">${images.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</span>` : ''}
        ${sold ? '<span class="tag-g tag-b pd-sold">Sold</span>' : ''}
      </div>
      <div class="pd-sheet">
        <div class="pd-tags"><a class="chip-t" href="/browse?category=${esc(listing.category)}">${esc(categoryName(listing.category))}</a>${conditionLabel(listing.condition) ? `<span class="chip-o">${esc(conditionLabel(listing.condition))}</span>` : ''}</div>
        <h1>${esc(listing.title)}</h1>
        <div class="pd-price"><b>${naira(listing.price)}</b>${listing.negotiable ? '<span class="chip-d">Negotiable</span>' : ''}</div>
        <ul class="pd-meta"><li>${icon('pin', 16)}${esc(listing.location || 'On campus')}</li><li>${icon('clock', 16)}Posted ${timeAgo(listing.createdAt)}</li><li>${icon('eye', 16)}${Number(listing.views || 0).toLocaleString()} views</li></ul>
        <a class="pd-seller glass" href="/seller/${esc(listing.sellerId)}">
          ${avatar(seller, 52)}
          <span><b>${esc(seller.storeName || seller.fullName || 'Seller')}${seller.verified ? `<i class="vf">${icon('shield', 17)}</i>` : ''}</b><small>${seller.ratingCount ? stars(seller.rating, seller.ratingCount) : 'No reviews yet'}</small></span>
          ${icon('chevron-right', 20)}
        </a>
        <h2>Description</h2>
        <p class="pd-desc">${esc(listing.description || 'The seller has not added a description.')}</p>
        <div class="pd-note">${icon('shield', 20)}<p>Meet on campus, inspect the item and pay only after you are happy with it.</p></div>
        <section id="reviews"></section>
        <section id="related" hidden><h2>More in ${esc(categoryName(listing.category))}</h2><div class="grid2" id="relatedGrid"></div></section>
      </div>
      <div class="pd-bar glass">
        ${isOwner
          ? `<a class="bt bt-primary" href="/listing/${esc(listing.id)}/edit">${icon('edit', 20)}Edit listing</a>`
          : sold || !phone
            ? `<button class="bt bt-primary" disabled>${sold ? 'This item is sold' : 'No contact number'}</button>`
            : `<button class="bt bt-primary" id="chatBtn">${icon('chat', 22)}Chat on WhatsApp</button>`}
      </div>
    </div>`;

  bindBack(root);

  const show = next => {
    if (!images.length) return;
    index = (next + images.length) % images.length;
    root.querySelector('#gImg').src = thumb(images[index], 1100);
    root.querySelector('#gCount') && (root.querySelector('#gCount').textContent = `${index + 1} / ${images.length}`);
    root.querySelectorAll('#gDots i').forEach((dot, i) => dot.classList.toggle('on', i === index));
  };

  let startX = 0;
  const gal = root.querySelector('#gal');
  gal.addEventListener('touchstart', event => (startX = event.changedTouches[0].clientX), { passive: true });
  gal.addEventListener('touchend', event => {
    const delta = event.changedTouches[0].clientX - startX;
    if (Math.abs(delta) > 45) show(index + (delta < 0 ? 1 : -1));
  });
  gal.addEventListener('click', event => {
    if (event.target.closest('button') || !images.length) return;
    openModal({ title: listing.title, wide: true, body: `<img class="lightbox" src="${esc(images[index])}" alt="${esc(listing.title)}">` });
  });

  root.querySelector('#chatBtn')?.addEventListener('click', () => {
    listings.chatTap(listing.id).catch(() => null);
    const first = (seller.fullName || '').split(' ')[0] || 'there';
    window.open(waLink(phone, `Hi ${first}, I'm interested in "${listing.title}" (${naira(listing.price)}) on Ludek Market. Is it still available?`), '_blank', 'noopener');
  });

  root.querySelector('#shareBtn').addEventListener('click', async () => {
    if (navigator.share) {
      navigator.share({ title: listing.title, text: `${listing.title} for ${naira(listing.price)} on Ludek Market`, url: location.href }).catch(() => null);
      return;
    }
    await navigator.clipboard?.writeText(location.href).catch(() => null);
    toast('Link copied', 'success');
  });

  root.querySelector('#reportBtn')?.addEventListener('click', () => {
    if (!profile) {
      navigate(`/auth?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    const modal = openModal({
      title: 'Report this listing',
      body: h`<div class="stack2"><div class="fld"><label for="rReason">Reason</label><select class="in" id="rReason">${REPORT_REASONS.map(r => `<option>${r}</option>`)}</select></div>
        <div class="fld"><label for="rDetails">Details (optional)</label><textarea class="in ta" id="rDetails" maxlength="500" placeholder="Tell us what is wrong"></textarea></div></div>`,
      actions: [
        { label: 'Cancel', kind: 'ghost', onClick: () => modal.close() },
        {
          label: 'Send report',
          kind: 'danger',
          onClick: async (event, button) => {
            setBusy(button, true, 'Sending');
            try {
              await misc.reports.create({ targetType: 'listing', targetId: listing.id, targetName: listing.title, reason: modal.body.querySelector('#rReason').value, details: modal.body.querySelector('#rDetails').value.trim() });
              toast('Report sent. Thank you.', 'success');
              modal.close();
            } catch (error) {
              toast(error.message, 'error');
              setBusy(button, false);
            }
          }
        }
      ]
    });
  });

  if (!sessionStorage.getItem(`viewed:${listing.id}`) && !isOwner) {
    sessionStorage.setItem(`viewed:${listing.id}`, '1');
    listings.view(listing.id).catch(() => null);
  }

  async function loadReviews() {
    const el = root.querySelector('#reviews');
    let data;
    try {
      data = await users.reviews(listing.sellerId);
    } catch {
      el.remove();
      return;
    }
    el.innerHTML = h`
      <div class="sec-h"><h2>Seller reviews</h2><span>${data.count ? stars(data.rating, data.count) : '<span class="muted">No reviews yet</span>'}</span></div>
      ${profile && !isOwner ? h`
        <form class="rv-form card2" id="reviewForm">
          <div class="star-input" role="radiogroup" aria-label="Your rating">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-star="${n}" aria-label="${n} stars">★</button>`)}</div>
          <textarea class="in ta" name="comment" maxlength="400" placeholder="How was your experience with this seller?"></textarea>
          <button class="bt bt-primary bt-sm" type="submit">Post review</button>
        </form>` : ''}
      <ul class="reviews">${data.items.map(r => `<li>${avatar(r.reviewer, 40)}<div><b>${esc(r.reviewer?.fullName || 'Student')}</b><span>${stars(r.rating)}</span>${r.comment ? `<p>${esc(r.comment)}</p>` : ''}<small>${timeAgo(r.createdAt)}</small></div></li>`).join('')}</ul>`;
    const form = el.querySelector('#reviewForm');
    if (!form) return;
    let rating = 0;
    on(form, 'click', '[data-star]', (event, star) => {
      rating = Number(star.dataset.star);
      form.querySelectorAll('[data-star]').forEach(s => s.classList.toggle('on', Number(s.dataset.star) <= rating));
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!rating) return toast('Pick a star rating first.', 'error');
      const button = form.querySelector('button[type="submit"]');
      setBusy(button, true, 'Posting');
      try {
        await users.addReview(listing.sellerId, { rating, comment: form.comment.value.trim(), listingId: listing.id });
        toast('Review posted', 'success');
        loadReviews();
      } catch (error) {
        toast(error.message, 'error');
        setBusy(button, false);
      }
    });
  }

  loadReviews();
  listings
    .list({ category: listing.category, limit: 5 })
    .then(result => {
      const items = result.items.filter(item => item.id !== listing.id).slice(0, 4);
      if (!items.length) return;
      root.querySelector('#related').hidden = false;
      root.querySelector('#relatedGrid').innerHTML = items.map(listingCard).join('');
    })
    .catch(() => null);
}
