'use strict';

// ============================================================
// SELLER-PUBLIC.JS
// Powers: seller.html public storefront
// Loads seller profile + active listings from Firestore,
// builds category filter chips, WhatsApp CTA
// No auth required — fully public page
// ============================================================

(function SellerPublic() {

  // ── State ──────────────────────────────────────────────────
  let allListings      = [];
  let activeFilter     = 'all';
  let sellerData       = null;

  // ── Wait for Firebase then boot ───────────────────────────
  waitForFirebase(init);

  function waitForFirebase(cb) {
    const check = setInterval(() => {
      if (window.firebase && window.firebase.auth && window.firebase.apps && window.firebase.apps.length > 0) {
        clearInterval(check);
        cb();
      }
    }, 60);
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    const uid = getUIDFromURL();

    if (!uid) {
      showNotFound();
      return;
    }

    loadSellerProfile(uid);
  }

  // ── Read ?uid= from URL ────────────────────────────────────
  function getUIDFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('uid') || null;
  }

  // ── Load seller profile document ──────────────────────────
  async function loadSellerProfile(uid) {
    try {
      const doc = await firebase.firestore().collection('users').doc(uid).get();

      if (!doc.exists) {
        showNotFound();
        return;
      }

      const data = doc.data();

      // Only show sellers (not customers / admins on this page)
      if (data.role !== 'seller' && data.role !== 'admin') {
        showNotFound();
        return;
      }

      sellerData = data;
      renderProfile(uid, data);
      loadListings(uid, data);

    } catch (err) {
      console.error('[SellerPublic] Profile load error:', err);
      showNotFound();
    }
  }

  // ── Render profile header ──────────────────────────────────
  function renderProfile(uid, data) {
    // Page title
    const storeName = data.storeName
      || [data.firstName, data.lastName].filter(Boolean).join(' ')
      || 'Seller';

    document.title = `${storeName} — Ludek Marketplace`;

    // Store name
    const storeNameEl = document.getElementById('sellerStoreName');
    if (storeNameEl) storeNameEl.textContent = storeName;

    // Meta (location)
    const metaEl = document.getElementById('sellerMeta');
    if (metaEl && data.location) {
      metaEl.innerHTML = `<i class="fas fa-location-dot"></i> ${escHtml(data.location)}`;
    }

    // Bio
    const bioEl = document.getElementById('sellerBio');
    if (bioEl && data.bio && data.bio.trim()) {
      bioEl.textContent = data.bio.trim();
      bioEl.style.display = '';
    }

    // Banner
    if (data.bannerURL) {
      const placeholder = document.getElementById('bannerPlaceholder');
      const img         = document.getElementById('bannerImg');
      if (placeholder) placeholder.style.display = 'none';
      if (img) { img.src = data.bannerURL; img.style.display = ''; }
    }

    // Avatar
    if (data.photoURL) {
      const avatarEl = document.getElementById('sellerAvatar');
      if (avatarEl) {
        avatarEl.innerHTML = `<img src="${escAttr(data.photoURL)}" alt="${escAttr(storeName)}" />`;
      }
    }

    // WhatsApp CTA
    if (data.whatsapp) {
      const btn = document.getElementById('whatsappContactBtn');
      if (btn) {
        const msg = encodeURIComponent(
          `Hello, I found your store on Ludek Marketplace (CRUTECH Okuku Campus).\n\nI'd like to connect with you.`
        );
        btn.href = `https://wa.me/${data.whatsapp}?text=${msg}`;
        btn.style.display = '';
      }
    }

    // Show main content
    const mainEl = document.getElementById('sellerMain');
    if (mainEl) mainEl.style.visibility = '';
  }

  // ── Load active listings ───────────────────────────────────
  async function loadListings(uid, sellerInfo) {
    showListingsLoading(true);

    try {
      const snap = await firebase.firestore()
        .collection('listings')
        .where('sellerId', '==', uid)
        .where('status',   '==', 'active')
        .orderBy('createdAt', 'desc')
        .get();

      allListings = [];
      snap.forEach(doc => {
        allListings.push({ id: doc.id, ...doc.data() });
      });

      showListingsLoading(false);

      // Update count
      const countEl = document.getElementById('listingsCount');
      if (countEl) countEl.textContent = allListings.length > 0 ? `(${allListings.length})` : '';

      if (allListings.length === 0) {
        showEmptyState(true);
        return;
      }

      buildFilterChips(allListings);
      renderListings(allListings);

    } catch (err) {
      console.error('[SellerPublic] Listings load error:', err);
      showListingsLoading(false);
      showEmptyState(true);
    }
  }

  // ── Build category filter chips ────────────────────────────
  function buildFilterChips(listings) {
    const container = document.getElementById('filterChips');
    if (!container) return;

    // Gather unique categories
    const cats = ['all'];
    listings.forEach(l => {
      const c = l.category || 'other';
      if (!cats.includes(c)) cats.push(c);
    });

    // Only show chips if more than one category
    if (cats.length <= 2) {
      container.style.display = 'none';
      return;
    }

    container.innerHTML = '';
    cats.forEach(cat => {
      const chip = document.createElement('button');
      chip.type      = 'button';
      chip.className = `sp-chip ${cat === activeFilter ? 'active' : ''}`;
      chip.setAttribute('data-cat', cat);
      chip.setAttribute('role', 'listitem');
      chip.textContent = cat === 'all' ? 'All' : capitalise(cat);

      chip.addEventListener('click', () => {
        activeFilter = cat;
        container.querySelectorAll('.sp-chip').forEach(c => {
          c.classList.toggle('active', c.getAttribute('data-cat') === cat);
        });
        const filtered = cat === 'all' ? allListings : allListings.filter(l => l.category === cat);
        renderListings(filtered);
      });

      container.appendChild(chip);
    });
  }

  // ── Render listings grid ───────────────────────────────────
  function renderListings(listings) {
    const grid  = document.getElementById('listingsGrid');
    const empty = document.getElementById('listingsEmpty');
    if (!grid) return;

    grid.innerHTML = '';

    if (listings.length === 0) {
      grid.style.display = 'none';
      if (empty) empty.style.display = '';
      return;
    }

    if (empty) empty.style.display = 'none';
    grid.style.display = '';

    listings.forEach(listing => {
      grid.appendChild(buildListingCard(listing));
    });
  }

  // ── Build a single listing card ────────────────────────────
  function buildListingCard(listing) {
    const card = document.createElement('article');
    card.className = 'sp-listing-card';
    card.setAttribute('role', 'listitem');

    const imgSrc    = listing.coverImage || (listing.images && listing.images[0]) || null;
    const price     = typeof listing.price === 'number'
      ? `₦${listing.price.toLocaleString()}`
      : '–';
    const condition = conditionLabel(listing.condition);
    const neg       = listing.negotiable ? '<span class="sp-neg-tag">Negotiable</span>' : '';
    const catIcon   = categoryIcon(listing.category);

    const waMsg = encodeURIComponent(
      `Hello, I found your listing on Ludek Marketplace (CRUTECH Okuku Campus).\n\nProduct: ${listing.title}\nPrice: ${price}\n\nIs it still available?`
    );
    const waNumber = listing.whatsapp || (sellerData && sellerData.whatsapp) || '';
    const waHref   = waNumber ? `https://wa.me/${waNumber}?text=${waMsg}` : '#';

    card.innerHTML = `
      <a href="product.html?id=${escAttr(listing.id)}" class="sp-card-image-link" tabindex="-1" aria-hidden="true">
        <div class="sp-card-image">
          ${imgSrc
            ? `<img src="${escAttr(imgSrc)}" alt="${escAttr(listing.title || '')}" loading="lazy" />`
            : `<div class="sp-card-image-placeholder"><i class="${catIcon}"></i></div>`}
          ${condition ? `<span class="sp-card-condition">${escHtml(condition)}</span>` : ''}
        </div>
      </a>
      <div class="sp-card-body">
        <a href="product.html?id=${escAttr(listing.id)}" class="sp-card-title-link">
          <h3 class="sp-card-title">${escHtml(listing.title || 'Untitled')}</h3>
        </a>
        <span class="sp-card-category"><i class="${catIcon}"></i> ${escHtml(capitalise(listing.category || 'Other'))}</span>
        <div class="sp-card-price-row">
          <span class="sp-card-price">${price}</span>
          ${neg}
        </div>
        <a href="${waHref}" class="btn btn-whatsapp btn-sm sp-card-wa-btn" target="_blank" rel="noopener" ${!waNumber ? 'style="display:none;"' : ''}>
          <i class="fab fa-whatsapp"></i> Chat Seller
        </a>
      </div>
    `;

    return card;
  }

  // ── State helpers ──────────────────────────────────────────
  function showNotFound() {
    const main     = document.getElementById('sellerMain');
    const notFound = document.getElementById('sellerNotFound');
    if (main)     main.style.display     = 'none';
    if (notFound) notFound.style.display = '';

    // Hide loader
    const loader = document.getElementById('pageLoader');
    if (loader) { loader.classList.add('hidden'); setTimeout(() => loader.remove(), 500); }
  }

  function showListingsLoading(show) {
    const loading = document.getElementById('listingsLoading');
    const grid    = document.getElementById('listingsGrid');
    if (loading) loading.style.display = show ? ''  : 'none';
    if (grid)    grid.style.display    = show ? 'none' : '';
  }

  function showEmptyState(show) {
    const empty = document.getElementById('listingsEmpty');
    if (empty) empty.style.display = show ? '' : 'none';
  }

  // ── Utility helpers ────────────────────────────────────────
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
    return map[cat] || 'fas fa-box';
  }

  function conditionLabel(condition) {
    const map = {
      'new':       'Brand New',
      'like-new':  'Like New',
      'used-good': 'Used – Good',
      'used-fair': 'Used – Fair',
      'service':   '',
    };
    return map[condition] !== undefined ? map[condition] : '';
  }

  function capitalise(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escAttr(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

})();
