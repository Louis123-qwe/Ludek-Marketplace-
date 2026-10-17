import { h, esc, on, confirmDialog, openModal, setBusy, toast, debounce } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { listings } from '../api/listings.js';
import { thumb } from '../components/listing-card.js';
import { topbar } from '../components/bits.js';
import { emptyState, errorState, statusChip, spinner } from '../components/ui.js';
import { naira, timeAgo } from '../lib/format.js';
import { setTitle } from '../router.js';

const TABS = [['', 'All'], ['active', 'Active'], ['pending', 'Pending'], ['draft', 'Drafts'], ['sold', 'Sold']];

export default function myListings(root) {
  setTitle('My listings');
  const state = { status: '', q: '', items: [], counts: {} };
  let token = 0;

  root.innerHTML = h`
    ${topbar({ title: 'My listings', sub: 'Edit, mark sold or remove', right: `<a class="gbtn gbtn-p" href="/add-listing" aria-label="New listing">${icon('plus', 20)}</a>` })}
    <section class="pad">
      <div class="tabs2" id="tabs"></div>
      <label class="search3">${icon('search', 18)}<input id="q" type="search" placeholder="Search your listings" aria-label="Search your listings"></label>
      <div id="list" class="stack2"></div>
    </section>`;
  const list = root.querySelector('#list');

  const drawTabs = () => {
    root.querySelector('#tabs').innerHTML = TABS.map(([value, label]) => {
      const count = value ? state.counts[value] : state.counts.all;
      return `<button class="${state.status === value ? 'on' : ''}" data-tab="${value}">${label}${count !== undefined ? ` <i>${count}</i>` : ''}</button>`;
    }).join('');
  };

  const row = item => h`
    <div class="mr card2" data-id="${esc(item.id)}">
      <div class="mr-top">
        <a class="mr-t" href="/product/${esc(item.id)}">${item.images?.[0] ? `<img src="${esc(thumb(item.images[0], 160))}" alt="">` : 'Photo'}</a>
        <div class="mr-m"><a href="/product/${esc(item.id)}"><b>${esc(item.title)}</b></a><strong>${naira(item.price)}</strong>
          <small><span>${icon('eye', 14)}${item.views || 0}</span><span>${icon('chat', 14)}${item.chatTaps || 0}</span><span>${timeAgo(item.createdAt)}</span></small></div>
        ${statusChip(item.status)}
      </div>
      <div class="mr-act">
        <a class="bt bt-ghost bt-xs" href="/listing/${esc(item.id)}/edit">${icon('edit', 15)}Edit</a>
        ${item.status === 'active' ? '<button class="bt bt-ghost bt-xs" data-act="sold">Mark sold</button>' : ''}
        ${item.status === 'draft' ? '<button class="bt bt-primary bt-xs" data-act="active">Publish</button>' : ''}
        ${item.status === 'sold' ? '<button class="bt bt-ghost bt-xs" data-act="active">Relist</button>' : ''}
        <button class="bt-trash" data-act="delete" aria-label="Delete">${icon('trash', 17)}</button>
      </div>
    </div>`;

  async function load() {
    const run = ++token;
    list.innerHTML = `<div class="center">${spinner()}</div>`;
    try {
      const result = await listings.mine({ status: state.status, q: state.q, limit: 50 });
      if (run !== token) return;
      state.items = result.items;
      if (result.counts) state.counts = result.counts;
      drawTabs();
      list.innerHTML = state.items.length ? state.items.map(row).join('') : emptyState({ icon: 'box', title: state.q || state.status ? 'Nothing matches' : 'No listings yet', text: state.q || state.status ? 'Try another tab or search.' : 'Post your first item to start selling.', action: state.q || state.status ? '' : '<a class="bt bt-primary bt-sm" href="/add-listing">Post a listing</a>' });
    } catch (error) {
      if (run !== token) return;
      list.innerHTML = errorState(error.message);
    }
  }

  on(root, 'click', '[data-tab]', (event, tab) => { state.status = tab.dataset.tab; load(); });
  on(root, 'click', '[data-retry]', load);

  on(root, 'click', '[data-act]', async (event, button) => {
    const id = button.closest('[data-id]').dataset.id;
    const item = state.items.find(entry => entry.id === id);
    const act = button.dataset.act;
    try {
      if (act === 'delete') {
        const ok = await confirmDialog({ title: 'Delete this listing?', message: `"${item.title}" will be removed for good.`, confirmText: 'Delete', danger: true });
        if (!ok) return;
        await listings.remove(id);
        toast('Listing deleted', 'success');
        load();
      } else if (act === 'sold') {
        const modal = openModal({
          title: 'Mark as sold',
          body: '<div class="fld"><label for="buyer">Who bought it? (optional)</label><input class="in" id="buyer" maxlength="60" placeholder="Buyer name"></div>',
          actions: [
            { label: 'Cancel', kind: 'ghost', onClick: () => modal.close() },
            {
              label: 'Mark sold',
              kind: 'primary',
              onClick: async (e, btn) => {
                setBusy(btn, true, 'Saving');
                try {
                  await listings.update(id, { status: 'sold', buyerName: modal.body.querySelector('#buyer').value.trim() });
                  toast('Marked as sold', 'success');
                  modal.close();
                  load();
                } catch (error) {
                  toast(error.message, 'error');
                  setBusy(btn, false);
                }
              }
            }
          ]
        });
      } else {
        await listings.update(id, { status: act });
        toast(act === 'active' ? 'Listing is live' : 'Updated', 'success');
        load();
      }
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  root.querySelector('#q').addEventListener('input', debounce(event => { state.q = event.target.value.trim(); load(); }, 350));
  drawTabs();
  load();
}
