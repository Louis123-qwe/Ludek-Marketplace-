import { h, esc, on, debounce, toast, confirmDialog } from '../../lib/dom.js';
import { icon } from '../../lib/icons.js';
import { admin } from '../../api/admin.js';
import { errorState, pager, spinner, statusChip } from '../../components/ui.js';
import { thumb } from '../../components/listing-card.js';
import { categoryName } from '../../lib/categories.js';
import { naira, timeAgo } from '../../lib/format.js';
import { adminHead, filterTabs, table } from './ui.js';

const STATUSES = [['', 'All'], ['pending', 'Pending'], ['active', 'Active'], ['sold', 'Sold'], ['draft', 'Drafts']];

export default function listings(root) {
  const state = { q: '', status: '', page: 1, pages: 1, items: [] };
  let token = 0;

  root.innerHTML = h`
    ${adminHead('Listings', 'Approve new items, feature the best ones and remove anything that breaks the rules.')}
    <div class="filters">
      <label class="search-box search-box-sm">${icon('search', 18)}<input id="q" type="search" placeholder="Search listings or sellers" aria-label="Search listings"></label>
      <div id="statusTabs"></div>
    </div>
    <div class="card" id="result"></div>`;

  const result = root.querySelector('#result');

  const columns = [
    {
      label: 'Listing',
      render: item => `
        <div class="cell-user">
          <span class="thumb">${item.images?.[0] ? `<img src="${esc(thumb(item.images[0], 100))}" alt="">` : icon('image', 18)}</span>
          <div><a href="/product/${esc(item.id)}"><b>${esc(item.title)}</b></a><small>${esc(categoryName(item.category))}</small></div>
        </div>`
    },
    { label: 'Seller', render: item => esc(item.seller?.fullName || '-') },
    { label: 'Price', render: item => naira(item.price) },
    { label: 'Status', render: item => statusChip(item.status) + (item.featured ? '<span class="badge badge-gold">Featured</span>' : '') },
    { label: 'Posted', render: item => timeAgo(item.createdAt) },
    {
      label: '',
      cls: 'cell-actions',
      render: item => `
        ${item.status === 'pending' ? '<button class="btn btn-primary btn-sm" data-act="approve">Approve</button>' : ''}
        <button class="btn btn-ghost btn-sm" data-act="feature">${item.featured ? 'Unfeature' : 'Feature'}</button>
        <button class="btn-icon danger" data-act="delete" aria-label="Delete">${icon('trash', 18)}</button>`
    }
  ];

  const drawTabs = () => (root.querySelector('#statusTabs').innerHTML = filterTabs(STATUSES, state.status, 'status'));

  async function load() {
    const run = ++token;
    result.innerHTML = `<div class="center pad">${spinner()}</div>`;
    try {
      const data = await admin.listings.list({ q: state.q, status: state.status, page: state.page, limit: 20 });
      if (run !== token) return;
      state.items = data.items;
      state.pages = data.pages || 1;
      result.innerHTML = table(columns, state.items, 'No listings match.') + pager(state.page, state.pages);
    } catch (error) {
      if (run !== token) return;
      result.innerHTML = errorState(error.message);
    }
  }

  async function run(action, message) {
    try {
      await action();
      toast(message, 'success');
      load();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  on(root, 'click', '[data-status]', (event, tab) => {
    state.status = tab.dataset.status;
    state.page = 1;
    drawTabs();
    load();
  });

  on(root, 'click', '[data-page]', (event, button) => {
    state.page = Number(button.dataset.page);
    load();
  });

  on(root, 'click', '[data-retry]', load);

  on(root, 'click', '[data-act]', async (event, button) => {
    const id = button.closest('tr').dataset.id;
    const item = state.items.find(entry => entry.id === id);
    const act = button.dataset.act;

    if (act === 'approve') run(() => admin.listings.update(id, { status: 'active' }), 'Listing approved');
    else if (act === 'feature') run(() => admin.listings.update(id, { featured: !item.featured }), item.featured ? 'Removed from featured' : 'Listing featured');
    else if (act === 'delete') {
      const ok = await confirmDialog({
        title: 'Delete this listing?',
        message: `"${item.title}" will be removed for good.`,
        confirmText: 'Delete',
        danger: true
      });
      if (ok) run(() => admin.listings.remove(id), 'Listing deleted');
    }
  });

  root.querySelector('#q').addEventListener(
    'input',
    debounce(event => {
      state.q = event.target.value.trim();
      state.page = 1;
      load();
    }, 350)
  );

  drawTabs();
  load();
}
