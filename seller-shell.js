'use strict';

// ============================================================
// SELLER SHELL — shared across all seller/* pages
// Handles: auth guard, sidebar toggle, profile hydration,
//          logout, listing count badge
// ============================================================

(function SellerShell() {

  // ── Wait for Firebase auth state ──────────────────────────
    // ── Wait for Firebase auth state & Initialization ─────────


function waitForFirebase(cb) {
  var check = setInterval(function () {
    if (window.firebase && window.firebase.apps !== undefined) {
      clearInterval(check);

      // Initialize if not already done (seller pages don't load auth.js)
      var cfg = window.LUDEK_FIREBASE_CONFIG;
      if (cfg && cfg.apiKey && !firebase.apps.length) {
        firebase.initializeApp(cfg);
      }

      // Now check apps are ready
      if (firebase.apps && firebase.apps.length > 0) {
        cb();
      } else {
        // Config missing — redirect to auth for safety
        window.location.replace('/auth.html?mode=login');
      }
    }
  }, 60);
}


  // ── Auth Guard ────────────────────────────────────────────
  // Redirect unauthenticated users to auth page.
  // Redirect non-sellers (customers) back to marketplace.
  

function initAuthGuard() {
  var authResolved = false;

  firebase.auth().onAuthStateChanged(async function (user) {
    if (!user && !authResolved) {
      setTimeout(function () {
        if (!authResolved) {
          window.location.replace(
            '/auth.html?mode=login&next=' + encodeURIComponent(window.location.pathname)
          );
        }
      }, 2000);
      return;
    }

    authResolved = true;

    if (!user) {
      window.location.replace(
        '/auth.html?mode=login&next=' + encodeURIComponent(window.location.pathname)
      );
      return;
    }

    try {
      const doc = await firebase.firestore().collection('users').doc(user.uid).get();
      if (!doc.exists) {
        window.location.replace('/auth.html?mode=login');
        return;
      }

      const data = doc.data();

      if (data.role !== 'seller' && data.role !== 'admin') {
        window.location.replace('/marketplace.html');
        return;
      }

      hydrateShell(user, data);
      loadListingCount(user.uid);
      window.dispatchEvent(new CustomEvent('seller:ready', { detail: { user, data } }));

    } catch (err) {
      console.error('[Shell] Firestore error:', err);
      showToast('Could not load your profile. Please refresh.', 'error');
    }
  });
}

  // ── Hydrate Sidebar & Topbar ──────────────────────────────
  function hydrateShell(user, data) {
    const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ') || user.email;
    const storeName = data.storeName || fullName;

    // Sidebar name
    const sidebarName = document.getElementById('sidebarName');
    if (sidebarName) sidebarName.textContent = storeName;

    // Welcome name on dashboard
    const welcomeName = document.getElementById('welcomeName');
    if (welcomeName) welcomeName.textContent = data.firstName || 'Seller';

    // Avatar — sidebar + topbar
    if (data.photoURL) {
      setAvatarImage('sidebarAvatar', data.photoURL);
      setAvatarImage('topbarAvatar', data.photoURL);
    }

    // Store current user data globally so page scripts can access it
    window._sellerUser = user;
    window._sellerData = data;
  var loader = document.getElementById('pageLoader');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(function () { loader.remove(); }, 500);
  }
  }

  function setAvatarImage(wrapperId, url) {
    const wrap = document.getElementById(wrapperId);
    if (!wrap) return;
    wrap.innerHTML = `<img src="${url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />`;
  }

  // ── Listing Count Badge ───────────────────────────────────
  async function loadListingCount(uid) {
    try {
      const snap = await firebase.firestore()
        .collection('listings')
        .where('sellerId', '==', uid)
        .get();

      const count = snap.size;
      document.querySelectorAll('#listingCountBadge').forEach(el => {
        el.textContent = count;
        el.style.display = count > 0 ? '' : 'none';
      });
    } catch (e) {
      // silent — badge stays at 0
    }
  }

  // ── Sidebar Toggle (mobile) ───────────────────────────────
  function initSidebarToggle() {
    const sidebar  = document.getElementById('sellerSidebar');
    const overlay  = document.getElementById('sidebarOverlay');
    const openBtn  = document.getElementById('topbarHamburger');
    const closeBtn = document.getElementById('sidebarClose');

    function openSidebar() {
      sidebar && sidebar.classList.add('open');
      overlay && overlay.classList.add('show');
      document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
      sidebar && sidebar.classList.remove('open');
      overlay && overlay.classList.remove('show');
      document.body.style.overflow = '';
    }

    openBtn  && openBtn.addEventListener('click', openSidebar);
    closeBtn && closeBtn.addEventListener('click', closeSidebar);
    overlay  && overlay.addEventListener('click', closeSidebar);

    // Close on nav link click (mobile)
    sidebar && sidebar.querySelectorAll('.sidebar-nav-link').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 900) closeSidebar();
      });
    });

    // Close on resize to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 900) closeSidebar();
    }, { passive: true });
  }

  // ── Logout ────────────────────────────────────────────────
  function initLogout() {
    const btn = document.getElementById('logoutBtn');
    if (!btn) return;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await firebase.auth().signOut();
        window.location.replace('/auth.html?mode=login');
      } catch (err) {
        showToast('Logout failed. Try again.', 'error');
      }
    });
  }

  // ── Boot ──────────────────────────────────────────────────
  waitForFirebase(() => {
    initSidebarToggle();
    initLogout();
    initAuthGuard();
  });

})();
