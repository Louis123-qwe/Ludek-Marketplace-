import { h, esc, openModal } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { store } from '../lib/store.js';
import { misc } from '../api/misc.js';
import { timeAgo } from '../lib/format.js';
import { emptyState, errorState, spinner } from './ui.js';

export async function refreshUnread() {
  try {
    const { count } = await misc.notifications.unread();
    store.set({ unread: count || 0 });
  } catch {
    store.set({ unread: 0 });
  }
}

export async function openNotifications() {
  const modal = openModal({ title: 'Notifications', body: `<div class="center pad">${spinner()}</div>` });
  try {
    const { items } = await misc.notifications.list();
    modal.body.innerHTML = items.length
      ? h`<ul class="notes">${items.map(item => h`
          <li class="note ${item.read ? '' : 'unread'}">
            <span class="note-icon">${icon('megaphone', 18)}</span>
            <div>
              ${item.link ? `<a href="${esc(item.link)}" data-close>${esc(item.title)}</a>` : `<b>${esc(item.title)}</b>`}
              <p>${esc(item.message)}</p>
              <small>${timeAgo(item.createdAt)}</small>
            </div>
          </li>`)}</ul>`
      : emptyState({ icon: 'bell', title: 'Nothing new', text: 'Updates from Ludek Market will show up here.' });
    if (store.get().unread) {
      await misc.notifications.markRead().catch(() => null);
      store.set({ unread: 0 });
    }
  } catch (error) {
    modal.body.innerHTML = errorState(error.message, false);
  }
}
