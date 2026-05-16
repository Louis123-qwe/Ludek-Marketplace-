// ============================================================
// LUDEK MARKETPLACE — MARKETPLACE.JS  (Phase 3 rewrite)
//
// Fixes applied vs previous version:
//   1. Rewritten in var + .then() — no const/async/await
//   2. initFirebase() gates EVERYTHING — Firebase never called
//      when config is missing (was crashing silently before)
//   3. Demo mode renders immediately without touching Firebase
//   4. No inline <script> state race — all init inside DOMContentLoaded
//   5. Category chips render before auth resolves (instant UX)
//   6. Corrected text-overflow usage in JS-injected HTML
//   7. WhatsApp href built safely — falls back to #
// ============================================================

'use strict';

// ============================================================
// CONSTANTS
// ============================================================
var PAGE_SIZE = 12;

var CATEGORIES = [
  { id: 'all',         label: 'All',         icon: 'fa-fire-flame-curved' },
  { id: 'electronics', label: 'Electronics', icon: 'fa-laptop'            },
  { id: 'fashion',     label: 'Fashion',     icon: 'fa-shirt'             },
  { id: 'food',        label: 'Food',        icon: 'fa-utensils'          },
  { id: 'books',       label: 'Books',       icon: 'fa-book-open'         },
  { id: 'hostel',      label: 'Hostel',      icon: 'fa-building'          },
  { id: 'services',    label: 'Services',    icon: 'fa-wrench'            },
  { id: 'tutoring',    label: 'Tutoring',    icon: 'fa-chalkboard-user'   },
  { id: 'housing',     label: 'Housing',     icon: 'fa-house-chimney'     }
];

var CAT_ICON = {
  electronics: 'fa-laptop',
  fashion:     'fa-shirt',
  food:        'fa-utensils',
  books:       'fa-book-open',
  hostel:      'fa-building',
  services:    'fa-wrench',
  tutoring:    'fa-chalkboard-user',
  housing:     'fa-house-chimney'
};

