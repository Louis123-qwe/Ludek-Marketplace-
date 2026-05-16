// ============================================================
// LUDEK MARKETPLACE — AUTH.JS  (Phase 2)
// Verified against auth.html element IDs — no mismatches.
//
// IDs used from auth.html:
//   redirectScreen, redirectLabel
//   tabLogin, tabSignup
//   paneLogin, paneSignup
//   authAlertLogin, authAlertSignup
//   loginForm, loginEmail, loginEmailError
//   loginPassword, loginPasswordError, loginPasswordToggle
//   loginBtn, forgotPasswordLink, switchToSignup
//   signupForm, signupFirstName, signupFirstNameError
//   signupLastName, signupLastNameError
//   signupEmail, signupEmailError
//   signupPassword, signupPasswordError
//   signupPasswordToggle, passwordStrength
//   signupRole (radio: customer | seller)
//   signupBtn, switchToLogin
//   forgotModal, forgotTitle, forgotModalClose
//   resetAlert, forgotForm, resetEmail, resetEmailError, resetBtn
// ============================================================

'use strict';

// ============================================================
// FIREBASE BOOTSTRAP
// ============================================================
function bootFirebase() {
  var cfg = window.LUDEK_FIREBASE_CONFIG;

  if (!cfg || !cfg.apiKey || cfg.apiKey === 'YOUR_API_KEY') {
    showAlert('authAlertLogin', 'error',
      'Firebase is not configured yet. Open firebase/config.js and paste your credentials.');
    showAlert('authAlertSignup', 'error',
      'Firebase is not configured yet. Open firebase/config.js and paste your credentials.');
    return false;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(cfg);
  }
  return true;
}

function auth() { return firebase.auth(); }
function db()   { return firebase.firestore(); }

// ============================================================
// ROLE → REDIRECT MAP
// ============================================================
var REDIRECTS = {
  customer : '/marketplace.html',
  seller   : '/dashboard.html',
  admin    : '/admin/dashboard.html'
};

// ============================================================
// REDIRECT SCREEN
// ============================================================
function showRedirectScreen(role) {
  var screen = document.getElementById('redirectScreen');
  var label  = document.getElementById('redirectLabel');

  var messages = {
    customer : 'Taking you to the Marketplace…',
    seller   : 'Opening your Seller Dashboard…',
    admin    : 'Loading Admin Panel…'
  };

  if (label)  label.textContent = messages[role] || 'Redirecting…';
  if (screen) screen.classList.add('show');
}

function doRedirect(role) {
  showRedirectScreen(role);
  var dest = REDIRECTS[role] || REDIRECTS.customer;
  setTimeout(function () { window.location.href = dest; }, 1300);
}

// ============================================================
// AUTH STATE OBSERVER
// If user is already logged in → fetch role → redirect
// ============================================================
function watchAuthState() {
  auth().onAuthStateChanged(function (user) {
    if (!user) return; // not logged in — stay on page

    db().collection('users').doc(user.uid).get()
      .then(function (snap) {
        var role = snap.exists ? (snap.data().role || 'customer') : 'customer';
        doRedirect(role);
      })
      .catch(function (err) {
        console.warn('[Ludek] onAuthStateChanged role fetch failed:', err.message);
        // Still redirect — just default to customer
        doRedirect('customer');
      });
  });
}

// ============================================================
// SIGNUP HANDLER
// ============================================================
function handleSignup(e) {
  e.preventDefault();

  var firstName = val('signupFirstName');
  var lastName  = val('signupLastName');
  var email     = val('signupEmail');
  var password  = val('signupPassword');
  var role      = checkedRadio('signupRole') || 'customer';

  // --- Validate ---
  clearAllErrors();
  var ok = true;

  if (!firstName) { fieldError('signupFirstName', 'First name is required');          ok = false; }
  if (!lastName)  { fieldError('signupLastName',  'Last name is required');           ok = false; }
  if (!validEmail(email))   { fieldError('signupEmail',    'Enter a valid email');    ok = false; }
  if (password.length < 6) { fieldError('signupPassword', 'Minimum 6 characters');   ok = false; }
  if (!ok) return;

  setLoading('signupBtn', true);
  hideAlert('authAlertSignup');

  auth().createUserWithEmailAndPassword(email, password)
    .then(function (cred) {
      var user = cred.user;

      // Update display name (non-blocking)
      var displayName = firstName + ' ' + lastName;
      user.updateProfile({ displayName: displayName }).catch(function () {});

      // Send verification email (non-blocking — never block signup)
      user.sendEmailVerification().catch(function () {});

      // Write Firestore user doc
      return db().collection('users').doc(user.uid).set({
        uid        : user.uid,
        firstName  : firstName,
        lastName   : lastName,
        fullName   : displayName,
        email      : email.toLowerCase(),
        role       : role,
        status     : 'active',
        whatsapp   : '',
        bio        : '',
        bannerURL  : '',
        photoURL   : '',
        storeName  : '',
        savedItems : [],
        createdAt  : firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt  : firebase.firestore.FieldValue.serverTimestamp()
      });
    })
    .then(function () {
      doRedirect(role);
    })
    .catch(function (err) {
      setLoading('signupBtn', false);
      showAlert('authAlertSignup', 'error', friendlyError(err));
      console.error('[Ludek] Signup error:', err.code, err.message);
    });
}

