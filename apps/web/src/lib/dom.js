import { icon } from './icons.js';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ENTITIES[char]);

const part = value =>
  Array.isArray(value) ? value.map(part).join('') : value === false || value == null ? '' : value;

export const h = (strings, ...values) =>
  strings.reduce((out, text, i) => out + text + (i < values.length ? part(values[i]) : ''), '');

export function on(root, type, selector, handler) {
  root.addEventListener(type, event => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(event, target);
  });
}

export function debounce(fn, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function setBusy(button, busy, label) {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    button.classList.add('is-busy');
    button.innerHTML = `<span class="spinner"></span>${label ? `<span>${esc(label)}</span>` : ''}`;
  } else {
    button.disabled = false;
    button.classList.remove('is-busy');
    if (button.dataset.label !== undefined) button.innerHTML = button.dataset.label;
  }
}

export function toast(message, kind = 'info') {
  let host = $('#toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    host.className = 'toasts';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.append(host);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  host.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 250);
  }, 3600);
}

let openModals = 0;

export function openModal({ title = '', body = '', actions = [], wide = false, onClose } = {}) {
  const el = document.createElement('div');
  el.className = 'modal';
  el.innerHTML = h`
    <div class="modal-backdrop" data-close></div>
    <div class="sheet ${wide ? 'sheet-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="sheet-head">
        <h2>${esc(title)}</h2>
        <button class="btn-icon" data-close aria-label="Close">${icon('x')}</button>
      </header>
      <div class="sheet-body">${body}</div>
      ${actions.length ? `<footer class="sheet-foot">${actions
        .map((action, i) => `<button class="btn btn-${action.kind || 'ghost'}" data-action="${i}">${esc(action.label)}</button>`)
        .join('')}</footer>` : ''}
    </div>`;

  document.body.append(el);
  document.body.classList.add('modal-open');
  openModals++;
  requestAnimationFrame(() => el.classList.add('in'));

  let closed = false;
  const api = { el, body: el.querySelector('.sheet-body'), close: () => close() };

  function onKey(event) {
    if (event.key === 'Escape') close();
  }

  function close() {
    if (closed) return;
    closed = true;
    el.classList.remove('in');
    document.removeEventListener('keydown', onKey);
    openModals--;
    if (!openModals) document.body.classList.remove('modal-open');
    setTimeout(() => el.remove(), 220);
    onClose?.();
  }

  document.addEventListener('keydown', onKey);
  el.addEventListener('click', event => {
    if (event.target.closest('[data-close]')) return close();
    const button = event.target.closest('[data-action]');
    if (button) actions[Number(button.dataset.action)]?.onClick?.(event, button, api);
  });

  return api;
}

export function confirmDialog({ title = 'Are you sure?', message = '', confirmText = 'Confirm', danger = false } = {}) {
  return new Promise(resolve => {
    const modal = openModal({
      title,
      body: `<p class="muted">${esc(message)}</p>`,
      onClose: () => resolve(false),
      actions: [
        { label: 'Cancel', kind: 'ghost', onClick: () => modal.close() },
        {
          label: confirmText,
          kind: danger ? 'danger' : 'primary',
          onClick: () => {
            resolve(true);
            modal.close();
          }
        }
      ]
    });
  });
}
