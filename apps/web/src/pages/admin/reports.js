import { h, esc, on, openModal, setBusy, toast } from '../../lib/dom.js';
import { admin } from '../../api/admin.js';
import { errorState, pager, spinner, statusChip } from '../../components/ui.js';
import { timeAgo } from '../../lib/format.js';
import { adminHead, filterTabs, table } from './ui.js';

const STATUSES = [['open', 'Open'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed'], ['', 'All']];

export default function reports(root) {
  const state = { status: 'open', page: 1, pages: 1, items: [] };
  let token = 0;

  root.innerHTML = h`
    ${adminHead('Reports', 'Review what members have flagged.')}
    <div class="filters"><div id="tabs"></div></div>
    <div class="card" id="result"></div>`;

  const result = root.querySelector('#result');

  const columns = [
    {
      label: 'Reported',
      render: report => `<b>${esc(report.targetName || report.targetId)}</b><small>${esc(report.targetType)}</small>`
    },
    { label: 'Reason', render: report => `<b>${esc(report.reason)}</b>${report.details ? `<small>${esc(report.details)}</small>` : ''}` },
    { label: 'Reporter', render: report => esc(report.reporter?.fullName || 'Unknown') },
    { label: 'Status', render: report => statusChip(report.status) },
    { label: 'Sent', render: report => timeAgo(report.createdAt) },
    {
      label: '',
      cls: 'cell-actions',
      render: report => `
        ${report.targetType === 'listing' ? `<a class="btn btn-ghost btn-sm" href="/product/${esc(report.targetId)}">View</a>` : ''}
        ${report.status === 'open' ? '<button class="btn btn-primary btn-sm" data-act="resolved">Resolve</button><button class="btn btn-ghost btn-sm" data-act="dismissed">Dismiss</button>' : ''}`
    }
  ];

  const drawTabs = () => (root.querySelector('#tabs').innerHTML = filterTabs(STATUSES, state.status, 'status'));

  async function load() {
    const run = ++token;
    result.innerHTML = `<div class="center pad">${spinner()}</div>`;
    try {
      const data = await admin.reports.list({ status: state.status, page: state.page, limit: 20 });
      if (run !== token) return;
      state.items = data.items;
      state.pages = data.pages || 1;
      result.innerHTML = table(columns, state.items, 'No reports here. Nice and quiet.') + pager(state.page, state.pages);
    } catch (error) {
      if (run !== token) return;
      result.innerHTML = errorState(error.message);
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

  on(root, 'click', '[data-act]', (event, button) => {
    const id = button.closest('tr').dataset.id;
    const status = button.dataset.act;
    const modal = openModal({
      title: status === 'resolved' ? 'Resolve report' : 'Dismiss report',
      body: `<div class="field"><label for="note">Note (optional)</label><textarea class="textarea" id="note" maxlength="300" placeholder="What did you do about it?"></textarea></div>`,
      actions: [
        { label: 'Cancel', kind: 'ghost', onClick: () => modal.close() },
        {
          label: status === 'resolved' ? 'Mark resolved' : 'Dismiss',
          kind: 'primary',
          onClick: async (e, btn) => {
            setBusy(btn, true, 'Saving');
            try {
              await admin.reports.update(id, { status, note: modal.body.querySelector('#note').value.trim() });
              toast('Report updated', 'success');
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
  });

  drawTabs();
  load();
}