// ============================================================
// LOGIN HANDLER
// ============================================================
function handleLogin(e) {
  e.preventDefault();

  var email    = val('loginEmail');
  var password = val('loginPassword');

  // --- Validate ---
  clearAllErrors();
  var ok = true;

  if (!validEmail(email)) { fieldError('loginEmail',    'Enter a valid email address'); ok = false; }
  if (!password)          { fieldError('loginPassword', 'Password is required');        ok = false; }
  if (!ok) return;

  setLoading('loginBtn', true);
  hideAlert('authAlertLogin');

  auth().signInWithEmailAndPassword(email, password)
    .then(function (cred) {
      return db().collection('users').doc(cred.user.uid).get()
        .then(function (snap) {
          // Edge case: auth exists but Firestore doc missing
          if (!snap.exists) {
            return db().collection('users').doc(cred.user.uid).set({
              uid       : cred.user.uid,
              email     : cred.user.email || email.toLowerCase(),
              fullName  : cred.user.displayName || '',
              role      : 'customer',
              status    : 'active',
              createdAt : firebase.firestore.FieldValue.serverTimestamp(),
              updatedAt : firebase.firestore.FieldValue.serverTimestamp()
            }).then(function () {
              return { role: 'customer', status: 'active' };
            });
          }
          return snap.data();
        })
        .then(function (userData) {
          // Blocked account check
          if (userData.status === 'blocked') {
            return auth().signOut().then(function () {
              setLoading('loginBtn', false);
              showAlert('authAlertLogin', 'error',
                'Your account has been suspended. Contact support.');
            });
          }

          // Update last login (non-blocking)
          db().collection('users').doc(cred.user.uid).update({
            lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
          }).catch(function () {});

          doRedirect(userData.role || 'customer');
        });
    })
    .catch(function (err) {
      setLoading('loginBtn', false);
      showAlert('authAlertLogin', 'error', friendlyError(err));
      console.error('[Ludek] Login error:', err.code, err.message);
    });
}

// ============================================================
// FORGOT PASSWORD HANDLER
// ============================================================
function handleForgotPassword(e) {
  e.preventDefault();

  var email = val('resetEmail');

  clearFieldError('resetEmail');
  if (!validEmail(email)) {
    fieldError('resetEmail', 'Enter a valid email address');
    return;
  }

  setLoading('resetBtn', true);
  hideAlert('resetAlert');

  auth().sendPasswordResetEmail(email.toLowerCase())
    .then(function () {
      showAlert('resetAlert', 'success',
        'Reset link sent! Check your inbox (and spam folder).');
      document.getElementById('resetEmail').value = '';
      setLoading('resetBtn', false);
    })
    .catch(function (err) {
      showAlert('resetAlert', 'error', friendlyError(err));
      setLoading('resetBtn', false);
      console.error('[Ludek] Password reset error:', err.code, err.message);
    });
}

// ============================================================
// TAB SWITCHER
// IDs: tabLogin, tabSignup, paneLogin, paneSignup
// ============================================================
function setupTabs() {
  var tabLogin   = document.getElementById('tabLogin');
  var tabSignup  = document.getElementById('tabSignup');
  var paneLogin  = document.getElementById('paneLogin');
  var paneSignup = document.getElementById('paneSignup');

  if (!tabLogin || !tabSignup || !paneLogin || !paneSignup) return;

  function activateLogin() {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    tabLogin.setAttribute('aria-selected', 'true');
    tabSignup.setAttribute('aria-selected', 'false');
    paneLogin.classList.remove('hidden');
    paneSignup.classList.add('hidden');
    clearAllErrors();
    hideAlert('authAlertLogin');
    hideAlert('authAlertSignup');
    pushUrlMode('login');
  }

  function activateSignup() {
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    tabSignup.setAttribute('aria-selected', 'true');
    tabLogin.setAttribute('aria-selected', 'false');
    paneSignup.classList.remove('hidden');
    paneLogin.classList.add('hidden');
    clearAllErrors();
    hideAlert('authAlertLogin');
    hideAlert('authAlertSignup');
    pushUrlMode('signup');
  }

  tabLogin.addEventListener('click', activateLogin);
  tabSignup.addEventListener('click', activateSignup);

  // Read URL on load
  var params = new URLSearchParams(window.location.search);
  var mode   = params.get('mode');
  var role   = params.get('role');

  if (mode === 'signup') {
    activateSignup();
    if (role === 'seller') {
      var sellerRadio = document.getElementById('roleSeller');
      if (sellerRadio) sellerRadio.checked = true;
    }
  } else {
    activateLogin();
  }
}

