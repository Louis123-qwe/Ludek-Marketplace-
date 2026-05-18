'use strict';

// ============================================================
// DASHBOARD.JS
// Loads: stats, recent listings, profile completeness
// Depends on: seller-shell.js firing 'seller:ready'
// ============================================================

(function Dashboard() {

  // ── Listen for auth-ready signal from shell ───────────────
  window.addEventListener('seller:ready', ({ detail: { user, data } }) => {
    loadStats(user.uid);
    loadRecentListings(user.uid);
    renderCompleteness(data);
  });

  // ── STATS ─────────────────────────────────────────────────
  async function loadStats(uid) {
    try {
      const snap = await firebase.firestore()
        .collection('listings')
        .where('sellerId', '==', uid)
        .get();

      let totalViews  = 0;
      let activeCount = 0;
      let chatTaps    = 0;

      snap.forEach(doc => {
        const d = doc.data();
        totalViews  += d.views    || 0;
        chatTaps    += d.chatTaps || 0;
        if (d.status === 'active') activeCount++;
      });

      animateCounter('statListings', snap.size);
      animateCounter('statViews',    totalViews);
      animateCounter('statActive',   activeCount);
      animateCounter('statChats',    chatTaps);

    } catch (err) {
      console.error('[Dashboard] Stats error:', err);
      ['statListings','statViews','statActive','statChats'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '–';
      });
    }
  }

  // Animate number counting up
  function animateCounter(id, target) {
    const el = document.getElementById(id);
    if (!el) return;

    if (target === 0) { el.textContent = '0'; return; }

    const duration = 800;
    const steps    = 30;
    const step     = target / steps;
    let   current  = 0;
    let   count    = 0;

    const timer = setInterval(() => {
      count++;
      current += step;
      el.textContent = Math.min(Math.round(current), target).toLocaleString();
      if (count >= steps) {
        clearInterval(timer);
        el.textContent = target.toLocaleString();
      }
    }, duration / steps);
  }

  // ── RECENT LISTINGS ───────────────────────────────────────
  async function loadRecentListings(uid) {
    const list       = document.getElementById('recentListingsList');
    const emptyState = document.getElementById('recentEmptyState');
    if (!list) return;

    try {
      const snap = await firebase.firestore()
        .collection('listings')
        .where('sellerId', '==', uid)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

      if (snap.empty) {
        if (emptyState) emptyState.style.display = '';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';

      snap.forEach(doc => {
        const d  = doc.data();
        const id = doc.id;
        list.insertBefore(buildListingRow(id, d), emptyState);
      });

    } catch (err) {
      console.error('[Dashboard] Recent listings error:', err);
      if (emptyState) {
        emptyState.style.display = '';
        const title = emptyState.querySelector('.dash-empty-title');
        if (title) title.textContent = 'Could not load listings';
      }
    }
  }

  function buildListingRow(id, d) {
    const row = document.createElement('a');
    row.href  = `/seller/add-listing.html?edit=${id}`;
    row.className = 'dash-listing-row';

    const imgSrc   = (d.images && d.images[0]) ? d.images[0] : null;
    const price    = typeof d.price === 'number' ? `₦${d.price.toLocaleString()}` : '–';
    const status   = d.status || 'draft';
    const catIcon  = categoryIcon(d.category);

    row.innerHTML = `
      <div class="dash-listing-thumb">
        ${imgSrc
          ? `<img src="${imgSrc}" alt="${escHtml(d.title)}" loading="lazy" />`
          : `<i class="${catIcon}"></i>`}
      </div>
      <div class="dash-listing-info">
        <div class="dash-listing-title">${escHtml(d.title || 'Untitled')}</div>
        <div class="dash-listing-meta">
          <span class="dash-listing-price">${price}</span>
          <span class="dash-listing-status ${status}">
            <i class="fas ${status === 'active' ? 'fa-circle-check' : 'fa-pen'}"></i>
            ${status === 'active' ? 'Active' : 'Draft'}
          </span>
        </div>
      </div>
      <i class="fas fa-angle-right" style="color:var(--text-light);font-size:14px;flex-shrink:0;"></i>
    `;
    return row;
  }

  // ── PROFILE COMPLETENESS ──────────────────────────────────
  function renderCompleteness(data) {
    const container = document.getElementById('completenessItems');
    const fillEl    = document.getElementById('completenessFill');
    const pctEl     = document.getElementById('completenessPct');
    if (!container) return;

    const checks = [
      { key: 'firstName',  label: 'Added your name',          done: !!(data.firstName) },
      { key: 'photoURL',   label: 'Uploaded profile photo',   done: !!(data.photoURL) },
      { key: 'bannerURL',  label: 'Added store banner',       done: !!(data.bannerURL) },
      { key: 'whatsapp',   label: 'Added WhatsApp number',    done: !!(data.whatsapp) },
      { key: 'bio',        label: 'Written a store bio',      done: !!(data.bio && data.bio.trim().length > 10) },
    ];

    const doneCount = checks.filter(c => c.done).length;
    const pct       = Math.round((doneCount / checks.length) * 100);

    container.innerHTML = '';
    checks.forEach(c => {
      const item = document.createElement('div');
      item.className = 'completeness-item';
      item.innerHTML = `
        <div class="completeness-item-check ${c.done ? 'done' : 'todo'}">
          <i class="fas ${c.done ? 'fa-check' : 'fa-minus'}"></i>
        </div>
        <span class="completeness-item-text ${c.done ? 'done' : ''}">${c.label}</span>
        ${!c.done ? `<a href="/seller/profile.html" style="margin-left:auto;font-size:11px;color:var(--orange);font-weight:600;">Fix →</a>` : ''}
      `;
      container.appendChild(item);
    });

    // Animate bar
    setTimeout(() => {
      if (fillEl) fillEl.style.width = pct + '%';
      if (pctEl)  pctEl.textContent  = pct + '%';
    }, 300);
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
    return map[cat] || 'fas fa-box';
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();

