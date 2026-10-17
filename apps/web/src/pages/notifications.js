import { h, esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { store } from '../lib/store.js';
import { misc } from '../api/misc.js';
import { topbar, bindBack } from '../components/bits.js';
import { emptyState, errorState, spinner } from '../components/ui.js';
import { timeAgo } from '../lib/format.js';
import { setTitle } from '../router.js';

const iconFor = item => {
  const t = `${item.title}`.toLowerCase();
  if (t.includes('review')) return 'star';
  if (t.includes('verified')) return 'shield';
  if (t.includes('live') || t.includes('approved')) return 'check';
  if (t.includes('report')) return 'flag';
  return 'megaphone';
};

export default async function notifications(root) {
  setTitle('Notifications');
  root.innerHTML = h`${topbar({ title: 'Notifications', back: true, right: '<button class="gpill glass" id="readAll">Mark all read</button>' })}<section class="pad" id="body"><div class="center">${spinner()}</div></section>`;
  bindBack(root);
  const body = root.querySelector('#body');

  const card = item => h`
    <a class="nt ${item.read ? '' : 'new'}" ${item.link ? `href="${esc(item.link)}"` : ''}>
      <span class="nt-i">${icon(iconFor(item), 21)}</span>
      <div><div class="nt-t"><b>${esc(item.title)}</b>${item.read ? '' : '<i></i>'}</div><p>${esc(item.message)}</p><small>${timeAgo(item.createdAt)}</small></div>
    </a>`;

  try {
    const { items } = await misc.notifications.list();
    const fresh = items.filter(i => !i.read);
    const older = items.filter(i => i.read);
    body.innerHTML = items.length
      ? `${fresh.length ? `<p class="nt-g">New</p>${fresh.map(card).join('')}` : ''}${older.length ? `<p class="nt-g">Earlier</p>${older.map(card).join('')}` : ''}`
      : emptyState({ icon: 'bell', title: 'Nothing new', text: 'Updates from Ludek Market will show up here.' });
    root.querySelector('.tb-t').insertAdjacentHTML('beforeend', `<p>${fresh.length} new</p>`);
  } catch (error) {
    body.innerHTML = errorState(error.message, false);
  }

  root.querySelector('#readAll').addEventListener('click', async () => {
    await misc.notifications.markRead().catch(() => null);
    store.set({ unread: 0 });
    root.querySelectorAll('.nt.new').forEach(el => el.classList.remove('new'));
    root.querySelectorAll('.nt-t i').forEach(el => el.remove());
  });
}
