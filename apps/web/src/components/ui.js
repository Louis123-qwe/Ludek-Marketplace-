import { h, esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { initials } from '../lib/format.js';

const STATUS_LABELS = {
  active: 'Active',
  sold: 'Sold',
  draft: 'Draft',
  pending: 'Pending review',
  suspended: 'Suspended',
  open: 'Open',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
  customer: 'Buyer',
  seller: 'Seller',
  admin: 'Admin'
};

export const spinner = () => '<span class="spinner spinner-lg"></span>';

export const emptyState = ({ icon: name = 'box', title, text = '', action = '' }) => h`
  <div class="empty">
    <div class="empty-icon">${icon(name, 28)}</div>
    <h3>${esc(title)}</h3>
    ${text ? `<p>${esc(text)}</p>` : ''}
    ${action}
  </div>`;

export const errorState = (message, retry = true) => h`
  <div class="empty">
    <div class="empty-icon empty-icon-warn">${icon('alert', 28)}</div>
    <h3>Something went wrong</h3>
    <p>${esc(message)}</p>
    ${retry ? '<button class="btn btn-primary" data-retry>Try again</button>' : ''}
  </div>`;

export function avatar(user, size = 40) {
  const name = user?.fullName || user?.name || '';
  return user?.avatarUrl
    ? `<img class="avatar" style="--s:${size}px" src="${esc(user.avatarUrl)}" alt="" loading="lazy">`
    : `<span class="avatar avatar-text" style="--s:${size}px">${esc(initials(name))}</span>`;
}

export const statusChip = status =>
  `<span class="status status-${esc(status)}">${esc(STATUS_LABELS[status] || status)}</span>`;

export const stars = (rating = 0, count) => h`
  <span class="stars" role="img" aria-label="${Number(rating).toFixed(1)} out of 5">
    <span class="stars-base">★★★★★</span>
    <span class="stars-fill" style="width:${Math.min(100, (Number(rating) / 5) * 100)}%">★★★★★</span>
  </span>
  ${count !== undefined ? `<span class="stars-count">${Number(rating).toFixed(1)} (${count})</span>` : ''}`;

export const skeletonGrid = (count = 8) =>
  Array.from({ length: count }, () => `
    <div class="lcard lcard-skeleton" aria-hidden="true">
      <div class="lcard-media skeleton"></div>
      <div class="lcard-body"><div class="skeleton sk-line"></div><div class="skeleton sk-line sk-short"></div></div>
    </div>`).join('');

export const pager = (page, pages) =>
  pages > 1
    ? h`<div class="pager">
        <button class="btn btn-ghost btn-sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Previous</button>
        <span>Page ${page} of ${pages}</span>
        <button class="btn btn-ghost btn-sm" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Next</button>
      </div>`
    : '';
