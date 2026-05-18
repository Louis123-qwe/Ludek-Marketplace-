// ============================================================
// LUDEK MARKETPLACE — SELLER-PUBLIC.JS
// Phase 6 — Public Seller Storefront (seller.html)
// Reads ?id=<sellerId> from URL, fetches seller profile + 
// all their active listings from Firestore.
// Category filter tabs, WhatsApp CTA, share, stats.
// Falls back to demo data if Firebase not configured.
// ============================================================

'use strict';

// ============================================================
// CONSTANTS
// ============================================================
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

var CAT_LABEL = {
  electronics: 'Electronics',
  fashion:     'Fashion',
  food:        'Food',
  books:       'Books',
  hostel:      'Hostel',
  services:    'Services',
  tutoring:    'Tutoring',
  housing:     'Housing'
};

// ── Demo seller data ─────────────────────────────────────────
var DEMO_SELLERS = {
  seller1: {
    storeName: 'ChidiTech Hub',
    firstName: 'Chidi', lastName: 'Okon',
    description: 'Your number one stop for quality electronics, gadgets and tech accessories on CRUTECH Okuku campus. All devices tested before sale. DM for custom orders.',
    photoURL:    '',
    bannerURL:   '',
    whatsapp:    '2348012345678',
    joinedAt:    { seconds: Math.floor(Date.now()/1000) - 7776000 }
  },
  seller2: {
    storeName: "Ada's Bookstore",
    firstName: 'Ada', lastName: 'Nkemdi',
    description: 'Affordable textbooks for all levels. I buy and sell used academic books. Save money, help a fellow student.',
    photoURL:    '',
    bannerURL:   '',
    whatsapp:    '2348023456789',
    joinedAt:    { seconds: Math.floor(Date.now()/1000) - 5184000 }
  },
  seller3: {
    storeName: 'Sunday Properties',
    firstName: 'Sunday', lastName: 'Eze',
    description: 'Find comfortable and affordable student accommodation near CRUTECH Okuku campus. I have hostel spaces and self-contain rooms available.',
    photoURL:    '',
    bannerURL:   '',
    whatsapp:    '2348034567890',
    joinedAt:    { seconds: Math.floor(Date.now()/1000) - 9504000 }
  }
};

var DEMO_LISTINGS = [
  { id:'d1',  sellerId:'seller1', name:'HP Pavilion Laptop (i5)',      price:45000, category:'electronics', imageUrl:'', negotiable:true,  views:142, createdAt:{ seconds: Math.floor(Date.now()/1000) - 3600   }, status:'active' },
  { id:'d7',  sellerId:'seller1', name:'Samsung Galaxy A54',            price:85000, category:'electronics', imageUrl:'', negotiable:true,  views:420, createdAt:{ seconds: Math.floor(Date.now()/1000) - 43200  }, status:'active' },
  { id:'d10', sellerId:'seller1', name:'Used Science Textbooks',        price:1500,  category:'books',       imageUrl:'', negotiable:true,  views:61,  createdAt:{ seconds: Math.floor(Date.now()/1000) - 10800  }, status:'active' },
  { id:'d2',  sellerId:'seller2', name:'Law Textbooks Bundle',          price:3500,  category:'books',       imageUrl:'', negotiable:false, views:89,  createdAt:{ seconds: Math.floor(Date.now()/1000) - 7200   }, status:'active' },
  { id:'d11', sellerId:'seller2', name:'Ankara Fashion Set (Female)',   price:5500,  category:'fashion',     imageUrl:'', negotiable:false, views:47,  createdAt:{ seconds: Math.floor(Date.now()/1000) - 21600  }, status:'active' },
  { id:'d3',  sellerId:'seller3', name:'Self-Contain Room (Off-campus)',price:15000, category:'housing',     imageUrl:'', negotiable:true,  views:310, createdAt:{ seconds: Math.floor(Date.now()/1000) - 86400  }, status:'active' },
  { id:'d8',  sellerId:'seller3', name:'Female Hostel Bed Space',       price:25000, category:'hostel',      imageUrl:'', negotiable:false, views:198, createdAt:{ seconds: Math.floor(Date.now()/1000) - 72000  }, status:'active' },
  { id:'d12', sellerId:'seller3', name:'Economics Tutoring (ECO 201)',  price:2500,  category:'tutoring',    imageUrl:'', negotiable:true,  views:38,  createdAt:{ seconds: Math.floor(Date.now()/1000) - 3000   }, status:'active' }
];