var DEMO_LISTINGS = [
  { id:'d1', name:'HP Pavilion Laptop (i5)',  price:45000, category:'electronics', description:'8GB RAM, 256GB SSD. Good condition, minor scratches.', sellerName:'Chidi Okon',    whatsapp:'2348012345678', negotiable:true,  createdAt:{ seconds: Math.floor(Date.now()/1000) - 3600  } },
  { id:'d2', name:'Law Textbooks Bundle',     price:3500,  category:'books',       description:'200-level law textbooks. Constitutional & Criminal law.', sellerName:'Ada Nkemdi',  whatsapp:'2348023456789', negotiable:false, createdAt:{ seconds: Math.floor(Date.now()/1000) - 7200  } },
  { id:'d3', name:'Self-Contain Room (Offcamp)', price:15000, category:'housing',  description:'Near campus gate. Water & light included. 12 months.', sellerName:'Sunday Eze',   whatsapp:'2348034567890', negotiable:true,  createdAt:{ seconds: Math.floor(Date.now()/1000) - 86400 } },
  { id:'d4', name:'Maths Tutoring (MTH 301)', price:2000,  category:'tutoring',    description:'Per session. MTH 201 & 301. 4.7 GPA student tutor.', sellerName:'Ngozi Bassey',  whatsapp:'2348045678901', negotiable:false, createdAt:{ seconds: Math.floor(Date.now()/1000) - 1800  } },
  { id:'d5', name:'Nike Air Force 1 (Sz 42)', price:12000, category:'fashion',     description:'Brand new in box. Tokunbo. Never worn.', sellerName:'Emeka Udo',       whatsapp:'2348056789012', negotiable:true,  createdAt:{ seconds: Math.floor(Date.now()/1000) - 5400  } },
  { id:'d6', name:'Jollof Rice & Chicken',    price:1200,  category:'food',        description:'Full plate. Available daily 12–5pm. DM to order.', sellerName:'Fatima Sule',  whatsapp:'2348067890123', negotiable:false, createdAt:{ seconds: Math.floor(Date.now()/1000) - 900   } },
  { id:'d7', name:'Samsung Galaxy A54',       price:85000, category:'electronics', description:'6.4" screen. 5000mAh battery. With original box.', sellerName:'Kalu Ogbu',     whatsapp:'2348078901234', negotiable:true,  createdAt:{ seconds: Math.floor(Date.now()/1000) - 43200 } },
  { id:'d8', name:'Female Hostel Space',      price:25000, category:'hostel',      description:'Shared 2-person room. Close to faculty building.', sellerName:'Uju Nwosu',     whatsapp:'2348089012345', negotiable:false, createdAt:{ seconds: Math.floor(Date.now()/1000) - 72000 } },
  { id:'d9', name:'Graphics Design Service',  price:3000,  category:'services',    description:'Flyers, logos, posters. 24hr delivery. DM for rates.', sellerName:'Tunde Bello', whatsapp:'2348090123456', negotiable:true,  createdAt:{ seconds: Math.floor(Date.now()/1000) - 600   } },
  { id:'d10',name:'Used Science Textbooks',   price:1500,  category:'books',       description:'PHY101, CHM101, BIO101. All in good condition.', sellerName:'Chioma Uche',   whatsapp:'2348001234567', negotiable:true,  createdAt:{ seconds: Math.floor(Date.now()/1000) - 10800 } },
  { id:'d11',name:'Ankara Fashion Set',       price:5500,  category:'fashion',     description:'Female Ankara blouse + skirt. Size M. Unworn.', sellerName:'Halima Buba',    whatsapp:'2348011234567', negotiable:false, createdAt:{ seconds: Math.floor(Date.now()/1000) - 21600 } },
  { id:'d12',name:'Economics Tutoring',       price:2500,  category:'tutoring',    description:'ECO201 & ECO202. Weekend sessions. Very affordable.', sellerName:'Obinna Ike', whatsapp:'2348021234567', negotiable:true,  createdAt:{ seconds: Math.floor(Date.now()/1000) - 3000  } }
];

// ============================================================
// STATE
// ============================================================
var state = {
  firebaseReady   : false,
  activeCategory  : 'all',
  searchQuery     : '',
  sortBy          : 'newest',
  priceMin        : null,
  priceMax        : null,
  viewMode        : 'grid',
  lastDoc         : null,
  hasMore         : true,
  loading         : false,
  listings        : [],
  currentUser     : null,
  userRole        : 'customer',
  userName        : '',
  savedItems      : {}
};

// ============================================================
// FIREBASE HELPERS
// ============================================================
function initFirebase() {
  var cfg = window.LUDEK_FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || cfg.apiKey === 'YOUR_API_KEY') {
    return false;
  }
  if (!firebase.apps.length) {
    firebase.initializeApp(cfg);
  }
  state.firebaseReady = true;
  return true;
}

function fbAuth() { return firebase.auth(); }
function fbDB()   { return firebase.firestore(); }

// ============================================================
// ENTRY POINT — called on DOMContentLoaded
// ============================================================
function initMarketplace() {
  // Read URL params first so category chips render correctly
  readUrlParams();

  // Render category chips immediately (no auth needed)
  renderCategoryChips();

  // Wire up all UI
  setupSearch();
  setupSort();
  setupPriceFilter();
  setupViewToggle();
  setupLoadMore();
  setupFilterDrawer();
  setupUserMenu();

  // Init Firebase and decide whether to show real data or demo
  var ready = initFirebase();

  if (!ready) {
    // No Firebase config — show demo banner + demo listings
    showDemoBanner();
    renderDemoMode();
    return;
  }

  // Firebase ready — gate behind auth
  startAuthWatch();
}

// ============================================================
// DEMO MODE
// ============================================================
function showDemoBanner() {
  var banner = document.getElementById('demoBanner');
  if (banner) banner.classList.remove('hidden');
}

