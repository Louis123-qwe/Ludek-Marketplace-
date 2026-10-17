import { h, esc, on, setBusy, toast, confirmDialog } from '../../lib/dom.js';
import { icon } from '../../lib/icons.js';
import { admin } from '../../api/admin.js';
import { uploadImage } from '../../lib/upload.js';
import { AD_COLOURS, adCard, adColours } from '../../components/ads.js';
import { errorState, spinner } from '../../components/ui.js';
import { adminHead } from './ui.js';

const blank = () => ({ tag: 'Sponsored', title: '', body: '', buttonText: 'Learn more', link: '', bg: 'forest', imageUrl: '', layout: 'side' });

export default function ads(root) {
  let items = [];
  let draft = blank();
  let uploading = false;

  root.innerHTML = h`
    ${adminHead('Ads', 'Banners that slide across the home screen.')}
    <div class="card form-card">
      <p class="adprev-label">Live preview</p>
      <div class="ads-view adprev"><div class="ads-track" id="preview"></div></div>
    </div>
    <form class="card form-card ticker-form" id="addForm" novalidate>
      <div class="field"><label for="aTitle">Headline</label><input class="input" id="aTitle" name="title" maxlength="80" placeholder="Your ad here. Reach every student."></div>
      <div class="field"><label for="aBody">Short text</label><input class="input" id="aBody" name="body" maxlength="160" placeholder="Promote your shop or service on campus."></div>
      <div class="two-col">
        <div class="field"><label for="aBtn">Button text</label><input class="input" id="aBtn" name="buttonText" maxlength="24" placeholder="Learn more"></div>
        <div class="field"><label for="aTag">Label</label><input class="input" id="aTag" name="tag" maxlength="20" value="Sponsored"></div>
      </div>
      <div class="field"><label for="aLink">Link (optional)</label><input class="input" id="aLink" name="link" placeholder="https://..."></div>

      <div class="field">
        <label>Picture (optional)</label>
        <div class="adup" id="adup">
          <label class="adup-drop" for="aFile" id="dropLabel">${icon('plus', 20)}<span id="dropText">Upload a picture</span></label>
          <input id="aFile" type="file" accept="image/*" hidden>
          <div class="adup-have" id="have" hidden>
            <img id="haveImg" alt="">
            <button class="btn btn-ghost btn-sm" type="button" id="clearImg">${icon('trash', 16)}Remove picture</button>
          </div>
        </div>
      </div>
      <div class="field" id="layoutField" hidden>
        <label for="aLayout">Picture style</label>
        <select class="select" id="aLayout" name="layout">
          <option value="side">Picture beside the text</option>
          <option value="full">Picture as the background</option>
        </select>
      </div>

      <div class="field">
        <label>Colour</label>
        <div class="swatches" id="swatches" role="radiogroup" aria-label="Ad colour">
          ${AD_COLOURS.map(([value, label, bg]) => `<button class="swatch" type="button" role="radio" data-bg="${value}" aria-label="${label}" title="${label}" style="--sw:${bg}"></button>`)}
          <label class="swatch swatch-custom" title="Pick your own colour" aria-label="Custom colour"><input type="color" id="aCustom" value="#2d5016"><span>Custom</span></label>
        </div>
      </div>
      <button class="btn btn-primary" type="submit">${icon('plus', 18)}Add ad</button>
    </form>
    <div class="card" id="list"><div class="center pad">${spinner()}</div></div>`;

  const list = root.querySelector('#list');
  const form = root.querySelector('#addForm');
  const preview = root.querySelector('#preview');
  const have = root.querySelector('#have');
  const dropLabel = root.querySelector('#dropLabel');
  const dropText = root.querySelector('#dropText');
  const layoutField = root.querySelector('#layoutField');

  function drawPreview() {
    preview.innerHTML = adCard({
      ...draft,
      title: draft.title || 'Your headline goes here',
      body: draft.body || 'A short line about what you are promoting.',
      buttonText: draft.buttonText || 'Learn more',
      link: ''
    });
    preview.querySelector('.ad').style.width = '100%';
  }

  function drawControls() {
    root.querySelectorAll('.swatch[data-bg]').forEach(button => {
      const active = button.dataset.bg === draft.bg;
      button.classList.toggle('on', active);
      button.setAttribute('aria-checked', String(active));
    });
    const custom = root.querySelector('.swatch-custom');
    const isCustom = draft.bg.startsWith('#');
    custom.classList.toggle('on', isCustom);
    if (isCustom) root.querySelector('#aCustom').value = draft.bg;
    const hasImage = Boolean(draft.imageUrl);
    have.hidden = !hasImage;
    dropLabel.hidden = hasImage;
    layoutField.hidden = !hasImage;
    if (hasImage) root.querySelector('#haveImg').src = draft.imageUrl;
    root.querySelector('#aLayout').value = draft.layout;
    dropText.textContent = uploading ? 'Uploading...' : 'Upload a picture';
  }

  const refresh = () => {
    drawControls();
    drawPreview();
  };

  function draw() {
    list.innerHTML = items.length
      ? `<ul class="rows">${items.map(item => {
          const [bg] = adColours(item.bg);
          return `
          <li class="row-flat" data-id="${esc(item.id)}">
            <span class="adrow-sw" style="background:${esc(bg)}">${item.imageUrl ? `<img src="${esc(item.imageUrl)}" alt="">` : ''}</span>
            <span class="row-main"><b>${esc(item.title)}</b><small>${esc(item.buttonText)}${item.link ? `, ${esc(item.link)}` : ''}</small></span>
            <label class="switch-row switch-compact"><input type="checkbox" data-toggle ${item.active ? 'checked' : ''}><span class="switch"></span><span>${item.active ? 'Showing' : 'Hidden'}</span></label>
            <button class="btn-icon danger" data-delete aria-label="Delete">${icon('trash', 18)}</button>
          </li>`;
        }).join('')}</ul>`
      : '<div class="empty-inline">No ads yet. Add one above.</div>';
  }

  async function load() {
    try {
      items = await admin.ads.list();
      draw();
    } catch (error) {
      list.innerHTML = errorState(error.message);
    }
  }

  form.addEventListener('input', event => {
    const field = event.target;
    if (field.name && field.name in draft && field.type !== 'file') {
      draft[field.name] = field.value;
      drawPreview();
    }
  });

  on(root, 'click', '.swatch[data-bg]', (event, button) => {
    draft.bg = button.dataset.bg;
    refresh();
  });

  root.querySelector('#aCustom').addEventListener('input', event => {
    draft.bg = event.target.value;
    refresh();
  });

  root.querySelector('#aFile').addEventListener('change', async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('Choose an image file.', 'error');
    uploading = true;
    drawControls();
    try {
      draft.imageUrl = await uploadImage(file, {
        folder: 'ads',
        onProgress: fraction => {
          dropText.textContent = `Uploading ${Math.round(fraction * 100)}%`;
        }
      });
      toast('Picture added', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
    uploading = false;
    refresh();
  });

  root.querySelector('#clearImg').addEventListener('click', () => {
    draft.imageUrl = '';
    refresh();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) return toast('Enter a headline.', 'error');
    if (uploading) return toast('Wait for the picture to finish uploading.', 'error');
    const button = form.querySelector('button[type="submit"]');
    setBusy(button, true, 'Adding');
    try {
      await admin.ads.create({
        tag: draft.tag.trim() || 'Sponsored',
        title,
        body: draft.body.trim(),
        buttonText: draft.buttonText.trim() || 'Learn more',
        link: draft.link.trim(),
        bg: draft.bg,
        imageUrl: draft.imageUrl,
        layout: draft.layout,
        active: true
      });
      form.reset();
      draft = blank();
      refresh();
      toast('Ad added', 'success');
      load();
    } catch (error) {
      toast(error.message, 'error');
    }
    setBusy(button, false);
  });

  on(root, 'click', '[data-retry]', load);
  on(root, 'change', '[data-toggle]', async (event, input) => {
    const id = input.closest('[data-id]').dataset.id;
    try {
      await admin.ads.update(id, { active: input.checked });
      load();
    } catch (error) {
      toast(error.message, 'error');
      input.checked = !input.checked;
    }
  });
  on(root, 'click', '[data-delete]', async (event, button) => {
    const id = button.closest('[data-id]').dataset.id;
    if (!(await confirmDialog({ title: 'Delete this ad?', message: 'It will leave the home slider.', confirmText: 'Delete', danger: true }))) return;
    try {
      await admin.ads.remove(id);
      toast('Ad deleted', 'success');
      load();
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  refresh();
  load();
}
