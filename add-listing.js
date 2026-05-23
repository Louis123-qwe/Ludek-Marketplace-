'use strict';

// ============================================================
// ADD-LISTING.JS
// Handles: image uploads (Cloudinary), form validation,
//          create & edit mode, Firestore save
// Depends on: seller-shell.js firing 'seller:ready'
// ============================================================

(function AddListing() {

  // ── Cloudinary config (set your own upload preset) ─────────
  const CLOUDINARY_CLOUD_NAME = 'dataktghg';   // ← replace
  const CLOUDINARY_UPLOAD_PRESET = 'Ludek Marketplace';    // ← Cloudinary preset names must be lowercase_underscore (no spaces)

  // ── State ──────────────────────────────────────────────────
  let currentUser  = null;
  let currentData  = null;
  let editListingId = null;           // non-null when editing
  let uploadedImages = [null, null, null, null]; // urls per slot
  let isSubmitting = false;

  // ── Boot: wait for shell auth signal ──────────────────────


  // ── Init ──────────────────────────────────────────────────
  function init() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInit);
  } else {
    runInit();
  }
}

function runInit() {
  detectEditMode();
  setupImageSlots();
  setupCategoryToggle();
  setupCharCounters();
  setupFormSubmit();
  setupRadioCards();
}
  // ── Edit Mode Detection ────────────────────────────────────
  // If URL has ?edit=<listingId>, we load existing data
  function detectEditMode() {
    const params = new URLSearchParams(window.location.search);
    editListingId = params.get('edit') || null;

    if (editListingId) {
      // Update headings
      const heading = document.getElementById('listingFormHeading');
      const pageTitle = document.getElementById('formPageTitle');
      const breadcrumbPage = document.querySelector('.topbar-breadcrumb-page');
      const submitBtnText = document.querySelector('#listingSubmitBtn .btn-text');

      if (heading) heading.textContent = 'Edit Listing';
      if (pageTitle) pageTitle.textContent = 'Edit Listing';
      if (breadcrumbPage) breadcrumbPage.textContent = 'Edit Listing';
      if (submitBtnText) submitBtnText.innerHTML = '<i class="fas fa-save"></i> Save Changes';

      loadListingForEdit(editListingId);
    }
  }

  // ── Load listing data into form (edit mode) ───────────────
  async function loadListingForEdit(id) {
    try {
      const doc = await firebase.firestore().collection('listings').doc(id).get();

      if (!doc.exists) {
        showToast('Listing not found.', 'error');
        setTimeout(() => window.location.replace('my-listings.html'), 1500);
        return;
      }

      const d = doc.data();

      // Security: only owner or admin can edit
      if (d.sellerId !== currentUser.uid && currentData.role !== 'admin') {
        showToast('You do not have permission to edit this listing.', 'error');
        setTimeout(() => window.location.replace('my-listings.html'), 1500);
        return;
      }

      populateForm(d);

    } catch (err) {
      console.error('[AddListing] Load for edit error:', err);
      showToast('Failed to load listing. Please try again.', 'error');
    }
  }

  // ── Populate form fields from Firestore data ──────────────
  function populateForm(d) {
    setVal('listingTitle',     d.title       || '');
    setVal('listingPrice',     d.price       != null ? d.price : '');
    setVal('listingCondition', d.condition   || 'new');
    setVal('listingDesc',      d.description || '');
    setVal('listingWhatsapp',  d.whatsapp    || '');
    setVal('listingLocation',  d.location    || '');
    setVal('listingCategory',  d.category    || '');

    // Custom category
    if (d.category === 'custom' && d.customCategory) {
      setVal('customCategory', d.customCategory);
      showCustomCategoryField(true);
    }

    // Negotiable toggle
    const neg = document.getElementById('listingNegotiable');
    if (neg) neg.checked = !!d.negotiable;

    // Status radio
    const statusRadios = document.querySelectorAll('input[name="listingStatus"]');
    statusRadios.forEach(r => {
      r.checked = (r.value === (d.status || 'active'));
    });
    updateRadioCards();

    // Char counters
    triggerCharCount('listingTitle',  'titleCount');
    triggerCharCount('listingDesc',   'descCount');

    // Images
    if (Array.isArray(d.images)) {
      d.images.forEach((url, i) => {
        if (i > 3 || !url) return;
        uploadedImages[i] = url;
        showImagePreview(i, url);
      });
    }
  }

  function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  // ── Image Slot Setup ──────────────────────────────────────
  function setupImageSlots() {
    for (let i = 0; i < 4; i++) {
      const slot  = document.getElementById(`imgSlot${i}`);
      const input = document.getElementById(`imgInput${i}`);
      if (!slot || !input) continue;

slot.addEventListener('click', (e) => {
  if (e.target.closest('.img-slot-remove')) return;
  if (uploadedImages[i]) {
    e.preventDefault();
    e.stopPropagation();
  }
});

      // File selected
      input.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        handleImageFile(i, file);
        // Reset input so same file can be re-selected after removal
        input.value = '';
      });
    }

    // Remove buttons (event delegation)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.img-slot-remove');
      if (!btn) return;
      const slot = parseInt(btn.getAttribute('data-slot'), 10);
      if (!isNaN(slot)) removeImage(slot);
    });
  }

  // ── Handle image file: validate → preview → upload ────────
  function handleImageFile(slotIndex, file) {
    // Validate type
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file.', 'error');
      return;
    }

    // Validate size (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5 MB.', 'error');
      return;
    }

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => {
      showImagePreview(slotIndex, ev.target.result, true); // true = loading
    };
    reader.readAsDataURL(file);

    // Upload to Cloudinary
    uploadToCloudinary(slotIndex, file);
  }

  // ── Show image preview in a slot ──────────────────────────
  function showImagePreview(slotIndex, url, uploading = false) {
    const preview    = document.getElementById(`imgPreview${slotIndex}`);
    const previewImg = document.getElementById(`imgPreviewImg${slotIndex}`);
    const placeholder = document.querySelector(`#imgSlot${slotIndex} .img-slot-placeholder`);
    const uploadingEl = document.getElementById(`imgUploading${slotIndex}`);

    if (!preview || !previewImg) return;

    previewImg.src = url;
    preview.style.display    = uploading ? 'none' : '';
    if (uploadingEl) uploadingEl.style.display = uploading ? 'flex' : 'none';
    if (placeholder) placeholder.style.display  = 'none';
  }

  // ── Upload a single image to Cloudinary ───────────────────
  async function uploadToCloudinary(slotIndex, file) {
    const uploadingEl = document.getElementById(`imgUploading${slotIndex}`);
    const previewEl   = document.getElementById(`imgPreview${slotIndex}`);
    const placeholder = document.querySelector(`#imgSlot${slotIndex} .img-slot-placeholder`);

    if (uploadingEl) uploadingEl.style.display = 'flex';
    if (previewEl)   previewEl.style.display   = 'none';
    if (placeholder) placeholder.style.display = 'none';

    const formData = new FormData();
    formData.append('file',           file);
    formData.append('upload_preset',  CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder',         'ludek-marketplace');

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      );

      if (!res.ok) {
        throw new Error(`Cloudinary error: ${res.status}`);
      }

      const json = await res.json();
      const secureUrl = json.secure_url;

      uploadedImages[slotIndex] = secureUrl;
      showImagePreview(slotIndex, secureUrl, false);

      // Clear images error if any
      hideError('imagesError');

    } catch (err) {
      console.error('[AddListing] Cloudinary upload failed:', err);
      showToast('Image upload failed. Please try again.', 'error');

      // Reset slot to empty
      removeImageUI(slotIndex);
    }
  }

  // ── Remove an uploaded image ───────────────────────────────
  function removeImage(slotIndex) {
    uploadedImages[slotIndex] = null;
    removeImageUI(slotIndex);
  }

  function removeImageUI(slotIndex) {
    const preview     = document.getElementById(`imgPreview${slotIndex}`);
    const uploadingEl = document.getElementById(`imgUploading${slotIndex}`);
    const placeholder = document.querySelector(`#imgSlot${slotIndex} .img-slot-placeholder`);
    const previewImg  = document.getElementById(`imgPreviewImg${slotIndex}`);

    if (preview)     { preview.style.display = 'none'; }
    if (uploadingEl) { uploadingEl.style.display = 'none'; }
    if (placeholder) { placeholder.style.display = ''; }
    if (previewImg)  { previewImg.src = ''; }
  }

  // ── Category → custom field toggle ────────────────────────
  function setupCategoryToggle() {
    const select = document.getElementById('listingCategory');
    if (!select) return;
    select.addEventListener('change', () => {
      showCustomCategoryField(select.value === 'custom');
    });
  }

  function showCustomCategoryField(show) {
    const field = document.getElementById('customCategoryField');
    const input = document.getElementById('customCategory');
    if (!field) return;
    field.style.display = show ? '' : 'none';
    if (input) {
      if (show) {
        input.setAttribute('required', 'required');
      } else {
        input.removeAttribute('required');
        input.value = '';
        hideError('customCategoryError');
      }
    }
  }

  // ── Character counters ─────────────────────────────────────
  function setupCharCounters() {
    bindCharCounter('listingTitle', 'titleCount');
    bindCharCounter('listingDesc',  'descCount');
  }

  function bindCharCounter(inputId, counterId) {
    const input   = document.getElementById(inputId);
    const counter = document.getElementById(counterId);
    if (!input || !counter) return;
    input.addEventListener('input', () => {
      counter.textContent = input.value.length;
    });
  }

  function triggerCharCount(inputId, counterId) {
    const input   = document.getElementById(inputId);
    const counter = document.getElementById(counterId);
    if (input && counter) counter.textContent = input.value.length;
  }

  // ── Radio card visual state ────────────────────────────────
  function setupRadioCards() {
    const radios = document.querySelectorAll('input[name="listingStatus"]');
    radios.forEach(r => {
      r.addEventListener('change', updateRadioCards);
    });
    updateRadioCards(); // init
  }

  function updateRadioCards() {
    const radios = document.querySelectorAll('input[name="listingStatus"]');
    radios.forEach(r => {
      const card = r.closest('.lf-radio-card');
      if (!card) return;
      if (r.checked) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  // ── Form Submission ────────────────────────────────────────
  function setupFormSubmit() {
    const form = document.getElementById('listingForm');
    if (!form) return;
    form.addEventListener('submit', handleSubmit);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    clearAllErrors();

    if (!validateForm()) return;

    setSubmitLoading(true);
    isSubmitting = true;

    try {
      const payload = buildPayload();

      if (editListingId) {
        // Update existing listing
        await firebase.firestore()
          .collection('listings')
          .doc(editListingId)
          .update({
            ...payload,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        showToast('Listing updated successfully!', 'success');
      } else {
        // Create new listing
        await firebase.firestore()
          .collection('listings')
          .add({
            ...payload,
            sellerId:  currentUser.uid,
            sellerName: buildSellerName(),
            views:     0,
            chatTaps:  0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        showToast('Listing published successfully!', 'success');
      }

      // Redirect to my-listings after brief delay
      setTimeout(() => {
        window.location.href = 'my-listings.html';
      }, 1200);

    } catch (err) {
      console.error('[AddListing] Save error:', err);
      showToast('Failed to save listing. Please try again.', 'error');
      setSubmitLoading(false);
      isSubmitting = false;
    }
  }

  // ── Build Firestore payload ────────────────────────────────
  function buildPayload() {
    const category     = getVal('listingCategory');
    const customCat    = getVal('customCategory').trim();
    const finalCategory = category === 'custom' ? customCat : category;

    const statusRadio = document.querySelector('input[name="listingStatus"]:checked');
    const status      = statusRadio ? statusRadio.value : 'active';

    const price = parseFloat(getVal('listingPrice'));

    // Only keep non-null images, filtered to a clean array
    const images = uploadedImages.filter(Boolean);

    return {
      title:          getVal('listingTitle').trim(),
      category:       finalCategory,
      price:          isNaN(price) ? 0 : price,
      condition:      getVal('listingCondition'),
      description:    getVal('listingDesc').trim(),
      negotiable:     document.getElementById('listingNegotiable')?.checked || false,
      whatsapp:       sanitizeWhatsapp(getVal('listingWhatsapp').trim()),
      location:       getVal('listingLocation').trim(),
      status:         status,
      images:         images,
      coverImage:     images[0] || null,
    };
  }

  // ── Validation ────────────────────────────────────────────
  function validateForm() {
    let valid = true;

    // At least one image uploaded (not still pending)
    const hasImage = uploadedImages.some(Boolean);
    const pendingUpload = isPendingUpload();

    if (pendingUpload) {
      showError('imagesError', 'Please wait for images to finish uploading.');
      valid = false;
    } else if (!hasImage) {
      showError('imagesError', 'Please add at least one image.');
      valid = false;
    }

    // Title
    const title = getVal('listingTitle').trim();
    if (!title) {
      showError('titleError', 'Please enter a listing title.');
      valid = false;
    } else if (title.length < 3) {
      showError('titleError', 'Title must be at least 3 characters.');
      valid = false;
    }

    // Category
    const category = getVal('listingCategory');
    if (!category) {
      showError('categoryError', 'Please select a category.');
      valid = false;
    }

    // Custom category
    if (category === 'custom') {
      const custom = getVal('customCategory').trim();
      if (!custom) {
        showError('customCategoryError', 'Please enter a custom category name.');
        valid = false;
      } else if (custom.length < 2) {
        showError('customCategoryError', 'Category name too short.');
        valid = false;
      }
    }

    // Price
    const priceRaw = getVal('listingPrice');
    const price    = parseFloat(priceRaw);
    if (priceRaw === '' || isNaN(price)) {
      showError('priceError', 'Please enter a price.');
      valid = false;
    } else if (price < 0) {
      showError('priceError', 'Price cannot be negative.');
      valid = false;
    }

    // Description
    const desc = getVal('listingDesc').trim();
    if (!desc) {
      showError('descError', 'Please write a description.');
      valid = false;
    } else if (desc.length < 10) {
      showError('descError', 'Description must be at least 10 characters.');
      valid = false;
    }

    // WhatsApp
    const wa = getVal('listingWhatsapp').trim();
    if (!wa) {
      showError('whatsappError', 'Please enter your WhatsApp number.');
      valid = false;
    } else if (!isValidPhone(wa)) {
      showError('whatsappError', 'Enter a valid phone number (e.g. 08012345678).');
      valid = false;
    }

    // Scroll to first error
    if (!valid) {
      const firstError = document.querySelector('.lf-error-msg.visible');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    return valid;
  }

  // Check if any slot is still uploading (has local blob but no URL)
  function isPendingUpload() {
    for (let i = 0; i < 4; i++) {
      const uploadingEl = document.getElementById(`imgUploading${i}`);
      if (uploadingEl && uploadingEl.style.display === 'flex') return true;
    }
    return false;
  }

  // ── Submit button loading state ────────────────────────────
  function setSubmitLoading(loading) {
    const btn      = document.getElementById('listingSubmitBtn');
    const btnText  = btn && btn.querySelector('.btn-text');
    const spinner  = btn && btn.querySelector('.auth-submit-spinner');

    if (!btn) return;
    btn.disabled = loading;

    if (btnText)  btnText.style.opacity  = loading ? '0' : '1';
    if (spinner)  spinner.style.display  = loading ? 'inline-block' : 'none';
  }

  // ── Helpers ───────────────────────────────────────────────
  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  function buildSellerName() {
    if (!currentData) return '';
    return currentData.storeName
      || [currentData.firstName, currentData.lastName].filter(Boolean).join(' ')
      || currentUser.email
      || '';
  }

  function sanitizeWhatsapp(number) {
    // Strip non-digits, then prefix with country code if needed
    let digits = number.replace(/\D/g, '');
    // Nigerian number starting with 0 → replace with 234
    if (digits.startsWith('0') && digits.length === 11) {
      digits = '234' + digits.slice(1);
    }
    return digits;
  }

  function isValidPhone(number) {
    const digits = number.replace(/\D/g, '');
    // Accept 10–14 digit numbers
    return digits.length >= 10 && digits.length <= 14;
  }

  // ── Error display helpers ──────────────────────────────────
  function showError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    // Keep the icon, append text
    const icon = el.querySelector('i');
    el.textContent = '';
    if (icon) el.appendChild(icon);
    el.appendChild(document.createTextNode(' ' + message));
    el.classList.add('visible');
  }

  function hideError(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('visible');
    const icon = el.querySelector('i');
    el.textContent = '';
    if (icon) el.appendChild(icon);
  }

  function clearAllErrors() {
    document.querySelectorAll('.lf-error-msg.visible').forEach(el => {
      el.classList.remove('visible');
      const icon = el.querySelector('i');
      el.textContent = '';
      if (icon) el.appendChild(icon);
    });
  }
window.addEventListener('seller:ready', ({ detail: { user, data } }) => {
  currentUser = user;
  currentData = data;
  init();
});

// Also handle case where seller:ready already fired before this script ran
if (window._sellerUser && window._sellerData) {
  currentUser = window._sellerUser;
  currentData = window._sellerData;
  init();
 }

  
})();
