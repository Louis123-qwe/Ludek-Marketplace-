import { store } from './lib/store.js';
import { resetSeo, setTitle } from './lib/seo.js';
import { mountLayout } from './components/layout.js';
import { emptyState, errorState } from './components/ui.js';

const routes = [
  { path: '/', layout: 'app', load: () => import('./pages/home.js') },
  { path: '/welcome', noindex: true, layout: 'bare', load: () => import('./pages/welcome.js') },
  { path: '/auth', noindex: true, layout: 'bare', load: () => import('./pages/auth.js') },
  { path: '/browse', layout: 'app', load: () => import('./pages/browse.js') },
  { path: '/marketplace', noindex: true, layout: 'app', load: () => import('./pages/browse.js') },
  { path: '/privacy', layout: 'app', load: () => import('./pages/legal.js') },
  { path: '/terms', layout: 'app', load: () => import('./pages/legal.js') },
  { path: '/user-agreement', layout: 'app', load: () => import('./pages/legal.js') },
  { path: '/product/:id', layout: 'plain', load: () => import('./pages/product.js') },
  { path: '/seller/:id', layout: 'plain', load: () => import('./pages/seller-public.js') },
  { path: '/saved', noindex: true, layout: 'app', guard: 'user', load: () => import('./pages/saved.js') },
  { path: '/notifications', noindex: true, layout: 'plain', guard: 'user', load: () => import('./pages/notifications.js') },
  { path: '/dashboard', noindex: true, layout: 'app', guard: 'user', load: () => import('./pages/dashboard.js') },
  { path: '/my-listings', noindex: true, layout: 'app', guard: 'user', load: () => import('./pages/my-listings.js') },
  { path: '/profile', noindex: true, layout: 'app', guard: 'user', load: () => import('./pages/profile.js') },
  { path: '/add-listing', noindex: true, layout: 'plain', guard: 'user', load: () => import('./pages/add-listing.js') },
  { path: '/listing/:id/edit', noindex: true, layout: 'plain', guard: 'user', load: () => import('./pages/add-listing.js') },
  { path: '/admin', noindex: true, layout: 'admin', guard: 'admin', load: () => import('./pages/admin/index.js') },
  { path: '/admin/:section', noindex: true, layout: 'admin', guard: 'admin', load: () => import('./pages/admin/index.js') }
];

const compiled = routes.map(route => {
  const keys = [];
  const source = route.path.replace(/:([a-zA-Z]+)/g, (_, key) => {
    keys.push(key);
    return '([^/]+)';
  });
  return { ...route, keys, pattern: new RegExp(`^${source}/?$`) };
});

function match(path) {
  for (const route of compiled) {
    const result = path.match(route.pattern);
    if (result) {
      const params = Object.fromEntries(route.keys.map((key, i) => [key, decodeURIComponent(result[i + 1])]));
      return { route, params };
    }
  }
  return null;
}

let appEl;
let layout = null;
let layoutName = null;
let cleanup = null;
let token = 0;
let lastUid = null;

export { setTitle };

export function navigate(to, { replace = false } = {}) {
  const current = location.pathname + location.search + location.hash;
  if (to === current) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', to);
  render();
}

function runCleanup() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
}

function ensureLayout(name) {
  if (name === layoutName) return;
  layout?.destroy();
  layout = mountLayout(name, appEl);
  layoutName = name;
}

function showStandalone(name, markup) {
  resetSeo({ noindex: true });
  runCleanup();
  ensureLayout(name);
  layout.update(location.pathname);
  layout.root.innerHTML = markup;
}

async function render() {
  const run = ++token;
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const found = match(path);
  const { profile, settings } = store.get();

  if (found?.route.guard && !profile) {
    navigate(`/auth?next=${encodeURIComponent(path + location.search)}`, { replace: true });
    return;
  }
  if (found?.route.guard === 'admin' && profile?.role !== 'admin') {
    navigate('/', { replace: true });
    return;
  }

  if (settings?.maintenance && profile?.role !== 'admin' && found?.route.path !== '/auth') {
    showStandalone(
      'bare',
      `<div class="center-screen">${emptyState({
        icon: 'wrench',
        title: 'Ludek Market is getting an upgrade',
        text: 'We will be back shortly. Thanks for your patience.',
        action: '<a class="btn btn-ghost" href="/auth">Admin log in</a>'
      })}</div>`
    );
    return;
  }

  if (!found) {
    showStandalone(
      'plain',
      `<div class="container pad-xl">${emptyState({
        icon: 'search',
        title: 'Page not found',
        text: 'The page you opened does not exist or has moved.',
        action: '<a class="btn btn-primary" href="/marketplace">Browse listings</a>'
      })}</div>`
    );
    return;
  }

  resetSeo({ noindex: Boolean(found.route.noindex) });
  runCleanup();
  ensureLayout(found.route.layout);
  layout.update(path);

  const page = document.createElement('div');
  page.className = 'page';
  page.innerHTML = '<div class="page-loading"><span class="spinner spinner-lg"></span></div>';
  layout.root.replaceChildren(page);

  try {
    const module = await found.route.load();
    if (run !== token) return;
    const query = new URLSearchParams(location.search);
    const result = await module.default(page, { params: found.params, query, path });
    if (run !== token) {
      if (typeof result === 'function') result();
      return;
    }
    cleanup = typeof result === 'function' ? result : null;
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
    else window.scrollTo(0, 0);
  } catch (error) {
    if (run !== token) return;
    page.innerHTML = errorState(error.message || 'Could not load this page.');
    page.querySelector('[data-retry]')?.addEventListener('click', render);
  }
}

function onLinkClick(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = event.target.closest('a[href]');
  if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  event.preventDefault();
  navigate(url.pathname + url.search + url.hash);
}

export function startRouter() {
  appEl = document.getElementById('app');
  window.addEventListener('popstate', render);
  document.addEventListener('click', onLinkClick);
  lastUid = store.get().profile?.id ?? null;
  store.subscribe(state => {
    const uid = state.profile?.id ?? null;
    if (uid === lastUid) return;
    lastUid = uid;
    if (layoutName === 'bare') return;
    render();
  });
  render();
}
