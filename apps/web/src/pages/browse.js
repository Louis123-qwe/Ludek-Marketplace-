import { h, esc, on, debounce, openModal } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { listings } from '../api/listings.js';
import { categories, categoryName } from '../lib/categories.js';
import { listingCard, skeletonCards } from '../components/listing-card.js';
import { topbar, gbtn } from '../components/bits.js';
import { store } from '../lib/store.js';
import { emptyState, errorState } from '../components/ui.js';
import { CONDITIONS, SORTS } from '../config.js';
import { naira, conditionLabel, plural } from '../lib/format.js';
import { navigate, setTitle } from '../router.js';

export default function browse(root, ctx) {
  const params = ctx.query;
  const state = {
    q: params.get('q') || '',
    category: params.get('category') || '',
    sort: params.get('sort') || 'new',
    condition: params.get('condition') || '',
    min: params.get('min') || '',
    max: params.get('max') || '',
    page: 1,
    pages: 1,
    total: 0,
    loading: false
  };
  let token = 0;
  let observer = null;
  setTitle('Browse');

  root.innerHTML = h`
    ${topbar({ title: 'Browse', sub: '', right: store.get().profile ? '<a class="gbtn" href="/notifications" aria-label="Notifications">' + icon('bell', 20) + '</a>' : '' })}
    <section class="pad">
      <div class="search2">
        <label>${icon('search', 20)}<input id="q" type="search" placeholder="Search the market" value="${esc(state.q)}" aria-label="Search listings" autocomplete="off"></label>
        <button class="search2-f" id="filters" aria-label="Filters">${icon('sliders', 22)}</button>
      </div>
      <div class="pills" id="cats"></div>
      <div class="bw-bar">
        <label class="sortchip glass"><select id="sort" aria-label="Sort listings">${SORTS.map(s => `<option value="${s.value}" ${s.value === state.sort ? 'selected' : ''}>${s.label}</option>`)}</select>${icon('chevron-down', 16)}</label>
        <span class="muted" id="count"></span>
      </div>
      <div class="fchips" id="fchips"></div>
      <div class="grid2" id="grid"></div>
      <div class="sentinel" id="sentinel"></div>
    </section>`;

  const grid = root.querySelector('#grid');
  const sentinel = root.querySelector('#sentinel');

  function drawCats() {
    root.querySelector('#cats').innerHTML = [{ slug: '', name: 'All' }, ...categories()]
      .map(cat => `<button class="pill ${state.category === cat.slug ? 'on' : ''}" data-cat="${esc(cat.slug)}">${esc(cat.name)}</button>`)
      .join('');
  }

  function drawChips() {
    const chips = [];
    if (state.q) chips.push(['q', `"${state.q}"`]);
    if (state.category) chips.push(['category', categoryName(state.category)]);
    if (state.condition) chips.push(['condition', conditionLabel(state.condition)]);
    if (state.min) chips.push(['min', `From ${naira(state.min)}`]);
    if (state.max) chips.push(['max', `Under ${naira(state.max)}`]);
    root.querySelector('#fchips').innerHTML = chips
      .map(([key, label]) => `<button class="fchip" data-clear-key="${key}">${esc(label)}${icon('x', 13)}</button>`)
      .join('');
  }

  function syncUrl() {
    const search = new URLSearchParams();
    ['q', 'category', 'condition', 'min', 'max'].forEach(key => state[key] && search.set(key, state[key]));
    if (state.sort !== 'new') search.set('sort', state.sort);
    history.replaceState(null, '', `/browse${search.toString() ? `?${search}` : ''}`);
  }

  async function load(append = false) {
    const run = ++token;
    state.loading = true;
    if (!append) {
      state.page = 1;
      grid.innerHTML = skeletonCards(6);
      syncUrl();
      drawChips();
    } else {
      grid.insertAdjacentHTML('beforeend', skeletonCards(2).replace(/class="lc lc-sk"/g, 'class="lc lc-sk lc-more"'));
    }
    try {
      const result = await listings.list({
        q: state.q,
        category: state.category,
        sort: state.sort,
        condition: state.condition,
        min: state.min,
        max: state.max,
        page: state.page,
        limit: 12
      });
      if (run !== token) return;
      grid.querySelectorAll('.lc-sk').forEach(el => el.remove());
      state.pages = result.pages || 1;
      state.total = result.total ?? 0;
      if (!append && !result.items.length) {
        grid.innerHTML = `<div class="grid-span">${emptyState({
          icon: 'search',
          title: 'No listings match',
          text: 'Try a different search or clear your filters.',
          action: '<button class="bt bt-primary bt-sm" data-clear-all>Clear filters</button>'
        })}</div>`;
      } else {
        grid.insertAdjacentHTML('beforeend', result.items.map(listingCard).join(''));
      }
      root.querySelector('#count').textContent = plural(state.total, 'listing');
    } catch (error) {
      if (run !== token) return;
      grid.querySelectorAll('.lc-sk').forEach(el => el.remove());
      if (!append) grid.innerHTML = `<div class="grid-span">${errorState(error.message)}</div>`;
    } finally {
      if (run === token) state.loading = false;
    }
  }

  function watch() {
    observer?.disconnect();
    observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !state.loading && state.page < state.pages) {
          state.page += 1;
          load(true);
        }
      },
      { rootMargin: '600px 0px' }
    );
    observer.observe(sentinel);
  }

  function openFilters() {
    const modal = openModal({
      title: 'Filters',
      body: h`
        <div class="stack2">
          <div><p class="lbl">Condition</p>
            <div class="chipset" id="fCond">${[{ value: '', label: 'Any' }, ...CONDITIONS].map(item => `<button type="button" class="pill ${state.condition === item.value ? 'on' : ''}" data-v="${item.value}">${esc(item.label)}</button>`)}</div></div>
          <div class="two"><div class="fld"><label for="fMin">Min price (₦)</label><input class="in" id="fMin" type="number" min="0" inputmode="numeric" value="${esc(state.min)}"></div>
          <div class="fld"><label for="fMax">Max price (₦)</label><input class="in" id="fMax" type="number" min="0" inputmode="numeric" value="${esc(state.max)}"></div></div>
        </div>`,
      actions: [
        { label: 'Reset', kind: 'ghost', onClick: () => { Object.assign(state, { condition: '', min: '', max: '' }); modal.close(); load(); } },
        {
          label: 'Show results',
          kind: 'primary',
          onClick: () => {
            state.condition = modal.body.querySelector('#fCond .on')?.dataset.v || '';
            state.min = modal.body.querySelector('#fMin').value;
            state.max = modal.body.querySelector('#fMax').value;
            modal.close();
            load();
          }
        }
      ]
    });
    on(modal.body, 'click', '[data-v]', (event, chip) => {
      modal.body.querySelectorAll('#fCond .pill').forEach(el => el.classList.toggle('on', el === chip));
    });
  }

  on(root, 'click', '[data-cat]', (event, pill) => {
    state.category = pill.dataset.cat;
    drawCats();
    load();
  });
  on(root, 'click', '[data-clear-key]', (event, chip) => {
    state[chip.dataset.clearKey] = '';
    if (chip.dataset.clearKey === 'q') root.querySelector('#q').value = '';
    drawCats();
    load();
  });
  on(root, 'click', '[data-clear-all]', () => {
    Object.assign(state, { q: '', category: '', condition: '', min: '', max: '' });
    root.querySelector('#q').value = '';
    drawCats();
    load();
  });
  on(root, 'click', '[data-retry]', () => load());
  on(root, 'click', '#filters', openFilters);
  root.querySelector('#sort').addEventListener('change', event => {
    state.sort = event.target.value;
    load();
  });
  root.querySelector('#q').addEventListener(
    'input',
    debounce(event => {
      state.q = event.target.value.trim();
      load();
    }, 350)
  );

  drawCats();
  load();
  watch();
  return () => observer?.disconnect();
}