function pushUrlMode(mode) {
  try {
    var url = new URL(window.location.href);
    url.searchParams.set('mode', mode);
    history.replaceState(null, '', url.toString());
  } catch (e) { /* IE compat — silent */ }
}

// ============================================================
// PASSWORD VISIBILITY TOGGLE
// ============================================================
function setupPasswordToggle(inputId, btnId) {
  var input = document.getElementById(inputId);
  var btn   = document.getElementById(btnId);
  if (!input || !btn) return;

  btn.addEventListener('click', function () {
    var isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    var icon = btn.querySelector('i');
    if (icon) {
      icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
    }
    btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  });
}

// ============================================================
// PASSWORD STRENGTH METER
// IDs: signupPassword, passwordStrength
// ============================================================
function setupStrengthMeter() {
  var input = document.getElementById('signupPassword');
  var meter = document.getElementById('passwordStrength');
  if (!input || !meter) return;

  var bars  = meter.querySelectorAll('.strength-bar');
  var label = meter.querySelector('.strength-label');

  input.addEventListener('input', function () {
    var pw = input.value;

    if (!pw) {
      meter.classList.remove('show');
      bars.forEach(function (b) { b.className = 'strength-bar'; });
      if (label) label.textContent = '';
      return;
    }

    meter.classList.add('show');
    var score = passwordScore(pw);                     // 0–4
    var levels = ['', 'weak', 'fair', 'good', 'strong'];
    var names  = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    var colors = ['', '#E53E3E', '#F97316', '#EAB308', '#6BA33A'];

    bars.forEach(function (bar, i) {
      bar.className = 'strength-bar';
      if (i < score) bar.classList.add('filled-' + levels[score]);
    });

    if (label) {
      label.textContent = 'Strength: ' + (names[score] || '');
      label.style.color = colors[score] || '';
    }
  });
}

function passwordScore(pw) {
  var score = 0;
  if (pw.length >= 6)  score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

// ============================================================
// FORGOT PASSWORD MODAL
// IDs: forgotPasswordLink, forgotModal, forgotModalClose,
//      forgotForm, resetEmail, resetAlert, resetBtn
// ============================================================
function setupForgotModal() {
  var link    = document.getElementById('forgotPasswordLink');
  var overlay = document.getElementById('forgotModal');
  var closeBtn= document.getElementById('forgotModalClose');
  var form    = document.getElementById('forgotForm');

  if (!overlay) return;

  function openModal() {
    // Pre-fill email if already typed in login field
    var loginEmail = val('loginEmail');
    var resetInput = document.getElementById('resetEmail');
    if (resetInput && validEmail(loginEmail)) {
      resetInput.value = loginEmail;
    }
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
    // Focus the email input for accessibility
    setTimeout(function () {
      if (resetInput) resetInput.focus();
    }, 250);
  }

  function closeModal() {
    overlay.classList.remove('show');
    document.body.style.overflow = '';
    hideAlert('resetAlert');
    clearFieldError('resetEmail');
  }

  if (link)     link.addEventListener('click', function (e) { e.preventDefault(); openModal(); });
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  // Click outside modal box to close
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal();
  });

  // Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('show')) closeModal();
  });

  if (form) form.addEventListener('submit', handleForgotPassword);
}

// ============================================================
// LIVE CLEAR ERRORS ON INPUT
// ============================================================
function setupLiveClear() {
  document.querySelectorAll('.auth-input').forEach(function (input) {
    input.addEventListener('input', function () {
      clearFieldError(input.id);
    });
  });
}

