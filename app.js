// ============================================================
// LUDEK MARKETPLACE — APP.JS (Core JS)
// ============================================================

'use strict';

// ============================================================
// PWA — SERVICE WORKER REGISTRATION
// ============================================================
(function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('sw.js')
        .then((reg) => {
          console.log('[Ludek] Service Worker registered:', reg.scope);

          // Check for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                showToast('App updated! Refresh for the latest version.', 'info');
              }
            });
          });
        })
        .catch((err) => {
          console.warn('[Ludek] SW registration failed:', err);
        });
    });
  }
})();

// ============================================================
// PWA — INSTALL PROMPT
// ============================================================
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;

  // Only show if not dismissed before
  const dismissed = sessionStorage.getItem('install-dismissed');
  if (!dismissed) {
    setTimeout(() => showInstallBanner(), 3000);
  }
});

window.addEventListener('appinstalled', () => {
  hideInstallBanner();
  deferredInstallPrompt = null;
  showToast('Ludek Marketplace installed successfully!', 'success');
});

function showInstallBanner() {
  const banner = document.getElementById('installBanner');
  if (banner) banner.classList.add('show');
}

function hideInstallBanner() {
  const banner = document.getElementById('installBanner');
  if (banner) banner.classList.remove('show');
}

function setupInstallBanner() {
  const btnYes = document.getElementById('installYes');
  const btnNo  = document.getElementById('installNo');

  if (btnYes) {
    btnYes.addEventListener('click', async () => {
      hideInstallBanner();
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        console.log('[Ludek] Install outcome:', outcome);
        deferredInstallPrompt = null;
      }
    });
  }

  if (btnNo) {
    btnNo.addEventListener('click', () => {
      hideInstallBanner();
      sessionStorage.setItem('install-dismissed', 'true');
    });
  }
}

// ============================================================
// NAVIGATION — SCROLL BEHAVIOR + MOBILE MENU
// ============================================================
function setupNavigation() {
  const nav       = document.getElementById('mainNav');
  const hamburger = document.getElementById('navHamburger');
  const mobileMenu= document.getElementById('navMobile');
  const hamburgerIcon = hamburger ? hamburger.querySelector('i') : null;

  // Scroll → add shadow class
  if (nav) {
    const onScroll = () => {
      if (window.scrollY > 20) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // run once on load
  }

  // Mobile menu toggle
  let menuOpen = false;

  function openMenu() {
    menuOpen = true;
    if (mobileMenu) mobileMenu.classList.add('open');
    if (hamburgerIcon) {
      hamburgerIcon.classList.remove('fa-bars');
      hamburgerIcon.classList.add('fa-xmark');
    }
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    menuOpen = false;
    if (mobileMenu) mobileMenu.classList.remove('open');
    if (hamburgerIcon) {
      hamburgerIcon.classList.remove('fa-xmark');
      hamburgerIcon.classList.add('fa-bars');
    }
    document.body.style.overflow = '';
  }

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      if (menuOpen) closeMenu(); else openMenu();
    });
  }

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (menuOpen && nav && !nav.contains(e.target) && mobileMenu && !mobileMenu.contains(e.target)) {
      closeMenu();
    }
  });

  // Close on resize to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768 && menuOpen) closeMenu();
  }, { passive: true });

  // Close mobile menu on link click
  if (mobileMenu) {
    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', closeMenu);
    });
  }
}

// ============================================================
// SCROLL TO TOP BUTTON
// ============================================================
function setupScrollTop() {
  const btn = document.getElementById('scrollTopBtn');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'fa-circle-check',
    error:   'fa-circle-xmark',
    info:    'fa-circle-info'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fas ${icons[type] || icons.info}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  // Auto-remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// Expose globally
window.showToast = showToast;

// ============================================================
// SMOOTH SCROLL FOR ANCHOR LINKS
// ============================================================
function setupSmoothScroll() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// ============================================================
// INTERSECTION OBSERVER — ANIMATE ON SCROLL
// ============================================================
function setupScrollAnimations() {
  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
  );

  document.querySelectorAll('[data-animate]').forEach((el) => {
    observer.observe(el);
  });
}

// ============================================================
// PAGE LOADER
// ============================================================
function hidePageLoader() {
  const loader = document.getElementById('pageLoader');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 500);
  }
}

// ============================================================
// INIT
// ============================================================
function init() {
  setupNavigation();
  setupScrollTop();
  setupSmoothScroll();
  setupInstallBanner();
  setupScrollAnimations();
}

// Run after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