// ============================================================
// STATE
// ============================================================
var state = {
  firebaseReady   : false,
  sellerId        : null,
  sellerData      : null,
  allListings     : [],
  filteredListings: [],
  activeCategory  : 'all',
  currentUser     : null
};

// ============================================================
// FIREBASE
// ============================================================
function initFirebase() {
  var cfg = window.LUDEK_FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || cfg.apiKey === 'YOUR_API_KEY') return false;
  if (!firebase.apps.length) firebase.initializeApp(cfg);
  state.firebaseReady = true;
  return true;
}

function fbAuth() { return firebase.auth(); }
function fbDB()   { return firebase.firestore(); }

// ============================================================
// ENTRY POINT
// ============================================================
function initSellerPage() {
  var params = new URLSearchParams(window.location.search);
  state.sellerId = params.get('id') || '';

  if (!state.sellerId) {
    showNotFound();
    return;
  }

  setupNav();
  setupScrollTop();

  var ready = initFirebase();

  if (!ready) {
    // Demo mode
    var demoSeller = DEMO_SELLERS[state.sellerId];
    if (!demoSeller) {
      // No exact match — show first demo seller for preview
      var keys = Object.keys(DEMO_SELLERS);
      if (!keys.length) { showNotFound(); return; }
      state.sellerId = keys[0];
      demoSeller = DEMO_SELLERS[state.sellerId];
    }
    state.sellerData = demoSeller;
    var demoListings = DEMO_LISTINGS.filter(function (l) { return l.sellerId === state.sellerId; });
    renderSellerProfile(demoSeller);
    renderListings(demoListings);
    buildCategoryTabs(demoListings);
    updateStats(demoListings);
    return;
  }

  // Firebase — auth optional
  fbAuth().onAuthStateChanged(function (user) {
    state.currentUser = user;
    if (user) updateNavUser(user);
    else hideNavUser();

    // Fetch seller data
    fetchSellerProfile();
  });
}

// ============================================================
// FETCH SELLER PROFILE
// ============================================================
function fetchSellerProfile() {
  fbDB().collection('users').doc(state.sellerId).get()
    .then(function (snap) {
      if (!snap.exists) { showNotFound(); return; }
      var data = snap.data();

      // Only show sellers (not plain customers)
      if (data.role !== 'seller' && data.role !== 'admin') {
        showNotFound();
        return;
      }

      state.sellerData = data;
      renderSellerProfile(data);
      fetchSellerListings();
    })
    .catch(function () { showNotFound(); });
}

// ============================================================
// FETCH LISTINGS
// ============================================================
function fetchSellerListings() {
  fbDB().collection('listings')
    .where('sellerId', '==', state.sellerId)
    .where('status', '==', 'active')
    .orderBy('createdAt', 'desc')
    .get()
    .then(function (snap) {
      var items = [];
      snap.forEach(function (doc) {
        var d = doc.data(); d.id = doc.id;
        items.push(d);
      });
      state.allListings = items;
      buildCategoryTabs(items);
      renderListings(items);
      updateStats(items);
    })
    .catch(function () {
      hideLoading();
      showEmpty('Could not load listings.');
    });
}