function renderDemoMode() {
  var filtered = filterLocally(DEMO_LISTINGS);
  state.listings = filtered;
  hideSkeletons();
  renderGrid(filtered, true);
  updateResultsCount(filtered.length, false);
  hideLoadMore();
}

// ============================================================
// AUTH WATCH — redirect if not logged in
// ============================================================
function startAuthWatch() {
  fbAuth().onAuthStateChanged(function (user) {
    if (!user) {
      window.location.href = '/auth.html?mode=login';
      return;
    }

    state.currentUser = user;

    // Load user data then fetch listings
    fbDB().collection('users').doc(user.uid).get()
      .then(function (snap) {
        if (snap.exists) {
          var data = snap.data();
          state.userRole   = data.role || 'customer';
          state.userName   = data.fullName || user.displayName || 'Student';
          state.savedItems = arrayToSet(data.savedItems || []);
        }
        updateNavUser(user);
        fetchListings(true);
      })
      .catch(function () {
        // Couldn't get Firestore user doc — still show listings
        updateNavUser(user);
        fetchListings(true);
      });
  });
}

function arrayToSet(arr) {
  var set = {};
  if (Array.isArray(arr)) {
    arr.forEach(function (id) { set[id] = true; });
  }
  return set;
}

// ============================================================
// NAV USER
// ============================================================
function updateNavUser(user) {
  var avatarEl  = document.getElementById('navAvatar');
  var nameEl    = document.getElementById('navUserName');
  var roleEl    = document.getElementById('navUserRole');
  var sellBtn   = document.getElementById('navSellBtn');

  if (avatarEl) {
    if (user.photoURL) {
      avatarEl.innerHTML = '<img src="' + esc(user.photoURL) + '" alt="avatar" />';
    } else {
      var name  = state.userName || user.email || 'S';
      var parts = name.split(' ');
      var initials = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
      avatarEl.textContent = initials;
    }
  }

  if (nameEl) nameEl.textContent = state.userName || user.email || 'Student';

  if (roleEl) {
    var labels = { customer: 'Buyer', seller: 'Seller', admin: 'Admin' };
    roleEl.textContent = labels[state.userRole] || 'Buyer';
  }

  // Show Post Listing button for sellers
  if (sellBtn && state.userRole === 'seller') {
    sellBtn.style.display = 'flex';
  }
}

// ============================================================
// CATEGORY CHIPS
// ============================================================
function renderCategoryChips() {
  var bar = document.getElementById('catChipsBar');
  if (!bar) return;

  bar.innerHTML = CATEGORIES.map(function (cat) {
    var active = cat.id === state.activeCategory ? ' active' : '';
    return '<button class="mkt-cat-chip' + active + '" data-cat="' + esc(cat.id) + '" type="button" aria-pressed="' + (cat.id === state.activeCategory) + '">' +
      '<i class="fas ' + esc(cat.icon) + '" aria-hidden="true"></i>' +
      esc(cat.label) +
    '</button>';
  }).join('');

  bar.querySelectorAll('.mkt-cat-chip').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cat = btn.dataset.cat;
      if (cat === state.activeCategory) return;
      state.activeCategory = cat;
      state.lastDoc = null;
      state.hasMore = true;
      renderCategoryChips();

      var url = new URL(window.location.href);
      if (cat === 'all') url.searchParams.delete('cat');
      else url.searchParams.set('cat', cat);
      history.replaceState(null, '', url.toString());

      if (state.firebaseReady) {
        fetchListings(true);
      } else {
        renderDemoMode();
      }
    });
  });
}

// ============================================================
// FIRESTORE QUERY + FETCH
// ============================================================
function buildQuery() {
  var q = fbDB().collection('listings').where('status', '==', 'active');

  if (state.activeCategory !== 'all') {
    q = q.where('category', '==', state.activeCategory);
  }
  if (state.priceMin !== null) q = q.where('price', '>=', state.priceMin);
  if (state.priceMax !== null) q = q.where('price', '<=', state.priceMax);

  if (state.sortBy === 'price_asc') {
    q = q.orderBy('price', 'asc').orderBy('createdAt', 'desc');
  } else if (state.sortBy === 'price_desc') {
    q = q.orderBy('price', 'desc').orderBy('createdAt', 'desc');
  } else {
    q = q.orderBy('createdAt', 'desc');
  }

  return q;
}

