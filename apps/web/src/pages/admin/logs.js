import { h, esc, on } from '../../lib/dom.js';
import { admin } from '../../api/admin.js';
import { errorState, pager, spinner } from '../../components/ui.js';
import { shortDate, timeAgo } from '../../lib/format.js';
import { adminHead, table, filterTabs } from './ui.js';

export default function logs(root) {
  const state = { page: 1, pages: 1, kind: '' };
  let token = 0;

  root.innerHTML = h`
    ${adminHead('Activity log', 'Every admin action, newest first.')}
    <div class="filters"><div id="kindTabs"></div></div>
    <div class="card" id="result"></div>`;

  const result = root.querySelector('#result');

  const columns = [
    { label: 'Who', render: entry => `<b>${esc(entry.actor || 'System')}</b>${entry.kind === 'sale' ? '<span class="status status-active">Sale</span>' : ''}` },
    { label: 'Action', render: entry => esc(entry.action) },
    { label: 'Target', render: entry => esc(entry.target || '-') },
    { label: 'When', render: entry => `<span title="${esc(shortDate(entry.createdAt))}">${timeAgo(entry.createdAt)}</span>` }
  ];

  async function load() {
    const run = ++token;
    result.innerHTML = `<div class="center pad">${spinner()}</div>`;
    try {
      const data = await admin.logs({ kind: state.kind, page: state.page, limit: 30 });
      if (run !== token) return;
      state.pages = data.pages || 1;
      result.innerHTML = table(columns, data.items, 'No activity recorded yet.') + pager(state.page, state.pages);
    } catch (error) {
      if (run !== token) return;
      result.innerHTML = errorState(error.message);
    }
  }

  const drawKinds = () => (root.querySelector('#kindTabs').innerHTML = filterTabs([['', 'All'], ['sale', 'Sales'], ['admin', 'Admin']], state.kind, 'kind'));
  on(root, 'click', '[data-kind]', (event, tab) => {
    state.kind = tab.dataset.kind;
    state.page = 1;
    drawKinds();
    load();
  });
  drawKinds();
  on(root, 'click', '[data-page]', (event, button) => {
    state.page = Number(button.dataset.page);
    load();
  });

  on(root, 'click', '[data-retry]', load);
  load();
}