// ============================================================
// RENDER SELLER PROFILE
// ============================================================
function renderSellerProfile(data) {
  // Show profile section
  var profile = document.getElementById('sellerProfile');
  if (profile) profile.style.display = '';

  // Store name
  var storeName = data.storeName || [data.firstName, data.lastName].filter(Boolean).join(' ') || 'Seller';
  setText('spfStoreName', storeName);

  // Real name (if store name differs)
  var realName = [data.firstName, data.lastName].filter(Boolean).join(' ');
  if (realName && realName !== storeName) {
    setText('spfRealName', realName);
  }

  // OG / document title
  document.title = storeName + ' — Ludek Marketplace';
  setMeta('ogTitle', storeName + ' — Seller on Ludek Marketplace (CRUTECH Okuku)');
  setMeta('ogDescription', (data.description || '').substring(0, 160) || 'Browse listings from ' + storeName + ' on Ludek Marketplace.');

  // Joined badge
  if (data.joinedAt) {
    var ms = data.joinedAt.seconds ? data.joinedAt.seconds * 1000 : Date.now();
    setText('spfBadgeJoined', 'Joined ' + new Date(ms).toLocaleDateString('en-NG', { month:'long', year:'numeric' }));
  }

  // Avatar
  if (data.photoURL) {
    var avatarEl = document.getElementById('spfAvatar');
    if (avatarEl) {
      avatarEl.innerHTML = '<img src="' + esc(data.photoURL) + '" alt="' + esc(storeName) + '" />';
    }
    setMeta('ogImage', data.photoURL);
  }

  // Banner
  if (data.bannerURL) {
    var bannerImg = document.getElementById('spfBannerImg');
    var bannerPh  = document.getElementById('spfBannerPlaceholder');
    if (bannerImg) {
      bannerImg.src = data.bannerURL;
      bannerImg.classList.remove('hidden');
      if (bannerPh) bannerPh.style.display = 'none';
    }
  }

  // Description
  if (data.description) {
    var descBlock = document.getElementById('spfDescBlock');
    if (descBlock) descBlock.style.display = '';
    setText('spfDesc', data.description);
  }

  // WhatsApp CTA
  var waBtn = document.getElementById('spfWhatsAppBtn');
  if (waBtn) {
    var waNum = (data.whatsapp || '').replace(/\D/g, '');
    if (waNum) {
      var waMsg = 'Hello, I found your store on Ludek Marketplace (CRUTECH Okuku Campus). I\'d like to enquire about your listings.';
      waBtn.href = 'https://wa.me/' + waNum + '?text=' + encodeURIComponent(waMsg);
    } else {
      waBtn.classList.add('disabled');
      waBtn.innerHTML = '<i class="fab fa-whatsapp"></i> No WhatsApp Set';
    }
  }

  // Share button
  setupShareBtn(storeName);
}

// ============================================================
// CATEGORY TABS
// ============================================================
function buildCategoryTabs(listings) {
  var tabsWrap = document.getElementById('spfFilterTabs');
  if (!tabsWrap) return;

  // Get unique categories present in listings
  var cats = {};
  listings.forEach(function (l) {
    if (l.category) cats[l.category] = (cats[l.category] || 0) + 1;
  });

  var catKeys = Object.keys(cats);
  if (catKeys.length <= 1) {
    // Only one category — hide tabs
    var filterRow = document.getElementById('spfFilterRow');
    if (filterRow && catKeys.length <= 1) filterRow.style.display = 'none';
    return;
  }

  // Build tabs (keep "All" first)
  var extraTabs = '';
  catKeys.forEach(function (cat) {
    var icon  = CAT_ICON[cat]  || 'fa-tag';
    var label = CAT_LABEL[cat] || cap(cat);
    extraTabs += '<button class="spf-tab" data-cat="' + esc(cat) + '">' +
      '<i class="fas ' + icon + '"></i> ' + esc(label) +
      ' <span style="opacity:0.6;font-size:11px;margin-left:4px;">(' + cats[cat] + ')</span>' +
    '</button>';
  });

  // Insert after "All" tab
  var allTab = tabsWrap.querySelector('[data-cat="all"]');
  if (allTab) allTab.insertAdjacentHTML('afterend', extraTabs);

  // Update "All" count
  if (allTab) {
    allTab.innerHTML = '<i class="fas fa-fire-flame-curved"></i> All <span style="opacity:0.6;font-size:11px;margin-left:4px;">(' + listings.length + ')</span>';
  }

  // Tab click events
  tabsWrap.querySelectorAll('.spf-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabsWrap.querySelectorAll('.spf-tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      state.activeCategory = tab.dataset.cat || 'all';
      filterAndRender();
    });
  });
}

