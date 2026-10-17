import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/design.css';
import './styles/responsive.css';
import './styles/extras.css';

import { watchAuth, logout } from './firebase.js';
import { store } from './lib/store.js';
import { toast } from './lib/dom.js';
import { users } from './api/users.js';
import { misc } from './api/misc.js';
import { DEFAULT_CATEGORIES } from './config.js';
import { refreshUnread } from './components/notifications.js';
import { loadFavorites, initFavorites } from './components/favorites.js';
import { startRouter } from './router.js';

async function loadPublicData() {
  const [categories, settings] = await Promise.allSettled([misc.categories(), misc.settings()]);
  store.set({
    categories: categories.status === 'fulfilled' && categories.value?.length ? categories.value : DEFAULT_CATEGORIES,
    settings: settings.status === 'fulfilled' ? settings.value || {} : {}
  });
}

initFavorites();

let started = false;

watchAuth(async firebaseUser => {
  if (!firebaseUser) {
    store.set({ user: null, profile: null, unread: 0, favs: new Set(), ready: true });
  } else {
    const pending = store.get().pending;
    try {
      const profile = await users.sync(pending || { fullName: firebaseUser.displayName || '' });
      store.set({ user: firebaseUser, profile, pending: null, ready: true });
      refreshUnread();
      loadFavorites();
    } catch (error) {
      store.set({ user: firebaseUser, profile: null, pending: null, ready: true });
      toast(error.message, 'error');
      if (error.status === 403) logout();
    }
  }

  if (!started) {
    started = true;
    await loadPublicData();
    startRouter();
  }
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => null));
}
