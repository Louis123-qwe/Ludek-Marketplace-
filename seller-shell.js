'use strict';

// ============================================================
// SELLER SHELL — shared across all seller/* pages
// Handles: auth guard, sidebar toggle, profile hydration,
//          logout, listing count badge
// ============================================================

async function registerFCMToken(uid) {
  try {
    if (!firebase.messaging || typeof firebase.messaging !== 'function') return;
    const messaging = firebase.messaging();

    const VAPID_KEY = 'BJ99V5eLRXBR5XxzyzSimoxHhg2YL4UBgJxvzEcy3CfwbdE9PPCc8MJM1BwA6UL4D-T6e6Q4v3SnhYIdO8wBaJE';

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: await navigator.serviceWorker.ready });
    if (!token) return;

    await firebase.firestore().collection('users').doc(uid).update({ fcmToken: token });
    console.log('[Ludek FCM] Token registered:', token.slice(0, 20) + '…');
} catch (err) {
  console.warn('[Ludek FCM] Token registration skipped:', err.message);
  alert('[FCM Error] ' + err.message);
  }
}

(function SellerShell() {

  // ── Wait for Firebase auth state ──────────────────────────
    // ── Wait for Firebase auth state & Initialization ─────────


// seller-shell.js — replace waitForFirebase with a version that has a timeout

function waitForFirebase(cb) {
  var elapsed = 0;
  var MAX_WAIT = 8000; // 8 seconds — generous for slow connections
  var INTERVAL = 60;

  var check = setInterval(function () {
    elapsed += INTERVAL;

    if (window.firebase && window.firebase.apps !== undefined) {
      clearInterval(check);

      var cfg = window.LUDEK_FIREBASE_CONFIG;
      if (cfg && cfg.apiKey && !firebase.apps.length) {
        firebase.initializeApp(cfg);
      }

      if (firebase.apps && firebase.apps.length > 0) {
        cb();
      } else {
        // Config is missing even after Firebase loaded — redirect to auth
        window.location.replace('/auth.html?mode=login');
      }
      return;
    }

    // ✅ NEW: bail out after MAX_WAIT instead of hanging forever
    if (elapsed >= MAX_WAIT) {
      clearInterval(check);
      // Hide the loader and show an error message instead of hanging
      var loader = document.getElementById('pageLoader');
      if (loader) {
        loader.innerHTML = '<div style="text-align:center;padding:40px;font-family:sans-serif;">' +
          '<p style="font-size:16px;color:#333;">Could not connect to the server.</p>' +
          '<p style="font-size:13px;color:#666;margin-top:8px;">Check your connection and ' +
          '<a href="" style="color:#2D5016;">refresh the page</a>.</p></div>';
      }
    }
  }, INTERVAL);
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
      registerFCMToken(user.uid);

    } catch (err) {
      console.error('[Shell] Firestore error:', err);
      showToast('Could not load your profile. Please refresh.', 'error');
    }
  });
}

  // ── Hydrate Sidebar & Topbar ──────────────────────────────
function hydrateShell(user, data) {
  var fullName = [data.firstName, data.lastName].filter(Boolean).join(' ') || user.email;
  var storeName = data.storeName || fullName;
  
  var sidebarName = document.getElementById('sidebarName');
  if (sidebarName) sidebarName.textContent = storeName;
  
  var welcomeName = document.getElementById('welcomeName');
  if (welcomeName) welcomeName.textContent = data.firstName || 'Seller';
  
  if (data.photoURL) {
    setAvatarImage('sidebarAvatar', data.photoURL);
    setAvatarImage('topbarAvatar', data.photoURL);
  }
  
  window._sellerUser = user;
  window._sellerData = data;
  
  // Reveal content only after auth is confirmed
  var shell = document.getElementById('sellerShell');
  if (shell) shell.style.visibility = '';
  
  var loader = document.getElementById('pageLoader');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(function() { loader.remove(); }, 500);
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
