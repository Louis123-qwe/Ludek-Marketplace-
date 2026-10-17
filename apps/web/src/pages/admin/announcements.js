import { h, esc, on, setBusy, toast, confirmDialog } from '../../lib/dom.js';
import { admin } from '../../api/admin.js';
import { errorState, spinner } from '../../components/ui.js';
import { timeAgo } from '../../lib/format.js';
import { adminHead } from './ui.js';

const AUDIENCES = { all: 'Everyone', seller: 'Sellers only', customer: 'Buyers only' };

export default function announcements(root) {
  root.innerHTML = h`
    ${adminHead('Announcements', 'Send updates to members. They appear in each member\'s notifications.')}
    <div class="two-col two-col-wide">
      <form class="card form-card stack" id="broadcast" novalidate>
        <h3>Send an announcement</h3>
        <div class="field"><label for="aTitle">Title</label><input class="input" id="aTitle" name="title" maxlength="80" required></div>
        <div class="field"><label for="aMessage">Message</label><textarea class="textarea" id="aMessage" name="message" maxlength="400" required></textarea></div>
        <div class="grid-2">
          <div class="field"><label for="aAudience">Send to</label>
            <select class="select" id="aAudience" name="audience">${Object.entries(AUDIENCES).map(([value, label]) => `<option value="${value}">${label}</option>`)}</select></div>
          <div class="field"><label for="aLink">Link (optional)</label><input class="input" id="aLink" name="link" placeholder="/marketplace"></div>
        </div>
        <button class="btn btn-primary" type="submit">Send announcement</button>
      </form>

      <form class="card form-card stack" id="direct" novalidate>
        <h3>Message one member</h3>
        <div class="field"><label for="dEmail">Member email</label><input class="input" id="dEmail" name="email" type="email" required></div>
        <div class="field"><label for="dTitle">Title</label><input class="input" id="dTitle" name="title" maxlength="80" required></div>
        <div class="field"><label for="dMessage">Message</label><textarea class="textarea" id="dMessage" name="message" maxlength="400" required></textarea></div>
        <button class="btn btn-primary" type="submit">Send message</button>
      </form>
    </div>

    <section class="card">
      <div class="section-head"><h3>Sent announcements</h3></div>
      <div id="history"><div class="center pad">${spinner()}</div></div>
    </section>`;

  const history = root.querySelector('#history');

  async function loadHistory() {
    try {
      const items = await admin.announcements.list();
      history.innerHTML = items.length
        ? `<ul class="rows">${items.map(item => `
            <li class="row-flat" data-id="${esc(item.id)}">
              <span class="row-main"><b>${esc(item.title)}</b><small>${esc(item.message)}</small><small>${esc(AUDIENCES[item.audience] || 'Everyone')}, ${timeAgo(item.createdAt)}</small></span>
              <button class="btn btn-ghost btn-sm" data-delete>Remove</button>
            </li>`).join('')}</ul>`
        : '<div class="empty-inline">No announcements sent yet.</div>';
    } catch (error) {
      history.innerHTML = errorState(error.message);
    }
  }

  async function submit(event, send, success) {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form));
    if (!data.title.trim() || !data.message.trim() || (data.email !== undefined && !data.email.trim())) {
      toast('Fill in all required fields.', 'error');
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    setBusy(button, true, 'Sending');
    try {
      await send({ ...data, title: data.title.trim(), message: data.message.trim() });
      toast(success, 'success');
      form.reset();
      loadHistory();
    } catch (error) {
      toast(error.message, 'error');
    }
    setBusy(button, false);
  }

  root.querySelector('#broadcast').addEventListener('submit', event => submit(event, admin.announcements.create, 'Announcement sent'));
  root.querySelector('#direct').addEventListener('submit', event => submit(event, admin.notify, 'Message sent'));

  on(root, 'click', '[data-retry]', loadHistory);

  on(root, 'click', '[data-delete]', async (event, button) => {
    const id = button.closest('[data-id]').dataset.id;
    const ok = await confirmDialog({ title: 'Remove this announcement?', message: 'It stays in notifications members already received.', confirmText: 'Remove', danger: true });
    if (!ok) return;
    try {
      await admin.announcements.remove(id);
      toast('Announcement removed', 'success');
      loadHistory();
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  loadHistory();
}
