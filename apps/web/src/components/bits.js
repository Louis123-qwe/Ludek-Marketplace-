import { h, esc, on } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { navigate } from '../router.js';

export const topbar = ({ title, sub = '', back = false, right = '' }) => h`
  <header class="tb glass">
    ${back ? `<button class="gbtn" data-back aria-label="Back">${icon('chevron-left', 20)}</button>` : ''}
    <div class="tb-t"><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
    ${right}
  </header>`;

export const gbtn = (name, attrs = '') => `<button class="gbtn" ${attrs}>${icon(name, 20)}</button>`;

export const bindBack = root =>
  on(root, 'click', '[data-back]', () => (history.length > 1 ? history.back() : navigate('/')));

export const photo = (url, alt = '', cls = '') =>
  url ? `<img class="${cls}" src="${esc(url)}" alt="${esc(alt)}" loading="lazy">` : `<div class="ph ${cls}">Photo</div>`;

export const pill = (label, attrs = '', on_ = false) =>
  `<button type="button" class="pill ${on_ ? 'on' : ''}" ${attrs}>${label}</button>`;

const ADMIN_KEY = 'ludek_admin_mode';

export const adminMode = {
  get() {
    try {
      return localStorage.getItem(ADMIN_KEY) !== 'off';
    } catch {
      return true;
    }
  },
  set(value) {
    try {
      localStorage.setItem(ADMIN_KEY, value ? 'on' : 'off');
    } catch {
      /* storage unavailable */
    }
  }
};

export const adminSwitch = (profile, extra = '') =>
  profile?.role === 'admin'
    ? `<button type="button" class="adm-sw ${extra}" data-admin-switch role="switch" aria-checked="${adminMode.get()}"><span>Admin mode</span><i></i></button>`
    : '';

export const bindAdminSwitch = root =>
  on(root, 'click', '[data-admin-switch]', () => {
    const next = !adminMode.get();
    adminMode.set(next);
    navigate(next ? '/admin' : '/');
  });