function fetchListings(reset) {
  if (state.loading) return;
  if (!state.hasMore && !reset) return;

  state.loading = true;

  if (reset) {
    state.lastDoc = null;
    state.hasMore = true;
    state.listings = [];
    showSkeletons(PAGE_SIZE);
  } else {
    showSkeletons(4);
  }

  updateResultsCount('Loading…');

  var q = buildQuery().limit(PAGE_SIZE);
  if (state.lastDoc) q = q.startAfter(state.lastDoc);

  q.get()
    .then(function (snap) {
      var docs = snap.docs;

      if (docs.length < PAGE_SIZE) state.hasMore = false;
      if (docs.length > 0) state.lastDoc = docs[docs.length - 1];

      var newItems = docs.map(function (doc) {
        return Object.assign({ id: doc.id }, doc.data());
      });

      var filtered = filterLocally(newItems);

      if (reset) {
        state.listings = filtered;
      } else {
        state.listings = state.listings.concat(filtered);
      }

      hideSkeletons();
      renderGrid(state.listings, true);
      updateResultsCount(state.listings.length, state.hasMore);
      updateLoadMoreBtn();
      state.loading = false;
    })
    .catch(function (err) {
      hideSkeletons();
      state.loading = false;
      showFeedError(err);
      console.error('[Ludek] Firestore error:', err.code, err.message);
    });
}

// ============================================================
// LOCAL FILTER (search query applied client-side)
// ============================================================
function filterLocally(listings) {
  if (!state.searchQuery) return listings;
  var q = state.searchQuery.toLowerCase();
  return listings.filter(function (l) {
    return (
      (l.name        || '').toLowerCase().indexOf(q) !== -1 ||
      (l.description || '').toLowerCase().indexOf(q) !== -1 ||
      (l.category    || '').toLowerCase().indexOf(q) !== -1 ||
      (l.sellerName  || '').toLowerCase().indexOf(q) !== -1
    );
  });
}

// ============================================================
// RENDER GRID
// ============================================================
function renderGrid(listings, replace) {
  var grid = document.getElementById('mktGrid');
  if (!grid) return;

  if (replace) grid.innerHTML = '';

  if (!listings.length && replace) {
    grid.innerHTML = buildEmptyState();
    return;
  }

  var frag = document.createDocumentFragment();
  listings.forEach(function (listing) {
    frag.appendChild(buildProductCard(listing));
  });
  grid.appendChild(frag);
  lazyLoadImages();
}

