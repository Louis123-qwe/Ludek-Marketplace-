import { h } from '../lib/dom.js';
import { favorites } from '../api/favorites.js';
import { listingCard } from '../components/listing-card.js';
import { topbar } from '../components/bits.js';
import { emptyState, errorState, spinner } from '../components/ui.js';
import { plural } from '../lib/format.js';
import { setTitle } from '../router.js';

export default async function saved(root) {
  setTitle('Saved');
  root.innerHTML = h`${topbar({ title: 'Saved', sub: '' })}<section class="pad" id="body"><div class="center">${spinner()}</div></section>`;
  const body = root.querySelector('#body');
  try {
    const { items } = await favorites.list();
    root.querySelector('.tb-t').insertAdjacentHTML('beforeend', `<p>${plural(items.length, 'item')}</p>`);
    body.innerHTML = items.length
      ? `<div class="grid2" data-saved-grid>${items.map(listingCard).join('')}</div><p class="hint-b">Tap the heart on any listing to keep it here. Saved items that sell show a Sold tag.</p>`
      : emptyState({ icon: 'heart', title: 'Nothing saved yet', text: 'Tap the heart on a listing to save it for later.', action: '<a class="bt bt-primary bt-sm" href="/browse">Browse listings</a>' });
  } catch (error) {
    body.innerHTML = errorState(error.message, false);
  }
}
