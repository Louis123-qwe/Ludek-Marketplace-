import { h, esc, on, setBusy, toast } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { store } from '../lib/store.js';
import { listings } from '../api/listings.js';
import { categories } from '../lib/categories.js';
import { uploadImage } from '../lib/upload.js';
import { thumb } from '../components/listing-card.js';
import { topbar, bindBack } from '../components/bits.js';
import { errorState } from '../components/ui.js';
import { CONDITIONS, MAX_IMAGES } from '../config.js';
import { isValidPhone, slugify } from '../lib/format.js';
import { navigate, setTitle } from '../router.js';

export default async function addListing(root, ctx) {
  const editId = ctx.params.id;
  const profile = store.get().profile;
  const requireApproval = Boolean(store.get().settings?.requireApproval);
  let existing = null;

  if (editId) {
    try {
      existing = await listings.get(editId);
    } catch (error) {
      root.innerHTML = errorState(error.message, false);
      return;
    }
    if (existing.sellerId !== profile.id && profile.role !== 'admin') {
      navigate('/my-listings', { replace: true });
      return;
    }
  }

  setTitle(editId ? 'Edit listing' : 'New listing');
  const known = categories().some(cat => cat.slug === existing?.category);
  const state = { images: (existing?.images || []).map(url => ({ id: crypto.randomUUID(), url })), uploading: 0, condition: existing?.condition || 'used-good', negotiable: Boolean(existing?.negotiable) };

  const fld = (id, label, control, hint = '') => `<div class="fld" data-field="${id}"><label for="${id}">${label}${hint}</label>${control}<span class="err" hidden></span></div>`;

  root.innerHTML = h`
    ${topbar({ title: editId ? 'Edit listing' : 'New listing', sub: 'Clear photos sell faster', back: true })}
    <form class="pad stack2 af" id="form" novalidate>
      <section class="card2">
        <div class="lbl-r"><b>Photos</b><small id="photoCount"></small></div>
        <div class="up-grid" id="uploader"></div>
        <span class="err" id="imagesError" hidden></span>
        <p class="hint-b">The first photo is your cover. Tap the star on any photo to make it the cover.</p>
      </section>
      <section class="card2 stack2">
        ${fld('title', 'Title', `<input class="in" id="title" name="title" maxlength="80" value="${esc(existing?.title)}" placeholder="e.g. iPhone 11, 128GB, clean">`, '<small id="titleCount"></small>')}
        ${fld('category', 'Category', `<select class="in" id="category" name="category"><option value="">Select a category</option>${categories().map(c => `<option value="${esc(c.slug)}" ${existing?.category === c.slug ? 'selected' : ''}>${esc(c.name)}</option>`)}<option value="custom" ${existing && !known ? 'selected' : ''}>Other</option></select>`)}
        <div id="customWrap" ${existing && !known ? '' : 'hidden'}>${fld('customCategory', 'Category name', `<input class="in" id="customCategory" name="customCategory" maxlength="30" value="${esc(existing && !known ? existing.category.replace(/-/g, ' ') : '')}">`)}</div>
        <div class="fld"><label>Condition</label><div class="chipset" id="cond">${CONDITIONS.map(c => `<button type="button" class="pill ${state.condition === c.value ? 'on' : ''}" data-cond="${c.value}">${esc(c.label)}</button>`)}</div></div>
        ${fld('price', 'Price', `<div class="in-wrap pre"><span>₦</span><input class="in" id="price" name="price" type="number" min="0" inputmode="numeric" value="${esc(existing?.price ?? '')}" placeholder="0"></div>`)}
        <label class="sw-row"><span><b>Price is negotiable</b><small>Buyers can make an offer</small></span><input type="checkbox" id="negotiable" ${state.negotiable ? 'checked' : ''}><i class="sw"></i></label>
        ${fld('description', 'Description', `<textarea class="in ta" id="description" name="description" maxlength="1500" placeholder="Describe the item, its condition and anything the buyer should know">${esc(existing?.description)}</textarea>`, '<small id="descCount"></small>')}
      </section>
      <section class="card2 stack2">
        ${fld('location', 'Pickup location', `<input class="in" id="location" name="location" maxlength="60" value="${esc(existing?.location)}" placeholder="e.g. Behind the faculty building">`)}
        ${fld('whatsapp', 'WhatsApp number', `<input class="in" id="whatsapp" name="whatsapp" type="tel" inputmode="tel" value="${esc(existing?.whatsapp || profile.whatsapp)}" placeholder="08012345678">`)}
        <p class="hint-b flat">Buyers message you here.</p>
      </section>
      ${requireApproval && !editId ? `<p class="note-g">${icon('info', 20)}New listings are reviewed before they go live. You will get a notification when it is approved.</p>` : ''}
    </form>
    <div class="actbar glass"><button class="bt bt-ghost" type="button" data-submit="draft">Save draft</button><button class="bt bt-primary" type="button" data-submit="active">${editId ? 'Save and publish' : 'Publish listing'}</button></div>`;

  bindBack(root);
  const form = root.querySelector('#form');
  const uploader = root.querySelector('#uploader');

  const counters = () => {
    root.querySelector('#photoCount').textContent = `${state.images.length} of ${MAX_IMAGES}`;
    root.querySelector('#titleCount').textContent = ` ${form.elements.title.value.length} of 80`;
    root.querySelector('#descCount').textContent = ` ${form.elements.description.value.length} of 1500`;
  };

  function drawImages() {
    const tiles = state.images.map((image, i) => `
      <div class="tile ${image.loading ? 'loading' : ''}" data-id="${image.id}">
        ${image.url ? `<img src="${esc(thumb(image.url, 240))}" alt="">` : ''}
        ${image.loading ? `<div class="tile-bar"><i style="width:${Math.round((image.progress || 0) * 100)}%"></i></div>` : ''}
        ${i === 0 && image.url ? '<span class="tag-g">Cover</span>' : ''}
        <div class="tile-act">${i > 0 && image.url ? `<button type="button" data-cover aria-label="Make cover">${icon('star', 14)}</button>` : ''}<button type="button" data-remove aria-label="Remove photo">${icon('x', 14)}</button></div>
      </div>`);
    uploader.innerHTML = tiles.join('') + (state.images.length >= MAX_IMAGES ? '' : `<label class="tile tile-add">${icon('plus', 24)}<span>Add photo</span><input type="file" id="files" accept="image/*" multiple hidden></label>`);
    counters();
  }

  on(uploader, 'click', '[data-remove]', (e, b) => { state.images = state.images.filter(i => i.id !== b.closest('.tile').dataset.id); drawImages(); });
  on(uploader, 'click', '[data-cover]', (e, b) => {
    const picked = state.images.find(i => i.id === b.closest('.tile').dataset.id);
    state.images = [picked, ...state.images.filter(i => i !== picked)];
    drawImages();
  });

  uploader.addEventListener('change', async event => {
    if (event.target.id !== 'files') return;
    const files = [...event.target.files].slice(0, MAX_IMAGES - state.images.length);
    event.target.value = '';
    for (const file of files) {
      const entry = { id: crypto.randomUUID(), url: '', loading: true, progress: 0 };
      state.images.push(entry);
      state.uploading++;
      drawImages();
      try {
        entry.url = await uploadImage(file, {
          folder: 'listings',
          onProgress: value => {
            entry.progress = value;
            const bar = uploader.querySelector(`[data-id="${entry.id}"] .tile-bar i`);
            if (bar) bar.style.width = `${Math.round(value * 100)}%`;
          }
        });
        entry.loading = false;
      } catch (error) {
        state.images = state.images.filter(i => i.id !== entry.id);
        toast(error.message, 'error');
      }
      state.uploading--;
      drawImages();
    }
  });

  on(root, 'click', '[data-cond]', (e, chip) => {
    state.condition = chip.dataset.cond;
    root.querySelectorAll('[data-cond]').forEach(c => c.classList.toggle('on', c === chip));
  });
  form.addEventListener('input', counters);
  form.elements.category.addEventListener('change', () => (root.querySelector('#customWrap').hidden = form.elements.category.value !== 'custom'));

  const showError = (name, message) => {
    if (name === 'images') {
      const el = root.querySelector('#imagesError');
      el.textContent = message;
      el.hidden = false;
      return false;
    }
    const wrap = form.querySelector(`[data-field="${name}"]`);
    wrap.classList.add('bad');
    const el = wrap.querySelector('.err');
    el.textContent = message;
    el.hidden = false;
    return false;
  };

  function validate(status) {
    form.querySelectorAll('.bad').forEach(el => el.classList.remove('bad'));
    form.querySelectorAll('.err').forEach(el => (el.hidden = true));
    root.querySelector('#imagesError').hidden = true;
    const v = name => form.elements[name].value.trim();
    let ok = true;
    if (state.uploading) {
      toast('Wait for your photos to finish uploading.', 'error');
      return false;
    }
    if (v('title').length < 4) ok = showError('title', 'Add a title of at least 4 characters.');
    if (!form.elements.category.value) ok = showError('category', 'Choose a category.');
    if (form.elements.category.value === 'custom' && !v('customCategory')) ok = showError('customCategory', 'Enter a category name.');
    if (v('price') === '' || Number(v('price')) < 0) ok = showError('price', 'Enter a price.');
    if (status === 'active') {
      if (v('description').length < 10) ok = showError('description', 'Add a description of at least 10 characters.');
      if (!state.images.length) ok = showError('images', 'Add at least one photo.');
      if (!isValidPhone(v('whatsapp'))) ok = showError('whatsapp', 'Enter a valid Nigerian WhatsApp number.');
    } else if (v('whatsapp') && !isValidPhone(v('whatsapp'))) ok = showError('whatsapp', 'Enter a valid Nigerian WhatsApp number.');
    return ok;
  }

  on(root, 'click', '[data-submit]', async (event, button) => {
    const status = button.dataset.submit;
    if (!validate(status)) {
      root.querySelector('.bad, #imagesError:not([hidden])')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const e = form.elements;
    const body = {
      title: e.title.value.trim(),
      category: e.category.value === 'custom' ? slugify(e.customCategory.value) : e.category.value,
      condition: state.condition,
      price: Number(e.price.value),
      negotiable: root.querySelector('#negotiable').checked,
      description: e.description.value.trim(),
      location: e.location.value.trim(),
      whatsapp: e.whatsapp.value.trim(),
      images: state.images.map(i => i.url),
      status
    };
    setBusy(button, true, status === 'draft' ? 'Saving' : 'Publishing');
    try {
      const saved = editId ? await listings.update(editId, body) : await listings.create(body);
      toast(status === 'draft' ? 'Draft saved' : saved.status === 'pending' ? 'Submitted. We will review it shortly.' : editId ? 'Listing updated' : 'Your listing is live', 'success');
      navigate('/my-listings');
    } catch (error) {
      toast(error.message, 'error');
      setBusy(button, false);
    }
  });

  drawImages();
}
