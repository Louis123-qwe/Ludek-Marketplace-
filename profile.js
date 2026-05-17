'use strict';

// ============================================================
// PROFILE.JS
// Handles: banner upload, avatar upload (Cloudinary),
//          form prefill from Firestore, save back to Firestore
// ============================================================

(function Profile() {

  // ── Config ────────────────────────────────────────────────
  const CLOUDINARY_CLOUD  = window.CLOUDINARY_CLOUD_NAME   || 'dataktghg';
  const CLOUDINARY_PRESET = window.CLOUDINARY_UPLOAD_PRESET || 'Ludek Marketplace';

  let currentUser = null;
  let currentData = null;

  // ── Boot ──────────────────────────────────────────────────
  window.addEventListener('seller:ready', ({ detail: { user, data } }) => {
    currentUser = user;
    currentData = data;

    prefillForm(user, data);
    initBannerUpload();
    initAvatarUpload();
    initFormValidation();
    initCharCounter();
    updatePublicLink(user.uid);

    hidePageLoader();
  });

  // ── Prefill ───────────────────────────────────────────────
  function prefillForm(user, data) {
    setVal('profileFirstName',  data.firstName  || '');
    setVal('profileLastName',   data.lastName   || '');
    setVal('profileStoreName',  data.storeName  || '');
    setVal('profileBio',        data.bio        || '');
    setVal('profileEmail',      user.email      || '');
    setVal('profileWhatsapp',   data.whatsapp   || '');
    setVal('profileDepartment', data.department || '');
    setVal('profileLevel',      data.level      || '');
    setVal('profileInstagram',  data.instagram  || '');
    setVal('profileTwitter',    data.twitter    || '');

    // Display name + handle
    updateDisplayName(data);

    // Banner
    if (data.bannerURL) {
      showBannerPreview(data.bannerURL);
    }

    // Avatar
    if (data.photoURL) {
      showAvatarPreview(data.photoURL);
    }

    // Char counter init
    updateCharCounter('profileBio', 'bioCount', 400);
  }

  function updateDisplayName(data) {
    const fullName  = [data.firstName, data.lastName].filter(Boolean).join(' ') || 'Your Store';
    const storeName = data.storeName || fullName;

    const nameEl   = document.getElementById('profileDisplayName');
    const handleEl = document.getElementById('profileHandle');

    if (nameEl)   nameEl.textContent   = storeName;
    if (handleEl) handleEl.textContent = '@' + (data.firstName || 'seller').toLowerCase().replace(/\s+/g, '');
  }

  function updatePublicLink(uid) {
    const link = document.getElementById('viewPublicProfileLink');
    if (link) link.href = `/seller.html?id=${uid}`;
  }

  // ── Banner Upload ─────────────────────────────────────────
  function initBannerUpload() {
    const editBtn = document.getElementById('bannerEditBtn');
    const input   = document.getElementById('bannerInput');
    if (!editBtn || !input) return;

    editBtn.addEventListener('click', () => input.click());

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { showToast('Select an image file.', 'error'); return; }
      if (file.size > 10 * 1024 * 1024)    { showToast('Banner must be under 10 MB.', 'error'); return; }
      uploadBanner(file);
    });
  }

  async function uploadBanner(file) {
    toggleBannerLoading(true);
    try {
      const url = await uploadToCloudinary(file, 'ludek/banners');
      await firebase.firestore().collection('users').doc(currentUser.uid).update({
        bannerURL: url,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      currentData.bannerURL = url;
      showBannerPreview(url);
      showToast('Banner updated!', 'success');
    } catch (err) {
      console.error('[Profile] Banner upload error:', err);
      showToast('Banner upload failed.', 'error');
    } finally {
      toggleBannerLoading(false);
    }
  }

  function showBannerPreview(url) {
    const img         = document.getElementById('bannerPreviewImg');
    const placeholder = document.getElementById('bannerPlaceholder');
    if (img) { img.src = url; img.style.display = ''; }
    if (placeholder) placeholder.style.display = 'none';
  }

  function toggleBannerLoading(on) {
    const el = document.getElementById('bannerUploading');
    if (el) el.style.display = on ? 'flex' : 'none';
  }

  // ── Avatar Upload ─────────────────────────────────────────
  function initAvatarUpload() {
    const editBtn = document.getElementById('avatarEditBtn');
    const input   = document.getElementById('avatarInput');
    if (!editBtn || !input) return;

    editBtn.addEventListener('click', () => input.click());

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { showToast('Select an image file.', 'error'); return; }
      if (file.size > 5 * 1024 * 1024)    { showToast('Photo must be under 5 MB.', 'error'); return; }
      uploadAvatar(file);
    });
  }

  async function uploadAvatar(file) {
    toggleAvatarLoading(true);
    try {
      const url = await uploadToCloudinary(file, 'ludek/avatars');

      // Update Firestore + Firebase Auth profile
      await firebase.firestore().collection('users').doc(currentUser.uid).update({
        photoURL:  url,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      await currentUser.updateProfile({ photoURL: url });

      currentData.photoURL = url;
      showAvatarPreview(url);

      // Also update sidebar/topbar avatars
      document.querySelectorAll('#sidebarAvatar, #topbarAvatar').forEach(wrap => {
        if (wrap.tagName === 'A') {
          wrap.innerHTML = `<img src="${url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
        } else {
          wrap.innerHTML = `<img src="${url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;" />`;
        }
      });

      showToast('Profile photo updated!', 'success');
    } catch (err) {
      console.error('[Profile] Avatar upload error:', err);
      showToast('Photo upload failed.', 'error');
    } finally {
      toggleAvatarLoading(false);
    }
  }

  function showAvatarPreview(url) {
    const wrap = document.getElementById('avatarPreview');
    if (wrap) wrap.innerHTML = `<img src="${url}" alt="Profile photo" style="width:100%;height:100%;object-fit:cover;" />`;
  }

  function toggleAvatarLoading(on) {
    const el = document.getElementById('avatarUploading');
    if (el) el.style.display = on ? 'flex' : 'none';
  }

  // ── Cloudinary Upload ─────────────────────────────────────
  async function uploadToCloudinary(file, folder) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    formData.append('folder', folder);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      { method: 'POST', body: formData }
    );
    if (!res.ok) throw new Error(`Cloudinary ${res.status}`);
    const data = await res.json();
    return data.secure_url;
  }

  // ── Form Validation & Save ────────────────────────────────
  function initFormValidation() {
    const form = document.getElementById('profileForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateForm()) return;
      await saveProfile();
    });

    ['profileFirstName','profileLastName','profileWhatsapp'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('blur', () => validateField(id));
    });

    // Live display name update
    ['profileFirstName','profileLastName','profileStoreName'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => {
        updateDisplayName({
          firstName:  val('profileFirstName'),
          lastName:   val('profileLastName'),
          storeName:  val('profileStoreName'),
        });
      });
    });
  }

  function validateForm() {
    let valid = true;
    valid = validateField('profileFirstName') && valid;
    valid = validateField('profileLastName')  && valid;
    valid = validateField('profileWhatsapp')  && valid;
    return valid;
  }

  function validateField(id) {
    const input = document.getElementById(id);
    if (!input) return true;

    const errorMap = {
      profileFirstName: 'firstNameError',
      profileLastName:  'lastNameError',
      profileWhatsapp:  'whatsappError',
    };
    const errEl = document.getElementById(errorMap[id]);

    let message = '';

    if (input.required && !input.value.trim()) {
      message = 'This field is required.';
    } else if (id === 'profileWhatsapp' && input.value.trim()) {
      const cleaned = input.value.replace(/\D/g, '');
      if (cleaned.length < 10 || cleaned.length > 14) {
        message = 'Enter a valid phone number.';
      }
    }

    setFieldError(input, errEl, message);
    return !message;
  }

  function setFieldError(input, errEl, message) {
    if (message) {
      input.classList.add('error');
      if (errEl) { errEl.innerHTML = `<i class="fas fa-triangle-exclamation"></i> ${message}`; errEl.classList.add('show'); }
    } else {
      input.classList.remove('error');
      if (errEl) { errEl.textContent = ''; errEl.classList.remove('show'); }
    }
  }

  async function saveProfile() {
    const btn = document.getElementById('profileSubmitBtn');
    setLoading(btn, true);

    try {
      const whatsapp = val('profileWhatsapp').replace(/\D/g, '');

      const payload = {
        firstName:  val('profileFirstName').trim(),
        lastName:   val('profileLastName').trim(),
        storeName:  val('profileStoreName').trim(),
        bio:        val('profileBio').trim(),
        whatsapp,
        department: val('profileDepartment').trim(),
        level:      val('profileLevel'),
        instagram:  val('profileInstagram').trim(),
        twitter:    val('profileTwitter').trim(),
        updatedAt:  firebase.firestore.FieldValue.serverTimestamp(),
      };

      await firebase.firestore().collection('users').doc(currentUser.uid).update(payload);

      // Update Firebase Auth display name
      const displayName = payload.storeName || `${payload.firstName} ${payload.lastName}`.trim();
      await currentUser.updateProfile({ displayName });

      // Update local cache
      Object.assign(currentData, payload);

      // Update sidebar name
      const sidebarName = document.getElementById('sidebarName');
      if (sidebarName) sidebarName.textContent = displayName || payload.firstName;

      showToast('Profile saved successfully!', 'success');

    } catch (err) {
      console.error('[Profile] Save error:', err);
      showToast('Could not save profile. Try again.', 'error');
    } finally {
      setLoading(btn, false);
    }
  }

  // ── Char Counter ──────────────────────────────────────────
  function initCharCounter() {
    const bio = document.getElementById('profileBio');
    if (!bio) return;
    bio.addEventListener('input', () => updateCharCounter('profileBio', 'bioCount', 400));
  }

  function updateCharCounter(inputId, counterId, max) {
    const input   = document.getElementById(inputId);
    const counter = document.getElementById(counterId);
    if (!input || !counter) return;
    const len = input.value.length;
    counter.textContent = len;
    counter.style.color = len >= max * 0.9 ? 'var(--orange)' : '';
  }

  // ── Utilities ─────────────────────────────────────────────
  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  function setLoading(btn, on) {
    if (!btn) return;
    if (on) btn.classList.add('loading');
    else    btn.classList.remove('loading');
    btn.disabled = on;
  }

  function hidePageLoader() {
    const loader = document.getElementById('pageLoader');
    if (loader) { loader.classList.add('hidden'); setTimeout(() => loader.remove(), 500); }
  }

})();
      
