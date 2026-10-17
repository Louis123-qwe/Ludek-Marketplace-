import { store } from '../lib/store.js';
import { toast } from '../lib/dom.js';
import { favorites } from '../api/favorites.js';
import { navigate } from '../router.js';

let bound = false;

export async function loadFavorites() {
  try {
    const { ids } = await favorites.ids();
    store.set({ favs: new Set(ids) });
  } catch {
    store.set({ favs: new Set() });
  }
}

const paint = (id, saved) =>
  document.querySelectorAll('[data-heart]').forEach(btn => {
    if (btn.dataset.heart === id) btn.classList.toggle('on', saved);
  });

export function initFavorites() {
  if (bound) return;
  bound = true;
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-heart]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const { profile, favs } = store.get();
    if (!profile) {
      navigate(`/auth?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    const id = button.dataset.heart;
    const wasSaved = favs.has(id);
    if (wasSaved) favs.delete(id);
    else favs.add(id);
    paint(id, !wasSaved);
    try {
      if (wasSaved) {
        await favorites.remove(id);
        if (button.closest('[data-saved-grid]')) button.closest('.lc')?.remove();
      } else {
        await favorites.add(id);
      }
    } catch (error) {
      if (wasSaved) favs.add(id);
      else favs.delete(id);
      paint(id, wasSaved);
      toast(error.message, 'error');
    }
  });
}