// ============================================================
// BUILD PRODUCT CARD
// ============================================================
function buildProductCard(listing) {
  var el     = document.createElement('a');
  var catIcon = CAT_ICON[listing.category] || 'fa-tag';
  var catLabel = (CATEGORIES.find(function (c) { return c.id === listing.category; }) || { label: 'Other' }).label;
  var isSaved = !!state.savedItems[listing.id];
  var isNew   = isListingNew(listing.createdAt);
  var waMsg   = buildWAMessage(listing);
  var waNum   = (listing.whatsapp || '').replace(/\D/g, '');
  var waHref  = waNum ? 'https://wa.me/' + waNum + '?text=' + encodeURIComponent(waMsg) : '#';
  var imgSrc  = listing.imageURL || (listing.images && listing.images[0]) || '';
  var timeAgo = formatTimeAgo(listing.createdAt);

  el.className = 'product-card';
  el.href      = '/product.html?id=' + encodeURIComponent(listing.id);
  el.setAttribute('aria-label', esc(listing.name) + ' — ₦' + formatPrice(listing.price));
  el.dataset.id = listing.id;

  el.innerHTML =
    '<div class="product-card-img">' +
      (imgSrc
        ? '<img data-src="' + esc(imgSrc) + '" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 1 1\'/%3E" alt="' + esc(listing.name) + '" loading="lazy" />'
        : '<div class="product-card-img-placeholder"><i class="fas ' + catIcon + '" aria-hidden="true"></i></div>'
      ) +
      '<span class="product-card-cat-badge"><i class="fas ' + catIcon + '" aria-hidden="true"></i>' + esc(catLabel) + '</span>' +
      (isNew ? '<span class="product-card-new-badge">New</span>' : '') +
      '<button class="product-card-save' + (isSaved ? ' saved' : '') + '" data-lid="' + esc(listing.id) + '" type="button" aria-label="' + (isSaved ? 'Unsave' : 'Save') + '">' +
        '<i class="' + (isSaved ? 'fas' : 'far') + ' fa-heart" aria-hidden="true"></i>' +
      '</button>' +
    '</div>' +

    '<div class="product-card-body">' +
      '<div class="product-card-meta">' +
        '<span class="product-card-seller">' +
          '<i class="fas fa-shop" aria-hidden="true"></i>' +
          '<span>' + esc(listing.sellerName || 'Campus Seller') + '</span>' +
        '</span>' +
        '<span class="product-card-time">' + esc(timeAgo) + '</span>' +
      '</div>' +
      '<h3 class="product-card-name">' + esc(listing.name) + '</h3>' +
      (listing.description ? '<p class="product-card-desc">' + esc(listing.description) + '</p>' : '') +
      '<div class="product-card-footer">' +
        '<div>' +
          '<div class="product-card-price">₦' + formatPrice(listing.price) + '</div>' +
          (listing.negotiable ? '<div class="product-card-price-neg">Negotiable</div>' : '') +
        '</div>' +
        '<a class="product-card-wa" href="' + esc(waHref) + '" target="_blank" rel="noopener noreferrer" aria-label="Chat seller on WhatsApp" onclick="event.stopPropagation()">' +
          '<i class="fab fa-whatsapp" aria-hidden="true"></i>Chat' +
        '</a>' +
      '</div>' +
    '</div>';

  // Save button
  var saveBtn = el.querySelector('.product-card-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleSave(listing.id, saveBtn);
    });
  }

  return el;
}

// ============================================================
// SAVE / UNSAVE
// ============================================================
function toggleSave(listingId, btn) {
  if (!state.currentUser) {
    window.location.href = '/auth.html?mode=login';
    return;
  }

  var isSaved = !!state.savedItems[listingId];
  var icon    = btn.querySelector('i');

  if (isSaved) {
    delete state.savedItems[listingId];
    btn.classList.remove('saved');
    if (icon) icon.className = 'far fa-heart';
    btn.setAttribute('aria-label', 'Save');
  } else {
    state.savedItems[listingId] = true;
    btn.classList.add('saved');
    if (icon) icon.className = 'fas fa-heart';
    btn.setAttribute('aria-label', 'Unsave');
  }

  // Persist (non-blocking)
  fbDB().collection('users').doc(state.currentUser.uid).update({
    savedItems: Object.keys(state.savedItems)
  }).catch(function (e) { console.warn('[Ludek] Save error:', e.message); });
}

// ============================================================
// SKELETON LOADERS
// ============================================================
function showSkeletons(count) {
  var grid = document.getElementById('mktGrid');
  if (!grid || grid.children.length > 0) return;

  var html = '';
  for (var i = 0; i < count; i++) {
    html +=
      '<div class="skeleton-card" aria-hidden="true">' +
        '<div class="skeleton-img"></div>' +
        '<div class="skeleton-body">' +
          '<div class="skeleton-line short"></div>' +
          '<div class="skeleton-line wide"></div>' +
          '<div class="skeleton-line mid"></div>' +
          '<div class="skeleton-line price"></div>' +
        '</div>' +
      '</div>';
  }
  grid.innerHTML = html;
}