// ============================================================
// FORM SUBMIT LISTENERS
// ============================================================
function setupFormListeners() {
  var loginForm  = document.getElementById('loginForm');
  var signupForm = document.getElementById('signupForm');

  if (loginForm)  loginForm.addEventListener('submit', handleLogin);
  if (signupForm) signupForm.addEventListener('submit', handleSignup);
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/** Get trimmed value of an input by its id */
function val(id) {
  var el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

/** Get value of a checked radio group by name */
function checkedRadio(name) {
  var el = document.querySelector('input[name="' + name + '"]:checked');
  return el ? el.value : null;
}

/** Basic email format check */
function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Show field-level inline error
 *  Expects: input id → error span id = id + 'Error'
 */
function fieldError(inputId, message) {
  var input  = document.getElementById(inputId);
  var errEl  = document.getElementById(inputId + 'Error');
  if (input) input.classList.add('error');
  if (errEl) {
    // The span already has the icon inside; append text as a text node
    // Remove any old text node first
    var textNode = errEl.lastChild;
    while (textNode && textNode.nodeType === Node.TEXT_NODE) {
      errEl.removeChild(textNode);
      textNode = errEl.lastChild;
    }
    errEl.appendChild(document.createTextNode(' ' + message));
    errEl.classList.add('show');
  }
}

function clearFieldError(inputId) {
  var input = document.getElementById(inputId);
  var errEl = document.getElementById(inputId + 'Error');
  if (input) input.classList.remove('error');
  if (errEl) {
    // Remove text nodes (keep the icon)
    var textNode = errEl.lastChild;
    while (textNode && textNode.nodeType === Node.TEXT_NODE) {
      errEl.removeChild(textNode);
      textNode = errEl.lastChild;
    }
    errEl.classList.remove('show');
  }
}

function clearAllErrors() {
  document.querySelectorAll('.auth-input').forEach(function (el) {
    el.classList.remove('error');
  });
  document.querySelectorAll('.auth-error-msg').forEach(function (el) {
    el.classList.remove('show');
  });
}

/** Show / update an alert box
 *  alertId: 'authAlertLogin' | 'authAlertSignup' | 'resetAlert'
 *  type:    'error' | 'success' | 'info'
 */
function showAlert(alertId, type, message) {
  var el = document.getElementById(alertId);
  if (!el) return;

  // Reset classes
  el.className = 'auth-alert auth-alert-' + type + ' show';

  // Update icon
  var iconEl = el.querySelector('i');
  if (iconEl) {
    var icons = {
      error  : 'fas fa-circle-xmark',
      success: 'fas fa-circle-check',
      info   : 'fas fa-circle-info'
    };
    iconEl.className = icons[type] || icons.error;
    iconEl.setAttribute('aria-hidden', 'true');
  }

  // Update message text
  var spanEl = el.querySelector('span');
  if (spanEl) {
    spanEl.textContent = message;
  } else {
    // Fallback: append span
    var span = document.createElement('span');
    span.textContent = message;
    el.appendChild(span);
  }
}

function hideAlert(alertId) {
  var el = document.getElementById(alertId);
  if (el) el.classList.remove('show');
}

/** Toggle button loading state
 *  Expects: button has .btn-text child + .auth-submit-spinner child
 */
function setLoading(btnId, isLoading) {
  var btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = isLoading;
  btn.classList.toggle('loading', isLoading);
}

/** Map Firebase error codes → human-readable messages */
function friendlyError(err) {
  var map = {
    'auth/email-already-in-use'   : 'This email is already registered. Try logging in instead.',
    'auth/invalid-email'          : 'The email address format is not valid.',
    'auth/weak-password'          : 'Password is too weak. Use at least 6 characters.',
    'auth/user-not-found'         : 'No account found with that email address.',
    'auth/wrong-password'         : 'Incorrect password. Please try again.',
    'auth/invalid-credential'     : 'Incorrect email or password. Please try again.',
    'auth/too-many-requests'      : 'Too many failed attempts. Wait a moment and try again.',
    'auth/network-request-failed' : 'Network error. Check your connection.',
    'auth/user-disabled'          : 'This account has been disabled.',
    'auth/operation-not-allowed'  : 'Email sign-in is not enabled. Contact support.',
    'auth/requires-recent-login'  : 'Please log out and log back in before doing this.'
  };
  return map[err.code] || err.message || 'Something went wrong. Please try again.';
}

// ============================================================
// INIT
// ============================================================
function initAuth() {
  var ready = bootFirebase();

  if (ready) {
    watchAuthState();
  }

  setupTabs();
  setupPasswordToggle('loginPassword',  'loginPasswordToggle');
  setupPasswordToggle('signupPassword', 'signupPasswordToggle');
  setupStrengthMeter();
  setupForgotModal();
  setupLiveClear();
  setupFormListeners();
}

// Run after DOM is fully parsed
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}