function filterAndRender() {
  var cat = state.activeCategory;
  var filtered = cat === 'all'
    ? state.allListings
    : state.allListings.filter(function (l) { return l.category === cat; });
  renderListings(filtered);
}

// ============================================================
// RENDER LISTINGS
// ============================================================
function renderListings(listings) {
  hideLoading();
  var grid = document.getElementById('spfGrid');
  if (!grid) return;

  grid.innerHTML = '';

  if (!listings || !listings.length) {
    showEmpty(state.activeCategory === 'all'
      ? 'This seller has no active listings.'
      : 'No listings in this category.');
    return;
  }

  hideEmpty();

  listings.forEach(function (item) {
    var card = buildCard(item);
    grid.appendChild(card);
  });

  // Lazy load images
  lazyLoadImages();
}

function buildCard(item) {
  var card = document.createElement('a');
  card.href = 'product.html?id=' + encodeURIComponent(item.id);
  card.className = 'spf-card';

  var icon  = CAT_ICON[item.category] || 'fa-tag';
  var label = CAT_LABEL[item.category] || cap(item.category || '');
  var isNewListing = isNew(item.createdAt);

  // Image area
  var imgHtml;
  if (item.imageUrl) {
    imgHtml = '<img data-src="' + esc(item.imageUrl) + '" alt="' + esc(item.name) + '" loading="lazy" src="" />';
  } else {
    imgHtml = '<i class="fas ' + icon + '"></i>';
  }

  // WhatsApp msg
  var waNum = (state.sellerData && state.sellerData.whatsapp || '').replace(/\D/g, '');
  var waMsg = 'Hello, I found your listing on Ludek Marketplace (CRUTECH Okuku Campus).\n\nProduct: ' +
    (item.name || '') + '\nPrice: ₦' + formatPrice(item.price) + '\n\nIs it still available?';
  var waHref = waNum ? ('https://wa.me/' + waNum + '?text=' + encodeURIComponent(waMsg)) : '#';

  card.innerHTML =
    '<div class="spf-card-img">' +
      imgHtml +
      (isNewListing ? '<span class="spf-card-badge">NEW</span>' : '') +
    '</div>' +
    '<div class="spf-card-body">' +
      '<div class="spf-card-cat"><i class="fas ' + icon + '"></i> ' + esc(label) + '</div>' +
      '<div class="spf-card-name">' + esc(item.name) + '</div>' +
      '<div class="spf-card-price-row">' +
        '<span class="spf-card-price">₦' + formatPrice(item.price) + '</span>' +
        (item.negotiable ? '<span class="spf-card-neg">Negotiable</span>' : '') +
      '</div>' +
      '<a href="' + esc(waHref) + '" class="spf-card-wa" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();">' +
        '<i class="fab fa-whatsapp"></i> Chat Seller' +
      '</a>' +
    '</div>';

  return card;
}

// ============================================================
// STATS
// ============================================================
function updateStats(listings) {
  // Total listings
  setText('spfStatListings', listings.length);

  // Total views
  var totalViews = listings.reduce(function (acc, l) { return acc + (l.views || 0); }, 0);
  setText('spfStatViews', totalViews > 999 ? (Math.floor(totalViews/1000) + 'k') : totalViews);

  // Unique categories
  var cats = {};
  listings.forEach(function (l) { if (l.category) cats[l.category] = true; });
  setText('spfStatCategories', Object.keys(cats).length);
}

// ============================================================
// SHARE BUTTON
// ============================================================
function setupShareBtn(storeName) {
  var btn = document.getElementById('spfShareBtn');
  if (!btn) return;

  btn.addEventListener('click', function () {
    var url  = window.location.href;
    var text = 'Check out ' + storeName + '\'s store on Ludek Marketplace (CRUTECH Okuku Campus):\n' + url;

    if (navigator.share) {
      navigator.share({ title: storeName + ' — Ludek Marketplace', text: text, url: url })
        .catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(function () { showToast('Store link copied!', 'success'); })
        .catch(function () { showToast('Could not copy link.', 'error'); });
    } else {
      showToast('Store link copied!', 'success');
    }
  });
}