function hideSkeletons() {
  document.querySelectorAll('.skeleton-card').forEach(function (el) { el.remove(); });
}

// ============================================================
// EMPTY STATE
// ============================================================
function buildEmptyState() {
  var filtered = state.activeCategory !== 'all' || state.searchQuery || state.priceMin || state.priceMax;
  return '<div class="mkt-empty" role="status">' +
    '<div class="mkt-empty-icon"><i class="fas fa-store-slash" aria-hidden="true"></i></div>' +
    '<h3 class="mkt-empty-title">' + (filtered ? 'No listings found' : 'No listings yet') + '</h3>' +
    '<p class="mkt-empty-desc">' +
      (filtered
        ? 'Try adjusting your search or filter.'
        : 'Be the first to post a listing on campus!'
      ) +
    '</p>' +
    (filtered
      ? '<button class="btn btn-outline-forest" onclick="clearAllFilters()" type="button"><i class="fas fa-filter-slash"></i> Clear filters</button>'
      : '<a class="btn btn-primary" href="/seller/add-listing.html"><i class="fas fa-plus"></i> Post First Listing</a>'
    ) +
  '</div>';
}

// ============================================================
// FEED ERROR STATE
// ============================================================
function showFeedError(err) {
  var grid = document.getElementById('mktGrid');
  if (!grid) return;
  var isIndex = err && (err.code === 'failed-precondition' || (err.message || '').indexOf('index') !== -1);
  grid.innerHTML =
    '<div class="mkt-empty" role="alert">' +
      '<div class="mkt-empty-icon"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i></div>' +
      '<h3 class="mkt-empty-title">Couldn\'t load listings</h3>' +
      '<p class="mkt-empty-desc">' +
        (isIndex ? 'A Firestore index is required. Check the browser console for the auto-generated setup link.' : 'Check your internet connection and try again.') +
      '</p>' +
      '<button class="btn btn-outline-forest" onclick="fetchListings(true)" type="button"><i class="fas fa-rotate-right"></i> Retry</button>' +
    '</div>';
}

// ============================================================
// SEARCH
// ============================================================
function setupSearch() {
  var input   = document.getElementById('mktSearchInput');
  var clearBtn = document.getElementById('mktSearchClear');
  if (!input) return;

  var debounce;

  input.addEventListener('input', function () {
    state.searchQuery = input.value;
    if (clearBtn) clearBtn.classList.toggle('show', input.value.length > 0);
    clearTimeout(debounce);
    debounce = setTimeout(function () {
      state.lastDoc = null;
      state.hasMore = true;
      if (state.firebaseReady) fetchListings(true);
      else renderDemoMode();
    }, 350);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      input.value = '';
      state.searchQuery = '';
      clearBtn.classList.remove('show');
      state.lastDoc = null;
      state.hasMore = true;
      if (state.firebaseReady) fetchListings(true);
      else renderDemoMode();
      input.focus();
    });
  }
}

// ============================================================
// SORT
// ============================================================
function setupSort() {
  document.querySelectorAll('input[name="sortBy"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (radio.checked) {
        state.sortBy  = radio.value;
        state.lastDoc = null;
        state.hasMore = true;
        if (state.firebaseReady) fetchListings(true);
        else renderDemoMode();
      }
    });
  });
}

// ============================================================
// PRICE FILTER
// ============================================================
function setupPriceFilter() {
  document.querySelectorAll('.mkt-apply-btn').forEach(function (btn) {
    btn.addEventListener('click', applyPriceFilter);
  });
}

function applyPriceFilter() {
  var minEl = document.getElementById('priceMin');
  var maxEl = document.getElementById('priceMax');
  state.priceMin = (minEl && minEl.value) ? Number(minEl.value) : null;
  state.priceMax = (maxEl && maxEl.value) ? Number(maxEl.value) : null;
  state.lastDoc  = null;
  state.hasMore  = true;
  if (state.firebaseReady) fetchListings(true);
  else renderDemoMode();
  closeFilterDrawer();
}

