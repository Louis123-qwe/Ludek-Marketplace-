import { h, esc } from '../../lib/dom.js';
import { admin } from '../../api/admin.js';
import { avatar, statusChip } from '../../components/ui.js';
import { naira, timeAgo } from '../../lib/format.js';
import { adminHead, statCard } from './ui.js';

export default async function overview(root) {
  const data = await admin.overview();
  const s = data.stats || {};

  root.innerHTML = h`
    ${adminHead('Overview', 'A quick look at what is happening on Ludek Market.')}
    <div class="stat-grid stat-grid-lg">
      ${statCard('Members', Number(s.users || 0).toLocaleString())}
      ${statCard('Sellers', Number(s.sellers || 0).toLocaleString())}
      ${statCard('Active listings', Number(s.activeListings || 0).toLocaleString())}
      ${statCard('Awaiting review', Number(s.pendingListings || 0).toLocaleString(), s.pendingListings ? 'tone-warn' : '')}
      ${statCard('Open reports', Number(s.openReports || 0).toLocaleString(), s.openReports ? 'tone-danger' : '')}
      ${statCard('Views today', Number(s.viewsToday || 0).toLocaleString())}
    </div>

    <div class="two-col">
      <section class="card">
        <div class="section-head"><h3>Newest members</h3><a class="link" href="/admin/users">Manage</a></div>
        <ul class="rows">
          ${(data.recentUsers || []).map(user => `
            <li class="row-flat">
              ${avatar(user, 38)}
              <span class="row-main"><b>${esc(user.fullName)}</b><small>${esc(user.email)}</small></span>
              ${statusChip(user.role)}
            </li>`)}
        </ul>
      </section>
      <section class="card">
        <div class="section-head"><h3>Latest listings</h3><a class="link" href="/admin/listings">Manage</a></div>
        <ul class="rows">
          ${(data.recentListings || []).map(item => `
            <li class="row-flat">
              <span class="row-main"><a href="/product/${esc(item.id)}"><b>${esc(item.title)}</b></a><small>${naira(item.price)} · ${timeAgo(item.createdAt)}</small></span>
              ${statusChip(item.status)}
            </li>`)}
        </ul>
      </section>
    </div>`;
}