// ============================================================
// NAV
// ============================================================
function setupNav() {
  var hamburger  = document.getElementById('navHamburger');
  var mobileMenu = document.getElementById('navMobile');
  var nav        = document.getElementById('mainNav');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', function () {
      var open = mobileMenu.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    document.addEventListener('click', function (e) {
      if (mobileMenu.classList.contains('open') && !mobileMenu.contains(e.target) && !hamburger.contains(e.target)) {
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  if (nav) {
    window.addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });
  }
}

function setupScrollTop() {
  var btn = document.getElementById('scrollTopBtn');
  if (!btn) return;
  window.addEventListener('scroll', function () {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function updateNavUser(user) {
  var wrap = document.getElementById('navUserWrap');
  if (wrap) wrap.style.display = 'flex';

  var loginBtn  = document.getElementById('navLoginBtn');
  var signupBtn = document.getElementById('navSignupBtn');
  if (loginBtn)  loginBtn.style.display = 'none';
  if (signupBtn) signupBtn.style.display = 'none';

  if (!state.firebaseReady) return;

  fbDB().collection('users').doc(user.uid).get()
    .then(function (snap) {
      if (!snap.exists) return;
      var d = snap.data();
      setText('navUserName', d.storeName || d.firstName || user.email);
      setText('navUserRole', d.role === 'seller' ? 'Seller' : 'Student');

      if (d.role === 'seller' || d.role === 'admin') {
        var dashLink = document.getElementById('sellerDashLink');
        if (dashLink) dashLink.style.display = 'flex';
        var mobDash = document.getElementById('mobileDashLink');
        if (mobDash) mobDash.style.display = 'flex';
      }
    })
    .catch(function () {});

  var avatarBtn = document.getElementById('navAvatar');
  var dropMenu  = document.getElementById('userDropdownMenu');
  if (avatarBtn && dropMenu) {
    avatarBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      dropMenu.classList.toggle('open');
    });
    document.addEventListener('click', function () { dropMenu.classList.remove('open'); });
  }

  var logoutBtn    = document.getElementById('logoutBtn');
  var mobileLogout = document.getElementById('mobileLogoutBtn');
  function doLogout(e) {
    e.preventDefault();
    fbAuth().signOut().then(function () { window.location.href = 'index.html'; }).catch(function () {});
  }
  if (logoutBtn)    logoutBtn.addEventListener('click', doLogout);
  if (mobileLogout) {
    mobileLogout.style.display = '';
    mobileLogout.addEventListener('click', doLogout);
  }

  var mLogin  = document.getElementById('mobileLoginLink');
  var mSignup = document.getElementById('mobileSignupLink');
  if (mLogin)  mLogin.style.display = 'none';
  if (mSignup) mSignup.style.display = 'none';
}

function hideNavUser() {
  var wrap = document.getElementById('navUserWrap');
  if (wrap) wrap.style.display = 'none';
}

// ============================================================
// UI HELPERS
// ============================================================
function showNotFound() {
  var el = document.getElementById('sellerNotFound');
  if (el) el.classList.remove('hidden');
  document.title = 'Store Not Found — Ludek Marketplace';
}

function hideLoading() {
  var el = document.getElementById('spfLoading');
  if (el) el.style.display = 'none';
}

function showEmpty(msg) {
  var el   = document.getElementById('spfEmpty');
  var title= document.getElementById('spfEmptyTitle');
  if (el)    el.classList.remove('hidden');
  if (title && msg) title.textContent = msg;
}

function hideEmpty() {
  var el = document.getElementById('spfEmpty');
  if (el) el.classList.add('hidden');
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
// UTILITIES
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

function isNew(createdAt) {
  if (!createdAt) return false;
  var ms = createdAt.seconds ? createdAt.seconds * 1000 : Date.now();
  return (Date.now() - ms) < 86400000;
}

function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = (val !== null && val !== undefined) ? val : '—';
}

function setMeta(id, content) {
  var el = document.getElementById(id);
  if (el) el.setAttribute('content', content);
}

function cap(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

// ============================================================
// BOOT
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSellerPage);
} else {
  initSellerPage();
}