// ============================================================
// CLEAR ALL FILTERS
// ============================================================
window.clearAllFilters = function () {
  state.activeCategory = 'all';
  state.searchQuery    = '';
  state.sortBy         = 'newest';
  state.priceMin       = null;
  state.priceMax       = null;
  state.lastDoc        = null;
  state.hasMore        = true;

  var searchInput = document.getElementById('mktSearchInput');
  if (searchInput) searchInput.value = '';
  var clearBtn = document.getElementById('mktSearchClear');
  if (clearBtn) clearBtn.classList.remove('show');
  var minEl = document.getElementById('priceMin');
  var maxEl = document.getElementById('priceMax');
  if (minEl) minEl.value = '';
  if (maxEl) maxEl.value = '';
  document.querySelectorAll('input[name="sortBy"]').forEach(function (r) {
    r.checked = r.value === 'newest';
  });

  renderCategoryChips();
  if (state.firebaseReady) fetchListings(true);
  else renderDemoMode();
};

// ============================================================
// VIEW TOGGLE
// ============================================================
function setupViewToggle() {
  var gridBtn = document.getElementById('viewGrid');
  var listBtn = document.getElementById('viewList');
  var grid    = document.getElementById('mktGrid');

  if (gridBtn) {
    gridBtn.addEventListener('click', function () {
      state.viewMode = 'grid';
      if (grid) grid.classList.remove('list-view');
      gridBtn.classList.add('active');
      if (listBtn) listBtn.classList.remove('active');
      try { localStorage.setItem('ludek-view', 'grid'); } catch (e) {}
    });
  }

  if (listBtn) {
    listBtn.addEventListener('click', function () {
      state.viewMode = 'list';
      if (grid) grid.classList.add('list-view');
      listBtn.classList.add('active');
      if (gridBtn) gridBtn.classList.remove('active');
      try { localStorage.setItem('ludek-view', 'list'); } catch (e) {}
    });
  }

  try {
    if (localStorage.getItem('ludek-view') === 'list' && listBtn) listBtn.click();
  } catch (e) {}
}

// ============================================================
// LOAD MORE
// ============================================================
function setupLoadMore() {
  var btn = document.getElementById('loadMoreBtn');
  if (!btn) return;
  btn.addEventListener('click', function () {
    if (!state.loading && state.hasMore) {
      if (state.firebaseReady) fetchListings(false);
    }
  });
}

function updateLoadMoreBtn() {
  var btn = document.getElementById('loadMoreBtn');
  if (!btn) return;
  btn.style.display = (state.hasMore && state.firebaseReady) ? 'inline-flex' : 'none';
}

function hideLoadMore() {
  var btn = document.getElementById('loadMoreBtn');
  if (btn) btn.style.display = 'none';
}

// ============================================================
// RESULTS COUNT
// ============================================================
function updateResultsCount(countOrMsg, hasMore) {
  var el = document.getElementById('resultsCount');
  if (!el) return;
  if (typeof countOrMsg === 'string') {
    el.innerHTML = countOrMsg;
    return;
  }
  var plus = hasMore ? '+' : '';
  el.innerHTML = '<strong>' + countOrMsg + plus + '</strong> listing' + (countOrMsg !== 1 ? 's' : '') + ' found';
}

