import { h, esc, on } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { store } from '../lib/store.js';
import { listings } from '../api/listings.js';
import { misc } from '../api/misc.js';
import { categories } from '../lib/categories.js';
import { listingCard, thumb } from '../components/listing-card.js';
import { mountStrip } from '../components/strip.js';
import { mountAds } from '../components/ads.js';
import { logoMark, wordmark } from '../components/brand.js';
import { initials, naira, splitName, timeAgo } from '../lib/format.js';
import { avatar } from '../components/ui.js';
import { navigate, setTitle } from '../router.js';

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

function header(profile, unread) {
  const right = profile
    ? h`<a class="gbtn bell" href="/notifications" aria-label="Notifications">${icon('bell', 20)}${unread ? '<i class="dotbadge"></i>' : ''}</a><a class="avatar-s" href="/dashboard" aria-label="Your account">${esc(initials(profile.fullName))}</a>`
    : '<a class="bt bt-primary bt-sm" href="/auth">Log in</a>';
  return h`<header class="tb glass tb-home"><a class="brandlock" href="/">${logoMark(44)}${wordmark(21)}</a><div class="tb-r">${right}</div></header>`;
}

export default async function home(root) {
  const { profile, unread } = store.get();
  if (!profile && !localStorage.getItem('ludek_intro')) {
    navigate('/welcome', { replace: true });
    return;
  }
  setTitle();
  const cleanups = [];
  const cats = categories();

  root.innerHTML = h`
    ${header(profile, unread)}
    <div class="strip" id="strip"></div>
    <section class="pad">
      <p class="hm-hello">${profile ? `${greeting()}, ${esc(splitName(profile.fullName).firstName)}` : 'Welcome to Ludek Market'}</p>
      <h1 class="hm-h1">What are you<br>looking for?</h1>
      <form class="search2" id="search" role="search">
        <label>${icon('search', 20)}<input name="q" placeholder="Search phones, books, hostels" aria-label="Search listings" autocomplete="off"></label>
        <a class="search2-f" href="/browse" aria-label="Filters">${icon('sliders', 22)}</a>
      </form>
      <div class="pills">
        <a class="pill on" href="/browse">All</a>
        ${cats.slice(0, 5).map(cat => `<a class="pill" href="/browse?category=${esc(cat.slug)}">${esc(cat.name)}</a>`)}
      </div>
      <div class="sec-h"><h2>Shop by category</h2><a href="/browse">See all</a></div>
      <div class="cat4">
        ${cats.slice(0, 7).map((cat, i) => `<a class="cat-t" href="/browse?category=${esc(cat.slug)}"><span class="cat-ph t${i}">${cat.imageUrl ? `<img src="${esc(thumb(cat.imageUrl, 240))}" alt="" loading="lazy">` : 'Photo'}</span><b>${esc(cat.name)}</b></a>`)}
        <a class="cat-t" href="/browse"><span class="cat-ph t7">${icon('grid', 26)}</span><b>More</b></a>
      </div>
      <div class="ads" id="ads"></div>
      <section class="card2 sales" id="sales" hidden></section>
      <section id="popular" hidden>
        <div class="sec-h"><h2>Popular right now</h2><a href="/browse?sort=popular">See all</a></div>
        <div class="hscroll" id="popularRow"></div>
      </section>
      <section id="sellers" hidden>
        <div class="sec-h"><h2>Top sellers</h2></div>
        <div class="hscroll hs-sellers" id="sellerRow"></div>
      </section>
      <div class="sec-h"><h2>Fresh on campus</h2><a href="/browse">See all</a></div>
      <div class="grid2" id="fresh"><div class="lc lc-sk"><div class="lc-media sk"></div></div><div class="lc lc-sk"><div class="lc-media sk"></div></div></div>
      <div class="sec-h"><h2>How it works</h2></div>
      <ol class="how">
        <li><span>${icon('search', 22)}</span><b>Find it</b><small>Browse or search what students are selling.</small></li>
        <li><span>${icon('chat', 22)}</span><b>Chat</b><small>Message the seller on WhatsApp to agree.</small></li>
        <li><span>${icon('shield', 22)}</span><b>Meet safely</b><small>Meet on campus and pay after you inspect.</small></li>
      </ol>
      <a class="sellcta" href="${profile ? '/add-listing' : '/auth?mode=signup&role=seller'}">
        <span><b>Got something to sell?</b><small>Post it in a minute. It is free.</small></span>
        <i>${icon('plus', 22)}</i>
      </a>
    </section>`;

  root.querySelector('#search').addEventListener('submit', event => {
    event.preventDefault();
    const q = new FormData(event.target).get('q').toString().trim();
    navigate(q ? `/browse?q=${encodeURIComponent(q)}` : '/browse');
  });

  mountStrip(root.querySelector('#strip'));
  mountAds(root.querySelector('#ads')).then(stop => cleanups.push(stop));

  misc
    .recentSales()
    .then(({ items }) => {
      if (!items.length) return;
      const el = root.querySelector('#sales');
      el.hidden = false;
      el.innerHTML = h`
        <div class="sales-h"><b>Recent sales</b><span><i class="live"></i>Live</span></div>
        ${items.slice(0, 4).map(sale => `
          <div class="sr">
            <span class="sr-i">${icon('check', 20)}</span>
            <div class="sr-m"><b>${esc(sale.title)}</b><small>${sale.buyerName ? `${esc(sale.sellerName)} to ${esc(sale.buyerName)}` : `Sold by ${esc(sale.sellerName)}`}</small></div>
            <div class="sr-r"><b>${naira(sale.price)}</b><em class="blink">${esc(timeAgo(sale.at))}</em></div>
          </div>`)}`;
    })
    .catch(() => null);

  listings
    .list({ sort: 'popular', limit: 10 })
    .then(({ items }) => {
      if (items.length >= 3) {
        root.querySelector('#popularRow').innerHTML = items.map(listingCard).join('');
        root.querySelector('#popular').hidden = false;
      }
      const seen = new Map();
      items.forEach(item => {
        const seller = item.seller;
        if (seller?.id && seller.ratingCount > 0 && !seen.has(seller.id)) seen.set(seller.id, seller);
      });
      const top = [...seen.values()].sort((a, b) => b.rating - a.rating).slice(0, 8);
      if (top.length >= 2) {
        root.querySelector('#sellerRow').innerHTML = top
          .map(seller => `<a class="sl" href="/seller/${esc(seller.id)}">${avatar(seller, 56)}<b>${esc((seller.storeName || seller.fullName || '').split(' ')[0])}</b><small>★ ${Number(seller.rating).toFixed(1)} (${seller.ratingCount})</small></a>`)
          .join('');
        root.querySelector('#sellers').hidden = false;
      }
    })
    .catch(() => null);

  listings
    .list({ sort: 'new', limit: 8 })
    .then(({ items }) => {
      root.querySelector('#fresh').innerHTML = items.length
        ? items.map(listingCard).join('')
        : '<p class="muted pad-s">No listings yet. Be the first to post.</p>';
    })
    .catch(() => {
      root.querySelector('#fresh').innerHTML = '<p class="muted pad-s">Could not load listings.</p>';
    });

  return () => cleanups.forEach(stop => stop?.());
}
