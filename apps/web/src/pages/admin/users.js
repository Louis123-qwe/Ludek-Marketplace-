import { h, esc, on, debounce, toast, confirmDialog, openModal, setBusy } from '../../lib/dom.js';
import { icon } from '../../lib/icons.js';
import { admin } from '../../api/admin.js';
import { avatar, errorState, pager, spinner, statusChip } from '../../components/ui.js';
import { shortDate } from '../../lib/format.js';
import { adminHead, filterTabs, table } from './ui.js';

const ROLES = [['', 'Everyone'], ['customer', 'Buyers'], ['seller', 'Sellers'], ['admin', 'Admins']];

export default function users(root) {
  const state = { q: '', role: '', page: 1, pages: 1, items: [] };
  let token = 0;

  root.innerHTML = h`
    ${adminHead('Users', 'Verify sellers, change roles and suspend accounts.')}
    <div class="filters">
      <label class="search-box search-box-sm">${icon('search', 18)}<input id="q" type="search" placeholder="Search by name or email" aria-label="Search users"></label>
      <div id="roleTabs"></div>
    </div>
    <div class="card" id="result"></div>`;

  const result = root.querySelector('#result');

  const columns = [
    {
      label: 'User',
      render: user => `<div class="cell-user">${avatar(user, 36)}<div><b>${esc(user.fullName)}</b><small>${esc(user.email)}</small></div></div>`
    },
    { label: 'Role', render: user => statusChip(user.role) },
    { label: 'Status', render: user => statusChip(user.status) },
    { label: 'Verified', render: user => (user.verified ? `<span class="verified">${icon('shield', 18)}</span>` : '<span class="muted">No</span>') },
    { label: 'Joined', render: user => shortDate(user.createdAt) },
    {
      label: '',
      cls: 'cell-actions',
      render: user => `
        <button class="btn btn-ghost btn-sm" data-act="verify">${user.verified ? 'Unverify' : 'Verify'}</button>
        <button class="btn btn-ghost btn-sm" data-act="role">Role</button>
        <button class="btn btn-ghost btn-sm" data-act="status">${user.status === 'suspended' ? 'Reinstate' : 'Suspend'}</button>`
    }
  ];

  function drawTabs() {
    root.querySelector('#roleTabs').innerHTML = filterTabs(ROLES, state.role, 'role');
  }

  async function load() {
    const run = ++token;
    result.innerHTML = `<div class="center pad">${spinner()}</div>`;
    try {
      const data = await admin.users.list({ q: state.q, role: state.role, page: state.page, limit: 20 });
      if (run !== token) return;
      state.items = data.items;
      state.pages = data.pages || 1;
      result.innerHTML = table(columns, state.items, 'No users match.') + pager(state.page, state.pages);
    } catch (error) {
      if (run !== token) return;
      result.innerHTML = errorState(error.message);
    }
  }

  async function patch(id, body, message) {
    try {
      await admin.users.update(id, body);
      toast(message, 'success');
      load();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  on(root, 'click', '[data-role]', (event, tab) => {
    state.role = tab.dataset.role;
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
    const user = state.items.find(item => item.id === id);
    const act = button.dataset.act;

    if (act === 'verify') {
      patch(id, { verified: !user.verified }, user.verified ? 'Verification removed' : 'Seller verified');
    } else if (act === 'status') {
      const suspending = user.status !== 'suspended';
      const ok = await confirmDialog({
        title: suspending ? 'Suspend this account?' : 'Reinstate this account?',
        message: suspending
          ? `${user.fullName} will not be able to use Ludek Market until reinstated.`
          : `${user.fullName} will be able to use Ludek Market again.`,
        confirmText: suspending ? 'Suspend' : 'Reinstate',
        danger: suspending
      });
      if (ok) patch(id, { status: suspending ? 'suspended' : 'active' }, suspending ? 'Account suspended' : 'Account reinstated');
    } else if (act === 'role') {
      const modal = openModal({
        title: `Change role for ${user.fullName}`,
        body: h`<div class="field"><label for="roleSel">Role</label>
          <select class="select" id="roleSel">
            ${['customer', 'seller', 'admin'].map(role => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${role === 'customer' ? 'Buyer' : role[0].toUpperCase() + role.slice(1)}</option>`)}
          </select></div>`,
        actions: [
          { label: 'Cancel', kind: 'ghost', onClick: () => modal.close() },
          {
            label: 'Save role',
            kind: 'primary',
            onClick: async (e, btn) => {
              setBusy(btn, true, 'Saving');
              await patch(id, { role: modal.body.querySelector('#roleSel').value }, 'Role updated');
              modal.close();
            }
          }
        ]
      });
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
