import { h, esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { store } from '../lib/store.js';
import { logoMark } from './brand.js';
import { adminMode, adminSwitch, bindAdminSwitch } from './bits.js';
import { FOOTER_PAGES, siteFooter } from './footer.js';

const ADMIN_TABS = [
  ['/admin', 'Overview'],
  ['/admin/users', 'Users'],
  ['/admin/listings', 'Listings'],
  ['/admin/categories', 'Categories'],
  ['/admin/reports', 'Reports'],
  ['/admin/announcements', 'Announcements'],
  ['/admin/ticker', 'Ticker'],
  ['/admin/sales', 'Sales'],
  ['/admin/ads', 'Ads'],
  ['/admin/settings', 'Settings'],
  ['/admin/logs', 'Activity']
];

function navMarkup(path) {
  const signedIn = Boolean(store.get().profile);
  const account = ['/dashboard', '/my-listings', '/profile'].some(p => path.startsWith(p));
  const item = (href, name, label, on) =>
    `<a href="${href}" class="fi ${on ? 'on' : ''}">${icon(name, 22)}<span>${label}</span></a>`;
  return `
    <div class="fnav-bg"></div>
    <a class="fnav-plus" href="/add-listing" aria-label="Sell an item"><span>${icon('plus', 26)}</span></a>
    <div class="fnav-grid">
      ${item('/', 'home', 'Home', path === '/')}
      ${item('/browse', 'search', 'Browse', path.startsWith('/browse') || path.startsWith('/marketplace'))}
      <span></span>
      ${item(signedIn ? '/saved' : '/auth', 'heart', 'Saved', path.startsWith('/saved'))}
      ${item(signedIn ? '/dashboard' : '/auth', 'user', signedIn ? 'Account' : 'Log in', account)}
    </div>`;
}

const pageName = path => path.split('/')[1] || 'home';

function appLayout(app, withNav) {
  app.innerHTML = `<div class="app"><main id="view" class="view"></main><footer class="sfoot" id="sfoot" hidden></footer>${withNav ? '<nav class="fnav" id="fnav" aria-label="Primary"></nav>' : ''}</div>`;
  const nav = app.querySelector('#fnav');
  let current = location.pathname;
  const frame = app.querySelector('.app');
  const foot = app.querySelector('#sfoot');
  const draw = () => {
    const page = pageName(current);
    const showFooter = withNav && FOOTER_PAGES.has(page);
    frame.dataset.page = page;
    frame.dataset.footer = showFooter ? 'on' : 'off';
    foot.hidden = !showFooter;
    foot.innerHTML = showFooter ? siteFooter() : '';
    if (nav) nav.innerHTML = navMarkup(current);
  };
  const off = store.subscribe(draw);
  draw();
  return {
    root: app.querySelector('#view'),
    update(path) {
      current = path;
      draw();
    },
    destroy: off
  };
}

function adminLayout(app) {
  adminMode.set(true);
  app.innerHTML = h`
    <div class="app admin-app">
      <header class="tb glass">
        <a class="gbtn" href="/" aria-label="Back to market">${icon('chevron-left', 20)}</a>
        <div class="tb-t"><h1>Admin</h1><p>Ludek Market</p></div>
        ${adminSwitch(store.get().profile, 'adm-sw-top')}
        <span class="admin-logo">${logoMark(36)}</span>
      </header>
      <div class="atabs" id="atabs">${ADMIN_TABS.map(([href, label]) => `<a class="pill" href="${href}" data-tab>${esc(label)}</a>`)}</div>
      <main id="view" class="view"></main>
    </div>`;
  bindAdminSwitch(app);
  const tabs = [...app.querySelectorAll('[data-tab]')];
  return {
    root: app.querySelector('#view'),
    update(path) {
      tabs.forEach(tab => {
        const href = tab.getAttribute('href');
        const active = href === '/admin' ? path === '/admin' : path.startsWith(href);
        tab.classList.toggle('on', active);
        if (active) tab.scrollIntoView({ inline: 'center', block: 'nearest' });
      });
    },
    destroy() {}
  };
}

export function mountLayout(name, app) {
  if (name === 'bare') {
    app.innerHTML = '<main id="view" class="bare"></main>';
    return { root: app.querySelector('#view'), update() {}, destroy() {} };
  }
  if (name === 'admin') return adminLayout(app);
  return appLayout(app, name === 'app');
}
