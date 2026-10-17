import { h, esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { store } from '../lib/store.js';
import { users } from '../api/users.js';
import { listings } from '../api/listings.js';
import { topbar, gbtn, adminSwitch, bindAdminSwitch } from '../components/bits.js';
import { statusChip, stars, emptyState } from '../components/ui.js';
import { thumb } from '../components/listing-card.js';
import { compact, naira, splitName } from '../lib/format.js';
import { setTitle } from '../router.js';

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

const completeness = profile => {
  const checks = [['Add a profile photo', profile.avatarUrl], ['Add your store name', profile.storeName], ['Write a short bio', profile.bio], ['Add your WhatsApp number', profile.whatsapp], ['Add your department', profile.department]];
  const done = checks.filter(([, v]) => v).length;
  return { percent: Math.round((done / checks.length) * 100), next: checks.find(([, v]) => !v)?.[0] };
};

export default async function dashboard(root) {
  setTitle('Dashboard');
  const profile = store.get().profile;
  const [stats, recent] = await Promise.all([users.stats(), listings.mine({ limit: 4 }).catch(() => ({ items: [] }))]);
  const progress = completeness(profile);
  const cards = [['box', 'Active listings', stats.activeListings ?? 0], ['eye', 'Total views', compact(stats.totalViews ?? 0)], ['chat', 'WhatsApp taps', compact(stats.chatTaps ?? 0)], ['check', 'Sales recorded', stats.salesCount ?? stats.soldCount ?? 0]];

  root.innerHTML = h`
    ${topbar({ title: 'Dashboard', sub: `${greeting()}, ${splitName(profile.fullName).firstName}`, right: '<a class="gbtn" href="/notifications" aria-label="Notifications">' + icon('bell', 20) + '</a>' })}
    <section class="pad">
      <div class="grid2">${cards.map(([n, l, v]) => `<div class="stat2 card2"><span>${icon(n, 20)}</span><b>${v}</b><small>${l}</small></div>`)}</div>
      <div class="card2 stat-r"><span class="stat-ri">${icon('shield', 26)}</span><div><b>${stats.ratingCount ? Number(stats.rating).toFixed(1) : '-'}</b><small>${stats.ratingCount ? `${stars(stats.rating)} ${stats.ratingCount} reviews` : 'No reviews yet'}</small></div></div>
      ${progress.percent < 100 ? h`<div class="card2 glass nudge2"><div><b>Finish your profile</b><span>${progress.percent}%</span></div><div class="bar2"><i style="width:${progress.percent}%"></i></div><p>${esc(progress.next)} to help buyers trust you.</p><a class="bt bt-ghost bt-sm" href="/profile">Update profile</a></div>` : ''}
      <div class="card2">
        <div class="sec-h flat"><h2>Recent listings</h2><a href="/my-listings">View all</a></div>
        ${recent.items.length ? `<ul class="rl">${recent.items.map(item => `<li><a href="/product/${esc(item.id)}"><span class="rl-t">${item.images?.[0] ? `<img src="${esc(thumb(item.images[0], 120))}" alt="">` : 'Photo'}</span><span class="rl-m"><b>${esc(item.title)}</b><small>${naira(item.price)}</small></span>${statusChip(item.status)}</a></li>`).join('')}</ul>` : emptyState({ icon: 'box', title: 'No listings yet', text: 'Post your first item and start getting messages.', action: '<a class="bt bt-primary bt-sm" href="/add-listing">Post a listing</a>' })}
      </div>
      <a class="bt bt-primary" href="/add-listing">${icon('plus', 20)}New listing</a>
      ${profile.role === 'admin' ? `<div class="card2 adm-card"><div><b>Admin mode</b><small>Switch between the admin panel and the normal site.</small></div>${adminSwitch(profile)}</div>` : ''}
    </section>`;
  bindAdminSwitch(root);
}
