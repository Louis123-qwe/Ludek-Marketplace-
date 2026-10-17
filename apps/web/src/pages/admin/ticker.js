import { h, esc, on, setBusy, toast, confirmDialog } from '../../lib/dom.js';
import { icon } from '../../lib/icons.js';
import { admin } from '../../api/admin.js';
import { errorState, spinner } from '../../components/ui.js';
import { adminHead } from './ui.js';

export default function tickerSection(root) {
  let items = [];

  root.innerHTML = h`
    ${adminHead('Ticker', 'Messages that scroll across the top of the home and browse pages.')}
    <form class="card form-card ticker-form" id="addForm" novalidate>
      <div class="field grow"><label for="tText">Message</label><input class="input" id="tText" name="text" maxlength="120" placeholder="e.g. Textbooks are half price this week" required></div>
      <div class="field"><label for="tLink">Link (optional)</label><input class="input" id="tLink" name="link" placeholder="/marketplace?category=books"></div>
      <button class="btn btn-primary" type="submit">${icon('plus', 18)}Add message</button>
    </form>
    <div class="card" id="list"><div class="center pad">${spinner()}</div></div>`;

  const list = root.querySelector('#list');

  function draw() {
    list.innerHTML = items.length
      ? `<ul class="rows">${items.map(item => `
          <li class="row-flat" data-id="${esc(item.id)}">
            <span class="row-main"><b>${esc(item.text)}</b>${item.link ? `<small>${esc(item.link)}</small>` : ''}</span>
            <label class="switch-row switch-compact">
              <input type="checkbox" data-toggle ${item.active ? 'checked' : ''}>
              <span class="switch"></span>
              <span>${item.active ? 'Showing' : 'Hidden'}</span>
            </label>
            <button class="btn-icon danger" data-delete aria-label="Delete">${icon('trash', 18)}</button>
          </li>`).join('')}</ul>`
      : '<div class="empty-inline">No ticker messages yet. Smart messages from the server still show.</div>';
  }

  async function load() {
    try {
      items = await admin.ticker.list();
      draw();
    } catch (error) {
      list.innerHTML = errorState(error.message);
    }
  }

  root.querySelector('#addForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.target;
    const text = form.text.value.trim();
    if (!text) return toast('Enter a message.', 'error');
    const button = form.querySelector('button[type="submit"]');
    setBusy(button, true, 'Adding');
    try {
      await admin.ticker.create({ text, link: form.link.value.trim(), active: true });
      form.reset();
      toast('Message added', 'success');
      load();
    } catch (error) {
      toast(error.message, 'error');
    }
    setBusy(button, false);
  });

  on(root, 'click', '[data-retry]', load);

  on(root, 'change', '[data-toggle]', async (event, input) => {
    const id = input.closest('[data-id]').dataset.id;
    try {
      await admin.ticker.update(id, { active: input.checked });
      toast(input.checked ? 'Message is showing' : 'Message hidden', 'success');
      load();
    } catch (error) {
      toast(error.message, 'error');
      input.checked = !input.checked;
    }
  });

  on(root, 'click', '[data-delete]', async (event, button) => {
    const id = button.closest('[data-id]').dataset.id;
    const ok = await confirmDialog({ title: 'Delete this message?', message: 'It will be removed from the ticker.', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await admin.ticker.remove(id);
      toast('Message deleted', 'success');
      load();
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  load();
}
