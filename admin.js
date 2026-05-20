  'use strict';

  // ============================================================
  // FIREBASE CONFIG
  // ============================================================
  var FIREBASE_CONFIG = {
    apiKey:            "AIzaSyAvhaV4JR59o2lW7tniMu1GyrEte6ZjvQ8",
    authDomain:        "dmb-5b8e2.firebaseapp.com",
    projectId:         "dmb-5b8e2",
    storageBucket:     "dmb-5b8e2.firebasestorage.app",
    messagingSenderId: "225510920822",
    appId:             "1:225510920822:web:89cc6d0f27ec97d90ac557"
  };

  // ============================================================
  // STATE
  // ============================================================
  var state = {
    adminUser:           null,
    adminData:           null,
    allUsers:            [],
    allListings:         [],
    allSellers:          [],
    allAnnouncements:    [],
    allReports:          [],
    allCategories:       [],
    sellerListingCounts: {},
    savedCounts:         {},   // listingId → save count
    currentSection:      'overview',
    pendingDeleteFn:     null,
    selectedListings:    {},   // id → true for bulk select
    autoRefreshTimer:    null
  };

  // ============================================================
  // FIREBASE INIT
  // ============================================================
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  } catch(e) {
    hideLoader();
    showAuthScreen();
  }
  var db   = firebase.firestore();
  var auth = firebase.auth();

  // ============================================================
  // HELPERS
  // ============================================================
  function esc(str) {
    return String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function formatDate(ts) {
    if (!ts) return '—';
    var d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds*1000 : ts);
    return d.toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' });
  }

  function timeAgo(ts) {
    if (!ts) return '';
    var d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds*1000 : ts);
    var diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60)     return 'Just now';
    if (diff < 3600)   return Math.floor(diff/60)+'m ago';
    if (diff < 86400)  return Math.floor(diff/3600)+'h ago';
    if (diff < 604800) return Math.floor(diff/86400)+'d ago';
    return formatDate(ts);
  }

  function formatPrice(p) {
    if (p === null || p === undefined) return '—';
    return '₦' + Number(p).toLocaleString('en-NG');
  }

  function initial(name) {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  function animateCount(id, target) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!target) { el.textContent = '0'; return; }
    var steps = 25, count = 0, step = target / steps;
    var t = setInterval(function() {
      count++;
      el.textContent = Math.min(Math.round(step * count), target).toLocaleString();
      if (count >= steps) { clearInterval(t); el.textContent = target.toLocaleString(); }
    }, 600 / steps);
  }

  // Chunk array into groups of N (fix Firestore 500-doc batch limit)
  function chunkArray(arr, size) {
    var chunks = [];
    for (var i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  // ============================================================
  // TOAST
  // ============================================================
  function showToast(msg, type) {
    type = type || 'info';
    var icons = { success:'fa-circle-check', error:'fa-circle-xmark', info:'fa-circle-info' };
    var c = document.getElementById('toastContainer');
    var t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.innerHTML = '<i class="fas ' + (icons[type]||icons.info) + '"></i><span>' + esc(msg) + '</span>';
    c.appendChild(t);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ t.classList.add('show'); }); });
    setTimeout(function(){ t.classList.remove('show'); setTimeout(function(){ t.remove(); }, 350); }, 4000);
  }

  // ============================================================
  // MODAL HELPERS
  // ============================================================
  function openModal(id)  { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  function confirmDelete(msg, onConfirm) {
    document.getElementById('confirmModalMsg').textContent = msg;
    state.pendingDeleteFn = onConfirm;
    openModal('confirmModal');
  }

  // ============================================================
  // AUDIT LOG WRITER
  // ============================================================
  function writeLog(action, detail, colorClass) {
    if (!state.adminUser) return;
    db.collection('adminLogs').add({
      action:    action,
      detail:    detail || '',
      adminId:   state.adminUser.uid,
      adminName: document.getElementById('adminName').textContent || 'Admin',
      color:     colorClass || 'blue',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function(){});
  }

  // ============================================================
  // CLOCK
  // ============================================================
  function updateClock() {
    var el = document.getElementById('topbarTime');
    if (el) el.textContent = new Date().toLocaleTimeString('en-NG', { hour:'2-digit', minute:'2-digit' });
  }
  updateClock();
  setInterval(updateClock, 60000);

  // ============================================================
  // SIDEBAR NAVIGATION
  // ============================================================
  function navigateTo(section) {
    state.currentSection = section;
    document.querySelectorAll('.sidebar-link').forEach(function(l) {
      l.classList.toggle('active', l.dataset.section === section);
    });
    document.querySelectorAll('.panel-section').forEach(function(s) {
      s.classList.toggle('active', s.id === 'section-' + section);
    });
    var labels = {
      overview:'Dashboard', users:'Users', listings:'Listings',
      sellers:'Sellers', reports:'Reports', announcements:'Announcements',
      categories:'Categories', logs:'Audit Log', settings:'Settings'
    };
    var el = document.getElementById('topbarPage');
    if (el) el.textContent = labels[section] || section;
    closeSidebar();
    if (section === 'overview')      { renderOverviewRecentListings(); renderUserBreakdown(); renderMostSaved(); drawRegChart(); }
    if (section === 'users')         renderUsersTable();
    if (section === 'listings')      renderListingsTable();
    if (section === 'sellers')       renderSellersTable();
    if (section === 'reports')       renderReportsTable();
    if (section === 'announcements') renderAnnouncementsTable();
    if (section === 'categories')    renderCategories();
    if (section === 'logs')          renderLogs();
    if (section === 'settings')      renderSettings();
  }
  window.navigateTo = navigateTo;

  document.querySelectorAll('.sidebar-link[data-section]').forEach(function(btn) {
    btn.addEventListener('click', function() { navigateTo(btn.dataset.section); });
  });

  function openSidebar()  { document.getElementById('sidebar').classList.add('open'); document.getElementById('sidebarOverlay').classList.add('show'); }
  function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('show'); }
  document.getElementById('topbarHamburger').addEventListener('click', openSidebar);
  document.getElementById('sidebarCloseBtn').addEventListener('click', closeSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

  // ============================================================
  // AUTH
  // ============================================================
  auth.onAuthStateChanged(function(user) {
    if (!user) {
      // FIX #10: reset sign-in button when screen re-shows
      var btn = document.getElementById('authSignInBtn');
      btn.innerHTML = '<i class="fas fa-arrow-right-to-bracket"></i> Sign In';
      btn.disabled = false;
      hideLoader();
      showAuthScreen();
      return;
    }
    db.collection('users').doc(user.uid).get().then(function(snap) {
      if (!snap.exists || snap.data().role !== 'admin') {
        auth.signOut();
        showToast('Access denied. Admin only.', 'error');
        hideLoader();
        showAuthScreen();
        return;
      }
      state.adminUser = user;
      state.adminData = snap.data();
      hideLoader();
      hideAuthScreen();
      bootAdmin();
    }).catch(function(err) {
      console.error(err);
      hideLoader();
      showAuthScreen();
    });
  });

  // FIX #16: Enter key on BOTH email and password fields
  function trySignIn() {
    var email = document.getElementById('authEmail').value.trim();
    var pass  = document.getElementById('authPassword').value;
    var errEl = document.getElementById('authError');
    errEl.classList.remove('show');
    if (!email || !pass) {
      errEl.textContent = 'Please enter email and password.';
      errEl.classList.add('show');
      return;
    }
    var btn = document.getElementById('authSignInBtn');
    btn.innerHTML = '<span class="spinner"></span> Signing in…';
    btn.disabled = true;
    auth.signInWithEmailAndPassword(email, pass).catch(function(err) {
      btn.innerHTML = '<i class="fas fa-arrow-right-to-bracket"></i> Sign In';
      btn.disabled = false;
      var msgs = {
        'auth/user-not-found':    'No account found with this email.',
        'auth/wrong-password':    'Incorrect password.',
        'auth/invalid-email':     'Invalid email address.',
        'auth/too-many-requests': 'Too many attempts. Try again later.',
        'auth/invalid-credential':'Invalid email or password.'
      };
      errEl.textContent = msgs[err.code] || 'Sign-in failed. Please try again.';
      errEl.classList.add('show');
    });
  }
  document.getElementById('authSignInBtn').addEventListener('click', trySignIn);
  document.getElementById('authEmail').addEventListener('keydown',    function(e){ if (e.key==='Enter') trySignIn(); });
  document.getElementById('authPassword').addEventListener('keydown', function(e){ if (e.key==='Enter') trySignIn(); });

  // Logout — with confirmation
  document.getElementById('logoutBtn').addEventListener('click', function() {
    if (!confirm('Sign out of the admin panel?')) return;
    auth.signOut().then(function() { location.reload(); });
  });

  function showAuthScreen() {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('appShell').classList.remove('visible');
  }
  function hideAuthScreen() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appShell').classList.add('visible');
  }
  function hideLoader() {
    var l = document.getElementById('pageLoader');
    if (!l) return;
    l.classList.add('hidden');
    setTimeout(function(){ if (l.parentNode) l.remove(); }, 450);
  }

  // ============================================================
  // BOOT ADMIN
  // ============================================================
  function bootAdmin() {
    var data = state.adminData, user = state.adminUser;
    var name = ((data.firstName||'') + ' ' + (data.lastName||'')).trim() || user.email;
    document.getElementById('adminName').textContent = name;
    var avatarEl = document.getElementById('adminAvatar');
    if (data.photoURL) {
      avatarEl.innerHTML = '<img src="' + esc(data.photoURL) + '" alt="avatar" />';
    } else {
      avatarEl.textContent = initial(name);
    }
    var sn = document.getElementById('settingsAdminName');
    if (sn) sn.value = name;

    // FIX #4: Promise.all to avoid race condition
    loadAllData();

    // Auto-refresh every 5 minutes
    state.autoRefreshTimer = setInterval(function() {
      loadAllData(true); // silent=true
    }, 5 * 60 * 1000);
  }

  // ============================================================
  // LOAD ALL DATA (Promise.all — fixes race condition)
  // ============================================================
  function loadAllData(silent) {
    // FIX #3: reset sellerListingCounts before reload
    state.sellerListingCounts = {};
    state.savedCounts = {};

    var usersPromise = db.collection('users').orderBy('createdAt', 'desc').get();
    var listingsPromise = db.collection('listings').orderBy('createdAt', 'desc').get();

    Promise.all([usersPromise, listingsPromise]).then(function(results) {
      var usersSnap    = results[0];
      var listingsSnap = results[1];

      // Process users
      state.allUsers = [];
      usersSnap.forEach(function(d) {
        state.allUsers.push(Object.assign({ id: d.id }, d.data()));
      });
      var sellers   = state.allUsers.filter(function(u){ return u.role === 'seller'; });
      var customers = state.allUsers.filter(function(u){ return u.role === 'customer'; });
      state.allSellers = sellers;

      if (!silent) {
        animateCount('statTotalUsers',   state.allUsers.length);
        animateCount('statTotalSellers', sellers.length);
      } else {
        var el;
        el = document.getElementById('statTotalUsers');   if(el) el.textContent = state.allUsers.length;
        el = document.getElementById('statTotalSellers'); if(el) el.textContent = sellers.length;
      }
      document.getElementById('badgeUsers').textContent   = state.allUsers.length;
      document.getElementById('badgeSellers').textContent = sellers.length;

      // Process listings + compute savedCounts from users' savedItems
      state.allListings = [];
      var totalViews = 0;
      listingsSnap.forEach(function(d) {
        var l = Object.assign({ id: d.id }, d.data());
        state.allListings.push(l);
        totalViews += (l.views || 0);
        if (l.sellerId) {
          state.sellerListingCounts[l.sellerId] = (state.sellerListingCounts[l.sellerId] || 0) + 1;
        }
      });

      // Build savedCounts from users' savedItems arrays
      state.allUsers.forEach(function(u) {
        var saved = u.savedItems || [];
        if (Array.isArray(saved)) {
          saved.forEach(function(lid) {
            state.savedCounts[lid] = (state.savedCounts[lid] || 0) + 1;
          });
        }
      });

      if (!silent) {
        animateCount('statTotalListings', state.allListings.length);
        animateCount('statTotalViews',    totalViews);
      } else {
        var el2;
        el2 = document.getElementById('statTotalListings'); if(el2) el2.textContent = state.allListings.length;
        el2 = document.getElementById('statTotalViews');    if(el2) el2.textContent = totalViews;
      }
      document.getElementById('badgeListings').textContent = state.allListings.length;

      // FIX #12: re-render overview if visible
      if (state.currentSection === 'overview') {
        renderOverviewRecentListings();
        renderUserBreakdown(sellers.length, customers.length);
        renderMostSaved();
        drawRegChart();
      }
      if (state.currentSection === 'listings') renderListingsTable();
      if (state.currentSection === 'sellers')  renderSellersTable();

    }).catch(function(err){ console.error('[Admin] loadAllData error:', err); });

    // Announcements
    db.collection('announcements').orderBy('createdAt', 'desc').get().then(function(snap) {
      state.allAnnouncements = [];
      snap.forEach(function(d) { state.allAnnouncements.push(Object.assign({ id: d.id }, d.data())); });
      if (state.currentSection === 'announcements') renderAnnouncementsTable();
    }).catch(function(){});

    // Reports
    db.collection('reports').orderBy('createdAt', 'desc').get().then(function(snap) {
      state.allReports = [];
      snap.forEach(function(d) { state.allReports.push(Object.assign({ id: d.id }, d.data())); });
      var pending = state.allReports.filter(function(r){ return r.status === 'pending'; });
      var badge = document.getElementById('badgeReports');
      if (badge) {
        badge.textContent = pending.length;
        badge.style.display = pending.length > 0 ? '' : 'none';
      }
      document.getElementById('reportsCount').textContent = state.allReports.length + ' report' + (state.allReports.length !== 1 ? 's' : '');
      if (state.currentSection === 'reports') renderReportsTable();
    }).catch(function(){});

    // Categories (from Firestore, fallback to defaults)
    db.collection('categories').orderBy('order', 'asc').get().then(function(snap) {
      if (snap.empty) {
        state.allCategories = getDefaultCategories();
      } else {
        state.allCategories = [];
        snap.forEach(function(d) { state.allCategories.push(Object.assign({ id: d.id }, d.data())); });
      }
      if (state.currentSection === 'categories') renderCategories();
    }).catch(function(){
      state.allCategories = getDefaultCategories();
    });
  }

  function getDefaultCategories() {
    return [
      { id:'electronics', name:'Electronics', icon:'fa-laptop',          order:1 },
      { id:'fashion',     name:'Fashion',     icon:'fa-shirt',           order:2 },
      { id:'food',        name:'Food',        icon:'fa-utensils',        order:3 },
      { id:'books',       name:'Books',       icon:'fa-book-open',       order:4 },
      { id:'hostel',      name:'Hostel',      icon:'fa-building',        order:5 },
      { id:'services',    name:'Services',    icon:'fa-wrench',          order:6 },
      { id:'tutoring',    name:'Tutoring',    icon:'fa-chalkboard-user', order:7 },
      { id:'housing',     name:'Housing',     icon:'fa-house-chimney',   order:8 }
    ];
  }

  // ============================================================
  // DASHBOARD REFRESH BUTTON
  // ============================================================
  document.getElementById('refreshDashboardBtn').addEventListener('click', function() {
    var btn = document.getElementById('refreshDashboardBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="border-top-color:var(--forest);border-color:var(--milk-border);width:14px;height:14px;"></span> Refreshing…';
    loadAllData();
    setTimeout(function() {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-rotate-right"></i> Refresh';
      showToast('Dashboard refreshed.', 'success');
    }, 1800);
  });

  // ============================================================
  // OVERVIEW — Recent Listings
  // ============================================================
  function renderOverviewRecentListings() {
    var container = document.getElementById('overviewRecentListings');
    if (!container) return;
    var recent = state.allListings.slice(0, 8);
    if (!recent.length) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>No listings yet.</p></div>';
      return;
    }
    var html = '';
    recent.forEach(function(l) {
      var dot = l.status === 'active' ? 'green' : 'orange';
      html += '<div class="activity-item">' +
        '<div class="activity-dot ' + dot + '"></div>' +
        '<div class="activity-text"><strong>' + esc(l.title||'Untitled') + '</strong> — ' + esc(l.sellerName||'Unknown seller') + ' · ' + esc(formatPrice(l.price)) + '</div>' +
        '<div class="activity-time">' + timeAgo(l.createdAt) + '</div>' +
        '</div>';
    });
    container.innerHTML = html;
  }

  function renderUserBreakdown(sellers, customers) {
    if (sellers === undefined) {
      sellers   = state.allSellers.length;
      customers = state.allUsers.filter(function(u){ return u.role === 'customer'; }).length;
    }
    var container = document.getElementById('overviewUserBreakdown');
    if (!container) return;
    var total = sellers + customers;
    var sellerPct   = total ? Math.round(sellers/total*100)   : 0;
    var customerPct = total ? Math.round(customers/total*100) : 0;
    container.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:12px;">' +
        '<div>' +
          '<div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:0.8125rem;">' +
            '<span style="font-weight:600;color:var(--text-secondary);">Sellers</span>' +
            '<span style="font-weight:700;color:var(--forest);">' + sellers + ' (' + sellerPct + '%)</span>' +
          '</div>' +
          '<div class="progress-wrap"><div class="progress-fill green" style="width:' + sellerPct + '%;"></div></div>' +
        '</div>' +
        '<div>' +
          '<div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:0.8125rem;">' +
            '<span style="font-weight:600;color:var(--text-secondary);">Customers</span>' +
            '<span style="font-weight:700;color:var(--orange);">' + customers + ' (' + customerPct + '%)</span>' +
          '</div>' +
          '<div class="progress-wrap"><div class="progress-fill orange" style="width:' + customerPct + '%;"></div></div>' +
        '</div>' +
      '</div>';
  }

  // Most Saved Listings widget
  function renderMostSaved() {
    var container = document.getElementById('overviewMostSaved');
    if (!container) return;
    var sorted = state.allListings.slice().sort(function(a, b) {
      return (state.savedCounts[b.id] || 0) - (state.savedCounts[a.id] || 0);
    }).slice(0, 5);
    var hasSaves = sorted.some(function(l){ return (state.savedCounts[l.id]||0) > 0; });
    if (!hasSaves) {
      container.innerHTML = '<div style="font-size:0.875rem;color:var(--text-muted);text-align:center;padding:12px 0;">No saved data yet.</div>';
      return;
    }
    var max = state.savedCounts[sorted[0].id] || 1;
    var html = '<div style="display:flex;flex-direction:column;gap:10px;">';
    sorted.forEach(function(l) {
      var count = state.savedCounts[l.id] || 0;
      var pct   = Math.round(count / max * 100);
      html +=
        '<div>' +
          '<div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:0.8125rem;">' +
            '<span style="font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;">' + esc(l.title||'Untitled') + '</span>' +
            '<span style="font-weight:700;color:var(--red);flex-shrink:0;margin-left:8px;"><i class="fas fa-heart" style="font-size:10px;"></i> ' + count + '</span>' +
          '</div>' +
          '<div class="progress-wrap"><div class="progress-fill red" style="width:' + pct + '%;"></div></div>' +
        '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
  }

  // ============================================================
  // REGISTRATION CHART (pure canvas — no library)
  // ============================================================
  var regChartData = null;
  document.getElementById('chartRangeSelect').addEventListener('change', drawRegChart);

  function drawRegChart() {
    var days   = parseInt(document.getElementById('chartRangeSelect').value, 10) || 30;
    var canvas = document.getElementById('regChart');
    if (!canvas) return;
    canvas.width  = canvas.offsetWidth || 600;
    canvas.height = 160;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Build buckets
    var now    = Date.now();
    var buckets = {};
    for (var d = 0; d < days; d++) {
      var dt = new Date(now - d * 86400000);
      var key = dt.toISOString().slice(0, 10);
      buckets[key] = 0;
    }
    state.allUsers.forEach(function(u) {
      if (!u.createdAt) return;
      var ts = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt.seconds ? u.createdAt.seconds*1000 : u.createdAt);
      var key = ts.toISOString().slice(0, 10);
      if (buckets[key] !== undefined) buckets[key]++;
    });

    var labels = Object.keys(buckets).sort();
    var values = labels.map(function(k){ return buckets[k]; });
    var maxVal = Math.max.apply(null, values) || 1;

    var W = canvas.width, H = canvas.height;
    var padL = 32, padR = 10, padT = 10, padB = 30;
    var chartW = W - padL - padR;
    var chartH = H - padT - padB;
    var barW   = Math.max(2, chartW / labels.length - 3);

    // Grid lines
    ctx.strokeStyle = '#E4DCCF';
    ctx.lineWidth   = 1;
    for (var gi = 0; gi <= 4; gi++) {
      var gy = padT + chartH - (gi / 4) * chartH;
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(W - padR, gy); ctx.stroke();
      ctx.fillStyle = '#A89070';
      ctx.font = '10px DM Sans, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(gi/4 * maxVal), padL - 4, gy + 3);
    }

    // Bars
    labels.forEach(function(label, i) {
      var val   = values[i];
      var barH  = val > 0 ? Math.max(2, (val / maxVal) * chartH) : 0;
      var x     = padL + i * (chartW / labels.length) + (chartW / labels.length - barW) / 2;
      var y     = padT + chartH - barH;

      // Gradient
      var grad = ctx.createLinearGradient(0, y, 0, padT + chartH);
      grad.addColorStop(0, '#4E8426');
      grad.addColorStop(1, '#C8DFB0');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]) : ctx.rect(x, y, barW, barH);
      ctx.fill();
    });

    // X axis labels (show every Nth)
    var step = Math.ceil(labels.length / 6);
    ctx.fillStyle = '#A89070';
    ctx.font = '9px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    labels.forEach(function(label, i) {
      if (i % step !== 0) return;
      var x = padL + i * (chartW / labels.length) + (chartW / labels.length) / 2;
      var short = label.slice(5); // MM-DD
      ctx.fillText(short, x, H - 6);
    });
  }

  // ============================================================
  // USERS TABLE
  // ============================================================
  var usersSearchQuery = '';
  var usersRoleFilter  = '';

  function renderUsersTable() {
    var filtered = state.allUsers.filter(function(u) {
      var matchSearch = !usersSearchQuery ||
        ((u.firstName||'') + ' ' + (u.lastName||'')).toLowerCase().includes(usersSearchQuery) ||
        (u.email||'').toLowerCase().includes(usersSearchQuery);
      var matchRole = !usersRoleFilter || u.role === usersRoleFilter;
      return matchSearch && matchRole;
    });
    document.getElementById('usersCount').textContent = filtered.length + ' user' + (filtered.length !== 1 ? 's' : '');
    var tbody = document.getElementById('usersTableBody');
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:2rem;">No users found.</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map(function(u) {
      var name = ((u.firstName||'') + ' ' + (u.lastName||'')).trim() || u.email || 'Unknown';
      var roleBadge   = u.role === 'admin' ? 'badge-red' : u.role === 'seller' ? 'badge-green' : 'badge-blue';
      // FIX #1: status badge — active=green, suspended=red (was inverted)
      var statusBadge = u.status === 'suspended' ? 'badge-red' : 'badge-green';
      // FIX #1: toggle icon — active shows toggle-on, suspended shows toggle-off
      var toggleIcon  = u.status === 'suspended' ? 'fa-toggle-off' : 'fa-toggle-on';
      return '<tr>' +
        '<td><div class="table-user-cell">' +
          '<div class="table-avatar">' + (u.photoURL ? '<img src="'+esc(u.photoURL)+'" alt="" />' : initial(name)) + '</div>' +
          '<div><div class="table-user-name">' + esc(name) + '</div><div class="table-user-email">' + esc(u.email||'—') + '</div></div>' +
        '</div></td>' +
        '<td><span class="badge ' + roleBadge + '">' + esc(u.role||'customer') + '</span></td>' +
        '<td><span class="badge ' + statusBadge + '">' + esc(u.status||'active') + '</span></td>' +
        '<td style="white-space:nowrap;">' + formatDate(u.createdAt) + '</td>' +
        '<td><div style="display:flex;gap:5px;flex-wrap:wrap;">' +
          '<button class="btn btn-ghost btn-sm btn-icon" onclick="openUserEdit(\'' + u.id + '\')" title="Edit"><i class="fas fa-pen"></i></button>' +
          (u.id !== state.adminUser.uid
            ? '<button class="btn btn-ghost btn-sm btn-icon" onclick="toggleUserStatus(\'' + u.id + '\',\'' + (u.status||'active') + '\')" title="Toggle status"><i class="fas ' + toggleIcon + '"></i></button>'
            : '') +
          '<button class="btn btn-ghost btn-sm btn-icon" onclick="sendPasswordReset(\'' + esc(u.email||'') + '\')" title="Send password reset"><i class="fas fa-key"></i></button>' +
        '</div></td>' +
      '</tr>';
    }).join('');
  }

  document.getElementById('usersSearch').addEventListener('input', function() {
    usersSearchQuery = this.value.trim().toLowerCase(); renderUsersTable();
  });
  document.getElementById('usersRoleFilter').addEventListener('change', function() {
    usersRoleFilter = this.value; renderUsersTable();
  });

  // Password reset
  function sendPasswordReset(email) {
    if (!email) { showToast('No email for this user.', 'error'); return; }
    if (!confirm('Send password reset email to ' + email + '?')) return;
    auth.sendPasswordResetEmail(email).then(function() {
      showToast('Password reset email sent to ' + email + '.', 'success');
      writeLog('Password reset sent', 'To: ' + email, 'blue');
    }).catch(function(e) {
      showToast('Failed: ' + e.message, 'error');
    });
  }
  window.sendPasswordReset = sendPasswordReset;

  function openUserEdit(uid) {
    var u = state.allUsers.find(function(x){ return x.id === uid; });
    if (!u) return;
    document.getElementById('editUserId').value     = uid;
    document.getElementById('editUserFirst').value  = u.firstName || '';
    document.getElementById('editUserLast').value   = u.lastName  || '';
    document.getElementById('editUserRole').value   = u.role      || 'customer';
    document.getElementById('editUserStatus').value = u.status    || 'active';
    openModal('userModal');
  }
  window.openUserEdit = openUserEdit;

  // FIX #3 & #5: toggleUserStatus re-renders both tables, updates all stat cards and badges
  function toggleUserStatus(uid, currentStatus) {
    var newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    db.collection('users').doc(uid).update({
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
      var u = state.allUsers.find(function(x){ return x.id === uid; });
      if (u) u.status = newStatus;
      renderUsersTable();
      renderSellersTable(); // FIX: also re-render sellers table
      showToast('User ' + (newStatus === 'suspended' ? 'suspended' : 'reactivated') + '.', 'success');
      writeLog('User status changed', (u ? (u.firstName||u.email||uid) : uid) + ' → ' + newStatus, newStatus === 'suspended' ? 'red' : 'green');
    }).catch(function(){ showToast('Failed to update user.', 'error'); });
  }
  window.toggleUserStatus = toggleUserStatus;

  // User modal save — FIX #9: update all affected stat counts
  document.getElementById('userModalSave').addEventListener('click', function() {
    var uid    = document.getElementById('editUserId').value;
    var first  = document.getElementById('editUserFirst').value.trim();
    var last   = document.getElementById('editUserLast').value.trim();
    var role   = document.getElementById('editUserRole').value;
    var status = document.getElementById('editUserStatus').value;

    db.collection('users').doc(uid).update({
      firstName: first, lastName: last,
      fullName:  (first + ' ' + last).trim(),
      role: role, status: status,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
      var u = state.allUsers.find(function(x){ return x.id === uid; });
      if (u) { u.firstName=first; u.lastName=last; u.fullName=(first+' '+last).trim(); u.role=role; u.status=status; }

      // FIX #9: recompute sellers list + update all badges/stats
      state.allSellers = state.allUsers.filter(function(x){ return x.role === 'seller'; });
      var customers    = state.allUsers.filter(function(x){ return x.role === 'customer'; });
      document.getElementById('badgeSellers').textContent = state.allSellers.length;
      document.getElementById('statTotalSellers').textContent = state.allSellers.length;

      renderUsersTable();
      renderSellersTable();
      closeModal('userModal');
      showToast('User updated.', 'success');
      writeLog('User edited', (first+' '+last).trim() || uid, 'blue');
    }).catch(function(){ showToast('Failed to save user.', 'error'); });
  });

  ['userModalClose','userModalCancel'].forEach(function(id) {
    document.getElementById(id).addEventListener('click', function(){ closeModal('userModal'); });
  });

  // Export users CSV
  document.getElementById('exportUsersBtn').addEventListener('click', function() {
    exportCSV(
      ['Name','Email','Role','Status','Joined'],
      state.allUsers.map(function(u){
        return [
          ((u.firstName||'')+' '+(u.lastName||'')).trim() || u.email,
          u.email||'',
          u.role||'customer',
          u.status||'active',
          formatDate(u.createdAt)
        ];
      }),
      'ludek-users.csv'
    );
  });

  // ============================================================
  // LISTINGS TABLE
  // ============================================================
  var listingsSearchQuery    = '';
  var listingsStatusFilter   = '';
  var listingsCategoryFilter = '';

  function renderListingsTable() {
    var filtered = state.allListings.filter(function(l) {
      var matchSearch   = !listingsSearchQuery || (l.title||'').toLowerCase().includes(listingsSearchQuery) || (l.sellerName||'').toLowerCase().includes(listingsSearchQuery);
      var matchStatus   = !listingsStatusFilter   || l.status   === listingsStatusFilter;
      var matchCategory = !listingsCategoryFilter || l.category === listingsCategoryFilter;
      return matchSearch && matchStatus && matchCategory;
    });
    document.getElementById('listingsCount').textContent = filtered.length + ' listing' + (filtered.length !== 1 ? 's' : '');
    var tbody = document.getElementById('listingsTableBody');
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="13" class="text-center text-muted" style="padding:2rem;">No listings found.</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map(function(l) {
      var imgSrc      = l.coverImage || (l.images && l.images[0]) || '';
      var statusBadge = l.status === 'active' ? 'badge-green' : 'badge-amber';
      // FIX #2: toggle icon — active=on, draft=off (was already correct, keeping)
      var toggleIcon  = l.status === 'active' ? 'fa-toggle-on' : 'fa-toggle-off';
      var condBadge   = l.condition === 'new' ? 'badge-green' : l.condition === 'used' ? 'badge-amber' : 'badge-gray';
      var isSelected  = !!state.selectedListings[l.id];
      var featuredIcon = l.featured ? 'fa-star' : 'fa-star';
      var featuredColor = l.featured ? 'color:var(--amber);' : 'color:var(--milk-border);';
      return '<tr>' +
        '<td><input type="checkbox" class="listing-checkbox" data-id="' + l.id + '"' + (isSelected ? ' checked' : '') + ' /></td>' +
        '<td><div style="display:flex;align-items:center;gap:10px;">' +
          (imgSrc
            ? '<img class="table-img-thumb" src="'+esc(imgSrc)+'" alt="" loading="lazy" />'
            : '<div class="table-img-thumb" style="display:flex;align-items:center;justify-content:center;"><i class="fas fa-image" style="color:var(--text-light);font-size:14px;"></i></div>') +
          '<div style="min-width:0;"><div style="font-weight:600;font-size:0.875rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">' + esc(l.title||'Untitled') + '</div></div>' +
        '</div></td>' +
        '<td style="font-size:0.8125rem;">' + esc(l.sellerName||'—') + '</td>' +
        '<td><span class="badge badge-gray">' + esc(l.category||'—') + '</span></td>' +
        '<td style="font-weight:600;color:var(--forest);white-space:nowrap;">' + formatPrice(l.price) + '</td>' +
        '<td>' + (l.condition ? '<span class="badge ' + condBadge + '">' + esc(l.condition) + '</span>' : '<span style="color:var(--text-light);">—</span>') + '</td>' +
        '<td style="text-align:center;font-weight:600;">' + (l.views||0) + '</td>' +
        '<td style="text-align:center;font-weight:600;">' + (l.chatTaps||0) + '</td>' +
        '<td><span class="badge ' + statusBadge + '">' + esc(l.status||'draft') + '</span></td>' +
        '<td style="text-align:center;">' +
          '<button class="btn btn-ghost btn-sm btn-icon" onclick="toggleFeatured(\'' + l.id + '\',' + (l.featured?'true':'false') + ')" title="' + (l.featured?'Unfeature':'Feature') + '">' +
            '<i class="fas ' + featuredIcon + '" style="' + featuredColor + '"></i>' +
          '</button>' +
        '</td>' +
        '<td>' +
          '<input type="number" min="1" value="' + (l.position||999) + '" style="width:58px;padding:4px 7px;border:1.5px solid var(--border);border-radius:6px;font-size:0.8125rem;font-family:var(--font-body);" ' +
          'onchange="setListingPosition(\'' + l.id + '\',this.value)" onkeydown="if(event.key===\'Enter\') this.blur()" title="Position" />' +
        '</td>' +
        '<td style="white-space:nowrap;font-size:0.8125rem;">' + timeAgo(l.createdAt) + '</td>' +
        '<td><div style="display:flex;gap:5px;">' +
          '<button class="btn btn-ghost btn-sm btn-icon" onclick="toggleListingStatus(\'' + l.id + '\',\'' + (l.status||'draft') + '\')" title="Toggle status"><i class="fas ' + toggleIcon + '"></i></button>' +
          '<button class="btn btn-ghost btn-sm btn-icon" onclick="adminDeleteListing(\'' + l.id + '\')" title="Delete" style="color:var(--red);"><i class="fas fa-trash"></i></button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    // Wire checkboxes
    document.querySelectorAll('.listing-checkbox').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var id = cb.dataset.id;
        if (cb.checked) state.selectedListings[id] = true;
        else delete state.selectedListings[id];
        updateBulkBar();
      });
    });
    document.getElementById('selectAllListings').addEventListener('change', function() {
      var all = this.checked;
      document.querySelectorAll('.listing-checkbox').forEach(function(cb) {
        cb.checked = all;
        var id = cb.dataset.id;
        if (all) state.selectedListings[id] = true;
        else delete state.selectedListings[id];
      });
      updateBulkBar();
    });
  }

  document.getElementById('listingsSearch').addEventListener('input', function() {
    listingsSearchQuery = this.value.trim().toLowerCase(); renderListingsTable();
  });
  document.getElementById('listingsStatusFilter').addEventListener('change', function() {
    listingsStatusFilter = this.value; renderListingsTable();
  });
  document.getElementById('listingsCategoryFilter').addEventListener('change', function() {
    listingsCategoryFilter = this.value; renderListingsTable();
  });

  // Bulk selection
  function updateBulkBar() {
    var count = Object.keys(state.selectedListings).length;
    var bar   = document.getElementById('listingsBulkBar');
    var label = document.getElementById('bulkSelectedCount');
    bar.classList.toggle('show', count > 0);
    if (label) label.textContent = count + ' selected';
  }

  function clearBulkSelection() {
    state.selectedListings = {};
    document.querySelectorAll('.listing-checkbox').forEach(function(cb){ cb.checked = false; });
    var sAll = document.getElementById('selectAllListings'); if(sAll) sAll.checked = false;
    updateBulkBar();
  }
  window.clearBulkSelection = clearBulkSelection;

  // FIX #7: batch chunked to 500 items max
  function bulkListingAction(action) {
    var ids = Object.keys(state.selectedListings);
    if (!ids.length) return;
    var msg = action === 'delete'
      ? 'Delete ' + ids.length + ' selected listing(s)? This cannot be undone.'
      : (action === 'activate' ? 'Activate ' : 'Set to draft ') + ids.length + ' selected listing(s)?';

    confirmDelete(msg, function() {
      var chunks = chunkArray(ids, 500);
      var promises = chunks.map(function(chunk) {
        var batch = db.batch();
        chunk.forEach(function(id) {
          var ref = db.collection('listings').doc(id);
          if (action === 'delete') {
            batch.delete(ref);
          } else {
            batch.update(ref, { status: action === 'activate' ? 'active' : 'draft', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
          }
        });
        return batch.commit();
      });
      Promise.all(promises).then(function() {
        if (action === 'delete') {
          state.allListings = state.allListings.filter(function(l){ return !state.selectedListings[l.id]; });
          updateListingStats();
        } else {
          ids.forEach(function(id) {
            var l = state.allListings.find(function(x){ return x.id === id; });
            if (l) l.status = action === 'activate' ? 'active' : 'draft';
          });
        }
        clearBulkSelection();
        renderListingsTable();
        showToast('Done: ' + ids.length + ' listing(s) updated.', 'success');
        writeLog('Bulk listing action', action + ' × ' + ids.length, action === 'delete' ? 'red' : 'orange');
      }).catch(function(){ showToast('Bulk action failed.', 'error'); });
    });
  }
  window.bulkListingAction = bulkListingAction;

  function toggleListingStatus(id, current) {
    var newStatus = current === 'active' ? 'draft' : 'active';
    db.collection('listings').doc(id).update({
      status: newStatus, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
      var l = state.allListings.find(function(x){ return x.id === id; });
      if (l) l.status = newStatus;
      renderListingsTable();
      showToast('Listing ' + (newStatus === 'active' ? 'activated' : 'set to draft') + '.', 'success');
      writeLog('Listing status changed', (l?l.title:id) + ' → ' + newStatus, newStatus === 'active' ? 'green' : 'amber');
    }).catch(function(){ showToast('Failed to update listing.', 'error'); });
  }
  window.toggleListingStatus = toggleListingStatus;

  // FIX #5 & #6: helper to update all listing stat elements
  function updateListingStats() {
    var count = state.allListings.length;
    document.getElementById('badgeListings').textContent = count;
    document.getElementById('statTotalListings').textContent = count.toLocaleString();
    var totalViews = state.allListings.reduce(function(sum, l){ return sum + (l.views||0); }, 0);
    document.getElementById('statTotalViews').textContent = totalViews.toLocaleString();
  }

  function adminDeleteListing(id) {
    var l = state.allListings.find(function(x){ return x.id===id; });
    var title = l ? l.title : 'this listing';
    confirmDelete('Delete "' + title + '"? This cannot be undone.', function() {
      db.collection('listings').doc(id).delete().then(function() {
        state.allListings = state.allListings.filter(function(x){ return x.id !== id; });
        updateListingStats(); // FIX #6: updates stat card
        renderListingsTable();
        showToast('Listing deleted.', 'success');
        writeLog('Listing deleted', title, 'red');
      }).catch(function(){ showToast('Failed to delete listing.', 'error'); });
    });
  }
  window.adminDeleteListing = adminDeleteListing;

  function toggleFeatured(id, currentFeatured) {
    var newFeatured = !currentFeatured;
    db.collection('listings').doc(id).update({ featured: newFeatured }).then(function() {
      var l = state.allListings.find(function(x){ return x.id === id; });
      if (l) l.featured = newFeatured;
      renderListingsTable();
      showToast('Listing ' + (newFeatured ? 'featured!' : 'unfeatured.'), 'success');
      writeLog('Listing ' + (newFeatured?'featured':'unfeatured'), l?l.title:id, 'amber');
    }).catch(function(){ showToast('Failed to update.', 'error'); });
  }
  window.toggleFeatured = toggleFeatured;

  function setListingPosition(id, val) {
    var pos = parseInt(val, 10);
    if (isNaN(pos) || pos < 1) return;
    db.collection('listings').doc(id).update({ position: pos }).then(function() {
      var l = state.allListings.find(function(x){ return x.id === id; });
      if (l) l.position = pos;
      showToast('Position updated to ' + pos + '.', 'success');
    }).catch(function(){ showToast('Failed to update position.', 'error'); });
  }
  window.setListingPosition = setListingPosition;

  // Export listings CSV
  document.getElementById('exportListingsBtn').addEventListener('click', function() {
    exportCSV(
      ['Title','Seller','Category','Price','Condition','Status','Views','Chats','Posted'],
      state.allListings.map(function(l){
        return [
          l.title||'', l.sellerName||'', l.category||'',
          l.price||0, l.condition||'', l.status||'',
          l.views||0, l.chatTaps||0, formatDate(l.createdAt)
        ];
      }),
      'ludek-listings.csv'
    );
  });

  // ============================================================
  // SELLERS TABLE
  // ============================================================
  var sellersSearchQuery = '';

  function calcCompleteness(s) {
    var checks = [!!s.firstName, !!s.photoURL, !!s.bannerURL, !!s.whatsapp, !!(s.bio && s.bio.trim().length > 10)];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
  }

  function renderSellersTable() {
    var filtered = state.allSellers.filter(function(s) {
      return !sellersSearchQuery ||
        ((s.firstName||'')+' '+(s.lastName||'')).toLowerCase().includes(sellersSearchQuery) ||
        (s.storeName||'').toLowerCase().includes(sellersSearchQuery) ||
        (s.email||'').toLowerCase().includes(sellersSearchQuery);
    });
    document.getElementById('sellersCount').textContent = filtered.length + ' seller' + (filtered.length !== 1 ? 's' : '');
    var tbody = document.getElementById('sellersTableBody');
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:2rem;">No sellers found.</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map(function(s) {
      var name        = ((s.firstName||'')+' '+(s.lastName||'')).trim() || s.email || 'Unknown';
      var count       = state.sellerListingCounts[s.id] || 0;
      var pct         = calcCompleteness(s);
      var pctColor    = pct >= 80 ? 'green' : pct >= 40 ? 'orange' : 'red';
      // FIX #1 (sellers): toggle icon — active=on, suspended=off
      var statusBadge = s.status === 'suspended' ? 'badge-red' : 'badge-green';
      var toggleIcon  = s.status === 'suspended' ? 'fa-toggle-off' : 'fa-toggle-on';
      var verifiedIcon = s.verified ? 'fa-circle-check' : 'fa-circle';
      var verifiedColor = s.verified ? 'color:var(--blue);' : 'color:var(--milk-border);';
      return '<tr>' +
        '<td><div class="table-user-cell">' +
          '<div class="table-avatar">' + (s.photoURL ? '<img src="'+esc(s.photoURL)+'" alt="" />' : initial(name)) + '</div>' +
          '<div><div class="table-user-name">' + esc(name) + '</div><div class="table-user-email">' + esc(s.email||'—') + '</div></div>' +
        '</div></td>' +
        '<td style="font-weight:500;">' + esc(s.storeName||'—') + '</td>' +
        '<td style="font-size:0.8125rem;">' + esc(s.whatsapp||'—') + '</td>' +
        '<td style="font-weight:700;color:var(--forest);">' + count + '</td>' +
        '<td style="min-width:100px;">' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<div class="progress-wrap" style="flex:1;"><div class="progress-fill ' + pctColor + '" style="width:' + pct + '%;"></div></div>' +
            '<span style="font-size:0.75rem;font-weight:700;color:var(--text-muted);white-space:nowrap;">' + pct + '%</span>' +
          '</div>' +
        '</td>' +
        '<td style="text-align:center;">' +
          '<button class="btn btn-ghost btn-sm btn-icon" onclick="toggleVerified(\'' + s.id + '\',' + (s.verified?'true':'false') + ')" title="' + (s.verified?'Unverify':'Verify') + '">' +
            '<i class="fas ' + verifiedIcon + '" style="' + verifiedColor + '"></i>' +
          '</button>' +
        '</td>' +
        '<td><span class="badge ' + statusBadge + '">' + esc(s.status||'active') + '</span></td>' +
        '<td><div style="display:flex;gap:5px;">' +
          '<button class="btn btn-ghost btn-sm btn-icon" onclick="openUserEdit(\'' + s.id + '\')" title="Edit"><i class="fas fa-pen"></i></button>' +
          '<button class="btn btn-ghost btn-sm btn-icon" onclick="toggleUserStatus(\'' + s.id + '\',\'' + (s.status||'active') + '\')" title="Suspend/Activate"><i class="fas ' + toggleIcon + '"></i></button>' +
        '</div></td>' +
      '</tr>';
    }).join('');
  }

  document.getElementById('sellersSearch').addEventListener('input', function() {
    sellersSearchQuery = this.value.trim().toLowerCase(); renderSellersTable();
  });

  function toggleVerified(uid, currentVerified) {
    var newVal = !currentVerified;
    db.collection('users').doc(uid).update({ verified: newVal, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
      .then(function() {
        var s = state.allSellers.find(function(x){ return x.id === uid; });
        var u = state.allUsers.find(function(x){ return x.id === uid; });
        if (s) s.verified = newVal;
        if (u) u.verified = newVal;
        renderSellersTable();
        showToast('Seller ' + (newVal ? 'verified.' : 'unverified.'), 'success');
        writeLog('Seller ' + (newVal?'verified':'unverified'), s?(s.storeName||s.firstName||uid):uid, 'blue');
      }).catch(function(){ showToast('Failed to update.', 'error'); });
  }
  window.toggleVerified = toggleVerified;

  // ============================================================
  // REPORTS
  // ============================================================
  var reportsStatusFilter = '';

  document.getElementById('reportsStatusFilter').addEventListener('change', function() {
    reportsStatusFilter = this.value; renderReportsTable();
  });

  function renderReportsTable() {
    var filtered = state.allReports.filter(function(r) {
      return !reportsStatusFilter || r.status === reportsStatusFilter;
    });
    document.getElementById('reportsCount').textContent = filtered.length + ' report' + (filtered.length !== 1 ? 's' : '');
    var tbody = document.getElementById('reportsTableBody');
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:2rem;">No reports found.</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map(function(r) {
      var statusBadge = r.status === 'resolved' ? 'badge-green' : r.status === 'dismissed' ? 'badge-gray' : 'badge-red';
      var typeBadge   = r.type === 'listing' ? 'badge-orange' : 'badge-blue';
      return '<tr>' +
        '<td style="font-weight:600;font-size:0.875rem;">' + esc(r.targetTitle || r.targetId || '—') + '</td>' +
        '<td><span class="badge ' + typeBadge + '">' + esc(r.type||'—') + '</span></td>' +
        '<td style="font-size:0.8125rem;max-width:200px;">' + esc(r.reason||'—') + '</td>' +
        '<td style="font-size:0.8125rem;">' + esc(r.reporterName||r.reporterId||'Anonymous') + '</td>' +
        '<td style="white-space:nowrap;font-size:0.8125rem;">' + timeAgo(r.createdAt) + '</td>' +
        '<td><span class="badge ' + statusBadge + '">' + esc(r.status||'pending') + '</span></td>' +
        '<td><div style="display:flex;gap:5px;">' +
          (r.status !== 'resolved'  ? '<button class="btn btn-ghost btn-sm" onclick="resolveReport(\'' + r.id + '\',\'resolved\')" title="Mark resolved"><i class="fas fa-check"></i></button>' : '') +
          (r.status !== 'dismissed' ? '<button class="btn btn-ghost btn-sm" onclick="resolveReport(\'' + r.id + '\',\'dismissed\')" title="Dismiss"><i class="fas fa-ban"></i></button>' : '') +
          (r.type === 'listing' && r.targetId ? '<button class="btn btn-ghost btn-sm btn-icon" onclick="adminDeleteListing(\'' + r.targetId + '\')" title="Delete listing" style="color:var(--red);"><i class="fas fa-trash"></i></button>' : '') +
        '</div></td>' +
      '</tr>';
    }).join('');
  }

  function resolveReport(id, newStatus) {
    db.collection('reports').doc(id).update({
      status: newStatus, resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      resolvedBy: state.adminUser.uid
    }).then(function() {
      var r = state.allReports.find(function(x){ return x.id === id; });
      if (r) r.status = newStatus;
      renderReportsTable();
      var pending = state.allReports.filter(function(r){ return r.status === 'pending'; });
      var badge = document.getElementById('badgeReports');
      if (badge) { badge.textContent = pending.length; badge.style.display = pending.length > 0 ? '' : 'none'; }
      showToast('Report ' + newStatus + '.', 'success');
      writeLog('Report ' + newStatus, r?(r.reason||''):id, newStatus === 'resolved' ? 'green' : 'gray');
    }).catch(function(){ showToast('Failed to update report.', 'error'); });
  }
  window.resolveReport = resolveReport;

  // ============================================================
  // ANNOUNCEMENTS
  // ============================================================
  document.getElementById('newAnnouncementBtn').addEventListener('click', function() {
    document.getElementById('editAnnouncementId').value = '';
    document.getElementById('annTitle').value   = '';
    document.getElementById('annMessage').value = '';
    document.getElementById('annTarget').value  = 'all';
    document.getElementById('annStatus').value  = 'active';
    document.getElementById('announcementModalTitle').textContent = 'New Announcement';
    document.getElementById('announcementModalSave').innerHTML = '<i class="fas fa-paper-plane"></i> Publish';
    updateAnnPreview();
    openModal('announcementModal');
  });

  // Live preview update
  ['annTitle','annMessage','annTarget','annStatus'].forEach(function(id) {
    document.getElementById(id).addEventListener('input', updateAnnPreview);
    document.getElementById(id).addEventListener('change', updateAnnPreview);
  });

  function updateAnnPreview() {
    var title  = document.getElementById('annTitle').value  || 'Announcement Title';
    var body   = document.getElementById('annMessage').value || 'Your message will appear here…';
    var target = document.getElementById('annTarget').value;
    var status = document.getElementById('annStatus').value;
    var targetLabels = { all:'All Users', seller:'Sellers Only', customer:'Customers Only' };
    document.getElementById('annPreviewTitle').textContent = title;
    document.getElementById('annPreviewBody').textContent  = body;
    document.getElementById('annPreviewMeta').textContent  = 'Target: ' + (targetLabels[target]||target) + ' · ' + (status === 'active' ? 'Active' : 'Draft');
  }

  function renderAnnouncementsTable() {
    var tbody = document.getElementById('announcementsTableBody');
    if (!state.allAnnouncements.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:2rem;">No announcements yet.</td></tr>';
      return;
    }
    tbody.innerHTML = state.allAnnouncements.map(function(a) {
      var statusBadge = a.status === 'active' ? 'badge-green' : 'badge-amber';
      var targetBadge = a.target === 'seller' ? 'badge-orange' : a.target === 'customer' ? 'badge-blue' : 'badge-gray';
      return '<tr>' +
        '<td style="font-weight:600;">' + esc(a.title||'—') + '</td>' +
        '<td><span class="badge ' + targetBadge + '">' + esc(a.target||'all') + '</span></td>' +
        '<td style="font-size:0.8125rem;white-space:nowrap;">' + formatDate(a.createdAt) + '</td>' +
        '<td><span class="badge ' + statusBadge + '">' + esc(a.status||'draft') + '</span></td>' +
        '<td><div style="display:flex;gap:5px;">' +
          '<button class="btn btn-ghost btn-sm btn-icon" onclick="editAnnouncement(\'' + a.id + '\')" title="Edit"><i class="fas fa-pen"></i></button>' +
          '<button class="btn btn-ghost btn-sm btn-icon" onclick="deleteAnnouncement(\'' + a.id + '\')" title="Delete" style="color:var(--red);"><i class="fas fa-trash"></i></button>' +
        '</div></td>' +
      '</tr>';
    }).join('');
  }

  function editAnnouncement(id) {
    var a = state.allAnnouncements.find(function(x){ return x.id === id; });
    if (!a) return;
    document.getElementById('editAnnouncementId').value = id;
    document.getElementById('annTitle').value   = a.title   || '';
    document.getElementById('annMessage').value = a.message || '';
    document.getElementById('annTarget').value  = a.target  || 'all';
    document.getElementById('annStatus').value  = a.status  || 'active';
    document.getElementById('announcementModalTitle').textContent = 'Edit Announcement';
    document.getElementById('announcementModalSave').innerHTML = '<i class="fas fa-floppy-disk"></i> Save';
    updateAnnPreview();
    openModal('announcementModal');
  }
  window.editAnnouncement = editAnnouncement;

  function deleteAnnouncement(id) {
    confirmDelete('Delete this announcement? This cannot be undone.', function() {
      db.collection('announcements').doc(id).delete().then(function() {
        state.allAnnouncements = state.allAnnouncements.filter(function(x){ return x.id !== id; });
        renderAnnouncementsTable();
        showToast('Announcement deleted.', 'success');
        writeLog('Announcement deleted', id, 'red');
      }).catch(function(){ showToast('Failed to delete.', 'error'); });
    });
  }
  window.deleteAnnouncement = deleteAnnouncement;

  document.getElementById('announcementModalSave').addEventListener('click', function() {
    var id      = document.getElementById('editAnnouncementId').value;
    var title   = document.getElementById('annTitle').value.trim();
    var message = document.getElementById('annMessage').value.trim();
    var target  = document.getElementById('annTarget').value;
    var status  = document.getElementById('annStatus').value;
    if (!title || !message) { showToast('Title and message are required.', 'error'); return; }

    var now = new Date(); // FIX #8: use real Date locally, not sentinel
    var payload = { title: title, message: message, target: target, status: status, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };

    if (id) {
      db.collection('announcements').doc(id).update(payload).then(function() {
        var a = state.allAnnouncements.find(function(x){ return x.id===id; });
        if (a) { a.title=title; a.message=message; a.target=target; a.status=status; a.updatedAt=now; }
        renderAnnouncementsTable();
        closeModal('announcementModal');
        showToast('Announcement updated.', 'success');
        writeLog('Announcement updated', title, 'blue');
      }).catch(function(){ showToast('Failed to save.', 'error'); });
    } else {
      var createPayload = Object.assign({}, payload, {
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        authorId:  state.adminUser.uid
      });
      db.collection('announcements').add(createPayload).then(function(ref) {
        // FIX #8: store real Date locally instead of sentinel
        state.allAnnouncements.unshift(Object.assign({ id: ref.id }, payload, { createdAt: now }));
        renderAnnouncementsTable();
        closeModal('announcementModal');
        showToast('Announcement published!', 'success');
        writeLog('Announcement created', title, 'green');
      }).catch(function(){ showToast('Failed to publish.', 'error'); });
    }
  });

  ['announcementModalClose','announcementModalCancel'].forEach(function(id) {
    document.getElementById(id).addEventListener('click', function(){ closeModal('announcementModal'); });
  });

  // ============================================================
  // CATEGORIES
  // ============================================================
  document.getElementById('newCategoryBtn').addEventListener('click', function() {
    document.getElementById('editCategoryId').value = '';
    document.getElementById('catName').value  = '';
    document.getElementById('catIcon').value  = '';
    document.getElementById('catOrder').value = '';
    document.getElementById('categoryModalTitle').textContent = 'Add Category';
    openModal('categoryModal');
  });

  document.getElementById('categoryModalSave').addEventListener('click', function() {
    var id    = document.getElementById('editCategoryId').value;
    var name  = document.getElementById('catName').value.trim();
    var icon  = document.getElementById('catIcon').value.trim();
    var order = parseInt(document.getElementById('catOrder').value, 10) || 99;
    if (!name) { showToast('Category name is required.', 'error'); return; }

    var payload = { name: name, icon: icon || 'fa-tag', order: order };
    if (id) {
      db.collection('categories').doc(id).update(payload).then(function() {
        var c = state.allCategories.find(function(x){ return x.id===id; });
        if (c) Object.assign(c, payload);
        renderCategories();
        closeModal('categoryModal');
        showToast('Category updated.', 'success');
        writeLog('Category updated', name, 'blue');
      }).catch(function(){ showToast('Failed to update.', 'error'); });
    } else {
      var slugId = name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
      db.collection('categories').doc(slugId).set(payload).then(function() {
        state.allCategories.push(Object.assign({ id: slugId }, payload));
        state.allCategories.sort(function(a,b){ return a.order - b.order; });
        renderCategories();
        closeModal('categoryModal');
        showToast('Category added.', 'success');
        writeLog('Category added', name, 'green');
      }).catch(function(){ showToast('Failed to add.', 'error'); });
    }
  });

  ['categoryModalClose','categoryModalCancel'].forEach(function(id) {
    document.getElementById(id).addEventListener('click', function(){ closeModal('categoryModal'); });
  });

  function renderCategories() {
    var body = document.getElementById('categoriesBody');
    if (!body) return;
    if (!state.allCategories.length) {
      body.innerHTML = '<div class="empty-state"><i class="fas fa-tags"></i><p>No categories yet.</p></div>';
      return;
    }
    var html = '<div class="cat-list">';
    state.allCategories.forEach(function(c) {
      var listingCount = state.allListings.filter(function(l){ return l.category === c.id || l.category === c.name.toLowerCase(); }).length;
      html +=
        '<div class="cat-item">' +
          '<div class="cat-item-icon"><i class="fas ' + esc(c.icon||'fa-tag') + '"></i></div>' +
          '<div class="cat-item-name">' + esc(c.name) + '</div>' +
          '<div class="cat-item-count">' + listingCount + ' listing' + (listingCount !== 1 ? 's' : '') + '</div>' +
          '<div style="display:flex;gap:5px;">' +
            '<button class="btn btn-ghost btn-sm btn-icon" onclick="editCategory(\'' + c.id + '\')" title="Edit"><i class="fas fa-pen"></i></button>' +
            '<button class="btn btn-ghost btn-sm btn-icon" onclick="deleteCategory(\'' + c.id + '\')" title="Delete" style="color:var(--red);"><i class="fas fa-trash"></i></button>' +
          '</div>' +
        '</div>';
    });
    html += '</div>';
    body.innerHTML = html;
  }

  function editCategory(id) {
    var c = state.allCategories.find(function(x){ return x.id === id; });
    if (!c) return;
    document.getElementById('editCategoryId').value = id;
    document.getElementById('catName').value  = c.name  || '';
    document.getElementById('catIcon').value  = c.icon  || '';
    document.getElementById('catOrder').value = c.order || '';
    document.getElementById('categoryModalTitle').textContent = 'Edit Category';
    openModal('categoryModal');
  }
  window.editCategory = editCategory;

  function deleteCategory(id) {
    confirmDelete('Delete this category? Existing listings will not be affected.', function() {
      db.collection('categories').doc(id).delete().then(function() {
        state.allCategories = state.allCategories.filter(function(x){ return x.id !== id; });
        renderCategories();
        showToast('Category deleted.', 'success');
        writeLog('Category deleted', id, 'red');
      }).catch(function(){ showToast('Failed to delete.', 'error'); });
    });
  }
  window.deleteCategory = deleteCategory;

  // ============================================================
  // AUDIT LOG
  // ============================================================
  document.getElementById('refreshLogsBtn').addEventListener('click', renderLogs);

  function renderLogs() {
    var body = document.getElementById('logsBody');
    if (!body) return;
    body.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading…</p></div>';
    db.collection('adminLogs').orderBy('createdAt', 'desc').limit(50).get().then(function(snap) {
      if (snap.empty) {
        body.innerHTML = '<div class="empty-state"><i class="fas fa-clock-rotate-left"></i><p>No actions logged yet.</p></div>';
        return;
      }
      var html = '';
      snap.forEach(function(d) {
        var log = d.data();
        var colorMap = { green:'green', orange:'orange', red:'red', blue:'blue', amber:'orange', gray:'blue' };
        var iconMap  = {
          green:'fa-check', orange:'fa-toggle-on', red:'fa-trash',
          blue:'fa-pen', amber:'fa-star', gray:'fa-ban'
        };
        var color = colorMap[log.color] || 'blue';
        var icon  = iconMap[log.color]  || 'fa-pen';
        html +=
          '<div class="log-item">' +
            '<div class="log-icon ' + color + '"><i class="fas ' + icon + '"></i></div>' +
            '<div class="log-text"><strong>' + esc(log.action||'Action') + '</strong>' + (log.detail ? ' — ' + esc(log.detail) : '') + '<br/><span style="font-size:0.75rem;color:var(--text-light);">by ' + esc(log.adminName||'Admin') + '</span></div>' +
            '<div class="log-time">' + timeAgo(log.createdAt) + '</div>' +
          '</div>';
      });
      body.innerHTML = html;
    }).catch(function() {
      body.innerHTML = '<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Could not load logs.</p></div>';
    });
  }

  // ============================================================
  // SETTINGS
  // ============================================================
  function renderSettings() {
    var cfg    = FIREBASE_CONFIG;
    var infoEl = document.getElementById('settingsFirebaseInfo');
    if (infoEl) {
      infoEl.innerHTML =
        '<div><strong>Project ID:</strong> ' + esc(cfg.projectId) + '</div>' +
        '<div><strong>Auth Domain:</strong> ' + esc(cfg.authDomain) + '</div>' +
        '<div><strong>Storage Bucket:</strong> ' + esc(cfg.storageBucket) + '</div>' +
        '<div style="margin-top:8px;padding:8px 12px;background:var(--forest-tint);border-radius:8px;font-size:0.8125rem;color:var(--forest);">' +
        '<i class="fas fa-circle-check" style="margin-right:6px;"></i>Firebase connected successfully.</div>';
    }
  }

  document.getElementById('saveAdminNameBtn').addEventListener('click', function() {
    if (!state.adminUser) return;
    var name = document.getElementById('settingsAdminName').value.trim();
    if (!name) { showToast('Please enter a name.', 'error'); return; }
    var parts = name.split(' ');
    db.collection('users').doc(state.adminUser.uid).update({
      firstName: parts[0], lastName: parts.slice(1).join(' '),
      fullName: name, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
      document.getElementById('adminName').textContent = name;
      showToast('Name updated.', 'success');
      writeLog('Admin name updated', name, 'blue');
    }).catch(function(){ showToast('Failed to update.', 'error'); });
  });

  // FIX #7: batch chunked to 500 items max
  document.getElementById('deleteAllDraftListingsBtn').addEventListener('click', function() {
    var drafts = state.allListings.filter(function(l){ return l.status === 'draft'; });
    if (!drafts.length) { showToast('No draft listings to delete.', 'info'); return; }
    confirmDelete('Delete ALL ' + drafts.length + ' draft listings? This cannot be undone.', function() {
      var chunks   = chunkArray(drafts, 500);
      var promises = chunks.map(function(chunk) {
        var batch = db.batch();
        chunk.forEach(function(l) { batch.delete(db.collection('listings').doc(l.id)); });
        return batch.commit();
      });
      Promise.all(promises).then(function() {
        state.allListings = state.allListings.filter(function(l){ return l.status !== 'draft'; });
        updateListingStats(); // FIX #5: update stat cards
        showToast('All draft listings deleted.', 'success');
        writeLog('Bulk delete drafts', drafts.length + ' listings', 'red');
      }).catch(function(){ showToast('Failed to delete drafts.', 'error'); });
    });
  });

  // ============================================================
  // CSV EXPORT UTILITY
  // ============================================================
  function exportCSV(headers, rows, filename) {
    var lines = [headers.join(',')];
    rows.forEach(function(row) {
      lines.push(row.map(function(cell) {
        var v = String(cell == null ? '' : cell).replace(/"/g, '""');
        return v.indexOf(',') !== -1 || v.indexOf('"') !== -1 || v.indexOf('\n') !== -1
          ? '"' + v + '"' : v;
      }).join(','));
    });
    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV exported.', 'success');
    writeLog('CSV export', filename, 'blue');
  }

  // ============================================================
  // CONFIRM MODAL — FIX #4: close AFTER delete resolves (moved to each delete fn)
  // ============================================================
  document.getElementById('confirmModalOk').addEventListener('click', function() {
    if (state.pendingDeleteFn) {
      state.pendingDeleteFn();
      state.pendingDeleteFn = null;
    }
    closeModal('confirmModal');
  });
  ['confirmModalClose','confirmModalCancel'].forEach(function(id) {
    document.getElementById(id).addEventListener('click', function() {
      state.pendingDeleteFn = null; closeModal('confirmModal');
    });
  });

  // Close modals on backdrop click
  ['userModal','announcementModal','confirmModal','categoryModal'].forEach(function(id) {
    document.getElementById(id).addEventListener('click', function(e) {
      if (e.target === e.currentTarget) { state.pendingDeleteFn = null; closeModal(id); }
    });
  });

  // ESC key closes any open modal
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    ['userModal','announcementModal','confirmModal','categoryModal'].forEach(function(id) {
      if (document.getElementById(id).classList.contains('open')) {
        state.pendingDeleteFn = null; closeModal(id);
      }
    });
  });

  // Redraw chart on window resize
  window.addEventListener('resize', function() {
    if (state.currentSection === 'overview') drawRegChart();
  });

