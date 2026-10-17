import { h, esc, on } from '../../lib/dom.js';
import { admin } from '../../api/admin.js';
import { errorState, pager, spinner } from '../../components/ui.js';
import { naira, shortDate, timeAgo } from '../../lib/format.js';
import { adminHead, table, filterTabs, statCard } from './ui.js';

export default function sales(root) {
  const state = { page: 1, pages: 1, source: '' };
  let token = 0;

  root.innerHTML = h`
    ${adminHead('Sales', 'Payment happens off the site, so a buyer opening the WhatsApp chat counts as a sale.')}
    <div id="totals" class="stats"></div>
    <div class="filters"><div id="sourceTabs"></div></div>
    <div class="card" id="result"></div>`;

  const result = root.querySelector('#result');

  const columns = [
    { label: 'Item', render: sale => `<b>${esc(sale.title)}</b>` },
    { label: 'Price', render: sale => naira(sale.price) },
    { label: 'Buyer', render: sale => esc(sale.buyerName || 'Visitor') },
    { label: 'Seller', render: sale => esc(sale.sellerName) },
    { label: 'Type', render: sale => `<span class="status ${sale.source === 'chat' ? 'status-pending' : 'status-active'}">${sale.source === 'chat' ? 'Chat opened' : 'Marked sold'}</span>` },
    { label: 'When', render: sale => `<span title="${esc(shortDate(sale.createdAt))}">${timeAgo(sale.createdAt)}</span>` }
  ];

  async function load() {
    const run = ++token;
    result.innerHTML = `<div class="center pad">${spinner()}</div>`;
    try {
      const data = await admin.sales({ kind: state.source, page: state.page, limit: 30 });
      if (run !== token) return;
      state.pages = data.pages || 1;
      root.querySelector('#totals').innerHTML = statCard('Sales recorded', data.total ?? 0) + statCard('Total value', naira(data.totalValue ?? 0));
      result.innerHTML = table(columns, data.items, 'No sales recorded yet.') + pager(state.page, state.pages);
    } catch (error) {
      if (run !== token) return;
      result.innerHTML = errorState(error.message);
    }
  }

  const drawTabs = () => (root.querySelector('#sourceTabs').innerHTML = filterTabs([['', 'All'], ['chat', 'Chat opened'], ['sold', 'Marked sold']], state.source, 'source'));
  on(root, 'click', '[data-source]', (event, tab) => {
    state.source = tab.dataset.source;
    state.page = 1;
    drawTabs();
    load();
  });
  drawTabs();
  on(root, 'click', '[data-page]', (event, button) => {
    state.page = Number(button.dataset.page);
    load();
  });
  on(root, 'click', '[data-retry]', load);
  load();
}
