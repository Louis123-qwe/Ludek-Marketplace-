'use strict';

// ============================================================
// MY-LISTINGS.JS
// Handles: Firestore real-time listing grid, filter tabs,
//          live search, toggle active/draft, delete modal
// ============================================================

(function MyListings() {

  let allListings    = []; // full Firestore snapshot data
  let currentFilter  = 'all';
  let searchQuery    = '';
  let deleteTargetId = null;
  let unsubscribe    = null;

  // ── Boot ──────────────────────────────────────────────────
  window.addEventListener('seller:ready', ({ detail: { user } }) => {
    subscribeListings(user.uid);
    initFilterTabs();
    initSearch();
    initDeleteModal();
  });

  // ── Real-time Firestore listener ──────────────────────────
  function subscribeListings(uid) {
    const grid    = document.getElementById('listingsGrid');
    const loading = document.getElementById('listingsLoading');
    const empty   = document.getElementById('listingsEmptyState');

    if (unsubscribe) unsubscribe();

    unsubscribe = firebase.firestore()
      .collection('listings')
      .where('sellerId', '==', uid)
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        snap => {
          allListings = [];
          snap.forEach(doc => allListings.push({ id: doc.id, ...doc.data() }));

          if (loading) loading.style.display = 'none';
          renderListings();
        },
        err => {
          console.error('[MyListings] Firestore error:', err);
          if (loading) loading.style.display = 'none';
          if (empty) {
            empty.style.display = '';
            const msg = empty.querySelector('.dash-empty-title');
            if (msg) msg.textContent = 'Could not load listings';
          }
        }
      );
  }

  // ── Render ────────────────────────────────────────────────
  function renderListings() {
    const grid  = document.getElementById('listingsGrid');
    const empty = document.getElementById('listingsEmptyState');
    const badge = document.getElementById('listingsPageCount');
    if (!grid)  return;

    // Apply filter
    let filtered = allListings;
    if (currentFilter !== 'all') {
      filtered = filtered.filter(l => l.status === currentFilter);
    }

    // Apply search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(l =>
        (l.title       || '').toLowerCase().includes(q) ||
        (l.category    || '').toLowerCase().includes(q) ||
        (l.description || '').toLowerCase().includes(q)
      );
    }

    // Update count badge
    if (badge) badge.textContent = `${filtered.length} listing${filtered.length !== 1 ? 's' : ''}`;

    // Clear grid (leave empty state in DOM)
    grid.querySelectorAll('.listing-card').forEach(c => c.remove());

    if (filtered.length === 0) {
      if (empty) {
        empty.style.display = '';
        const msg = document.getElementById('listingsEmptyMsg');
        if (msg) {
          msg.textContent = searchQuery
            ? 'No listings match your search.'
            : currentFilter === 'active'
              ? 'You have no active listings.'
              : currentFilter === 'draft'
                ? 'You have no draft listings.'
                : "You haven't posted anything yet.";
        }
      }
      return;
    }

    if (empty) empty.style.display = 'none';

    filtered.forEach(listing => {
      const card = buildListingCard(listing);
      grid.appendChild(card);
    });
  }

  // ── Build Card ────────────────────────────────────────────
  function buildListingCard(l) {
    const card     = document.createElement('div');
    card.className = 'listing-card';
    card.setAttribute('role', 'listitem');

    const imgSrc  = l.images && l.images[0] ? l.images[0] : null;
    const price   = typeof l.price === 'number' ? `₦${l.price.toLocaleString()}` : '–';
    const status  = l.status || 'draft';
    const catIcon = categoryIcon(l.category);
    const isActive= status === 'active';

    card.innerHTML = `
      <div class="listing-card-img">
        ${imgSrc
          ? `<img src="${imgSrc}" alt="${escHtml(l.title)}" loading="lazy" />`
          : `<i class="${catIcon}"></i>`}
        <span class="listing-card-status-badge ${status}">
          ${isActive ? 'Active' : 'Draft'}
        </span>
      </div>
      <div class="listing-card-body">
        <div class="listing-card-title">${escHtml(l.title || 'Untitled')}</div>
        <div class="listing-card-cat">
          <i class="${catIcon}" style="margin-right:4px;opacity:.6;"></i>
          ${escHtml(l.category || 'Uncategorized')}
        </div>
        <div class="listing-card-price">${price}</div>
        <div class="listing-card-actions">
          <a href="add-listing.html?edit=${l.id}"
             class="listing-card-btn edit"
             aria-label="Edit ${escHtml(l.title)}">
            <i class="fas fa-pen"></i> Edit
          </a>
          <button type="button"
                  class="listing-card-btn toggle"
                  data-id="${l.id}"
                  data-status="${status}"
                  aria-label="${isActive ? 'Deactivate' : 'Activate'} listing">
            <i class="fas ${isActive ? 'fa-toggle-off' : 'fa-toggle-on'}"></i>
            ${isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button type="button"
                  class="listing-card-btn delete"
                  data-id="${l.id}"
                  data-title="${escHtml(l.title)}"
                  aria-label="Delete ${escHtml(l.title)}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;

    // Toggle listener
    card.querySelector('.listing-card-btn.toggle').addEventListener('click', (e) => {
      e.preventDefault();
      const btn   = e.currentTarget;
      const id    = btn.dataset.id;
      const newStatus = btn.dataset.status === 'active' ? 'draft' : 'active';
      toggleListingStatus(id, newStatus);
    });

    // Delete listener
    card.querySelector('.listing-card-btn.delete').addEventListener('click', (e) => {
      e.preventDefault();
      const btn   = e.currentTarget;
      openDeleteModal(btn.dataset.id, btn.dataset.title);
    });

    return card;
  }

  // ── Toggle Status ─────────────────────────────────────────
  async function toggleListingStatus(id, newStatus) {
    try {
      await firebase.firestore().collection('listings').doc(id).update({
        status:    newStatus,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      showToast(
        newStatus === 'active' ? 'Listing activated!' : 'Listing set to draft.',
        'success'
      );
      // Real-time listener will auto re-render
    } catch (err) {
      console.error('[MyListings] Toggle error:', err);
      showToast('Could not update listing status.', 'error');
    }
  }

  // ── Delete Modal ──────────────────────────────────────────
  function initDeleteModal() {
    const modal       = document.getElementById('deleteModal');
    const closeBtn    = document.getElementById('deleteModalClose');
    const cancelBtn   = document.getElementById('deleteModalCancel');
    const confirmBtn  = document.getElementById('deleteModalConfirm');

    closeBtn  && closeBtn.addEventListener('click',  closeDeleteModal);
    cancelBtn && cancelBtn.addEventListener('click', closeDeleteModal);

    modal && modal.addEventListener('click', (e) => {
      if (e.target === modal) closeDeleteModal();
    });

    confirmBtn && confirmBtn.addEventListener('click', async () => {
      if (!deleteTargetId) return;
      await doDelete(deleteTargetId);
      closeDeleteModal();
    });
  }

  function openDeleteModal(id, title) {
    deleteTargetId = id;
    const nameEl = document.getElementById('deleteListingName');
    if (nameEl) nameEl.textContent = `"${title}"`;
    const modal = document.getElementById('deleteModal');
    if (modal) modal.classList.add('open');
  }

  function closeDeleteModal() {
    deleteTargetId = null;
    const modal = document.getElementById('deleteModal');
    if (modal) modal.classList.remove('open');
  }

  async function doDelete(id) {
    const btn = document.getElementById('deleteModalConfirm');
    if (btn) { btn.disabled = true; btn.textContent = 'Deleting…'; }

    try {
      await firebase.firestore().collection('listings').doc(id).delete();
      showToast('Listing deleted.', 'success');
      // Real-time listener will auto remove from grid
    } catch (err) {
      console.error('[MyListings] Delete error:', err);
      showToast('Could not delete listing.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash"></i> Delete'; }
    }
  }

  // ── Filter Tabs ───────────────────────────────────────────
  function initFilterTabs() {
    document.querySelectorAll('.listings-filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.listings-filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter || 'all';
        renderListings();
      });
    });
  }

  // ── Search ────────────────────────────────────────────────
  function initSearch() {
    const input = document.getElementById('listingsSearch');
    if (!input) return;
    let debounceTimer;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchQuery = input.value.trim();
        renderListings();
      }, 220);
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  function categoryIcon(cat) {
    const map = {
      electronics: 'fas fa-laptop',
      fashion:     'fas fa-shirt',
      food:        'fas fa-bowl-food',
      books:       'fas fa-book-open',
      hostel:      'fas fa-building',
      services:    'fas fa-wrench',
      tutoring:    'fas fa-chalkboard-user',
      housing:     'fas fa-house-chimney',
    };
    return map[(cat || '').toLowerCase()] || 'fas fa-box';
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();