// ============================================================
// FILTER DRAWER (mobile)
// ============================================================
function setupFilterDrawer() {
  var openBtn  = document.getElementById('mktFilterBtn');
  var overlay  = document.getElementById('filterDrawerOverlay');
  var closeBtn = document.getElementById('filterDrawerClose');
  var applyBtn = document.getElementById('filterDrawerApply');
  var resetBtn = document.getElementById('filterDrawerReset');

  if (openBtn)  openBtn.addEventListener('click',  openFilterDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeFilterDrawer);
  if (applyBtn) applyBtn.addEventListener('click', function () { applyPriceFilter(); });
  if (resetBtn) resetBtn.addEventListener('click', function () { window.clearAllFilters(); closeFilterDrawer(); });

  if (overlay) {
    overlay.addEventListener('click', function (e) {
      var drawer = overlay.querySelector('.filter-drawer');
      if (drawer && !drawer.contains(e.target)) closeFilterDrawer();
    });
  }

  // Sync drawer price inputs with sidebar inputs
  var minDrawer = document.getElementById('priceMinDrawer');
  var maxDrawer = document.getElementById('priceMaxDrawer');
  var minSide   = document.getElementById('priceMin');
  var maxSide   = document.getElementById('priceMax');
  if (minDrawer && minSide) minDrawer.addEventListener('input', function () { minSide.value = this.value; });
  if (maxDrawer && maxSide) maxDrawer.addEventListener('input', function () { maxSide.value = this.value; });
}

function openFilterDrawer() {
  var overlay = document.getElementById('filterDrawerOverlay');
  if (overlay) { overlay.classList.add('show'); document.body.style.overflow = 'hidden'; }
}

function closeFilterDrawer() {
  var overlay = document.getElementById('filterDrawerOverlay');
  if (overlay) { overlay.classList.remove('show'); document.body.style.overflow = ''; }
}

// ============================================================
// USER DROPDOWN
// ============================================================
function setupUserMenu() {
  var avatar  = document.getElementById('navAvatar');
  var menu    = document.getElementById('userDropdownMenu');
  var logoutBtn = document.getElementById('logoutBtn');

  if (avatar && menu) {
    avatar.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (menu.classList.contains('open') && !menu.contains(e.target) && e.target !== avatar) {
        menu.classList.remove('open');
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      if (state.firebaseReady) {
        fbAuth().signOut().then(function () {
          window.location.href = '/index.html';
        });
      } else {
        window.location.href = '/index.html';
      }
    });
  }
}

// ============================================================
// LAZY LOAD IMAGES
// ============================================================
function lazyLoadImages() {
  var imgs = document.querySelectorAll('img[data-src]');
  if (!imgs.length) return;

  if (!('IntersectionObserver' in window)) {
    imgs.forEach(function (img) { img.src = img.dataset.src; img.removeAttribute('data-src'); });
    return;
  }

  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        obs.unobserve(img);
      }
    });
  }, { rootMargin: '200px' });

  imgs.forEach(function (img) { obs.observe(img); });
}

// ============================================================
// READ URL PARAMS
// ============================================================
function readUrlParams() {
  var params = new URLSearchParams(window.location.search);
  var cat = params.get('cat');
  var q   = params.get('q');

  if (cat && CATEGORIES.some(function (c) { return c.id === cat; })) {
    state.activeCategory = cat;
  }
  if (q) {
    state.searchQuery = q;
    var input = document.getElementById('mktSearchInput');
    if (input) input.value = q;
  }
}

// ============================================================
// UTILITY HELPERS
// ============================================================
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString('en-NG');
}

function isListingNew(createdAt) {
  if (!createdAt) return false;
  var ms = createdAt.seconds ? createdAt.seconds * 1000 : Date.now();
  return (Date.now() - ms) < 86400000;
}

function formatTimeAgo(createdAt) {
  if (!createdAt) return '';
  var ms   = createdAt.seconds ? createdAt.seconds * 1000 : Date.now();
  var diff = (Date.now() - ms) / 1000;
  if (diff < 60)     return 'Just now';
  if (diff < 3600)   return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400)  return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return new Date(ms).toLocaleDateString('en-NG', { day:'numeric', month:'short' });
}

function buildWAMessage(listing) {
  return 'Hello, I found your listing on Ludek Marketplace (CRUTECH Okuku Campus).\n\nProduct: ' +
    (listing.name || '') + '\nPrice: ₦' + formatPrice(listing.price) + '\n\nIs it still available?';
}


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMarketplace);
} else {
  initMarketplace();
}
