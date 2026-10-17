import { h, esc, on, openModal, setBusy, toast, confirmDialog } from '../../lib/dom.js';
import { icon, iconNames } from '../../lib/icons.js';
import { admin } from '../../api/admin.js';
import { misc } from '../../api/misc.js';
import { store } from '../../lib/store.js';
import { slugify } from '../../lib/format.js';
import { uploadImage } from '../../lib/upload.js';
import { thumb } from '../../components/listing-card.js';
import { DEFAULT_CATEGORIES } from '../../config.js';
import { adminHead, table } from './ui.js';

export default async function categoriesSection(root) {
  let items = [];

  async function load() {
    const data = await misc.categories();
    items = data?.length ? data : DEFAULT_CATEGORIES;
    store.set({ categories: items });
    draw();
  }

  function draw() {
    root.innerHTML = h`
      ${adminHead('Categories', 'Control what buyers and sellers can pick from.', `<button class="btn btn-primary" data-add>${icon('plus', 18)}Add category</button>`)}
      <div class="card">
        ${table(
          [
            { label: 'Category', render: cat => `<div class="cell-user"><span class="thumb">${cat.imageUrl ? `<img src="${esc(thumb(cat.imageUrl, 100))}" alt="">` : icon(cat.icon || 'tag', 20)}</span><div><b>${esc(cat.name)}</b><small>${esc(cat.slug)}</small></div></div>` },
            { label: 'Order', render: cat => cat.order ?? '-' },
            {
              label: '',
              cls: 'cell-actions',
              render: cat => cat.id
                ? `<button class="btn btn-ghost btn-sm" data-act="edit">Edit</button><button class="btn-icon danger" data-act="delete" aria-label="Delete">${icon('trash', 18)}</button>`
                : '<span class="muted">Default</span>'
            }
          ],
          items.map(cat => ({ ...cat, id: cat.id || cat.slug })),
          'No categories yet.'
        )}
      </div>`;
  }

  function openForm(category) {
    const editing = Boolean(category);
    let imageUrl = category?.imageUrl || '';
    const modal = openModal({
      title: editing ? 'Edit category' : 'Add category',
      body: h`
        <div class="stack">
          <div class="field"><label for="cName">Name</label><input class="input" id="cName" maxlength="30" value="${esc(category?.name)}"></div>
          <div class="field"><label for="cOrder">Order</label><input class="input" id="cOrder" type="number" min="0" value="${esc(category?.order ?? items.length + 1)}"></div>
          <div class="field"><label>Cover photo</label><div class="cover-prev" id="cPrev">${imageUrl ? `<img src="${esc(thumb(imageUrl, 240))}" alt="">` : 'No photo yet'}</div><input class="input" id="cFile" type="file" accept="image/*"></div>
          <div>
            <p class="label">Icon</p>
            <div class="icon-pick" id="cIcons">
              ${iconNames.map(name => `<button type="button" class="${(category?.icon || 'tag') === name ? 'active' : ''}" data-icon="${name}" aria-label="${name}">${icon(name, 20)}</button>`)}
            </div>
          </div>
        </div>`,
      actions: [
        { label: 'Cancel', kind: 'ghost', onClick: () => modal.close() },
        {
          label: editing ? 'Save changes' : 'Add category',
          kind: 'primary',
          onClick: async (event, button) => {
            const name = modal.body.querySelector('#cName').value.trim();
            if (!name) return toast('Enter a category name.', 'error');
            const body = {
              name,
              slug: category?.slug || slugify(name),
              order: Number(modal.body.querySelector('#cOrder').value) || 0,
              icon: modal.body.querySelector('#cIcons .active')?.dataset.icon || 'tag',
              imageUrl
            };
            setBusy(button, true, 'Saving');
            try {
              await (editing ? admin.categories.update(category.id, body) : admin.categories.create(body));
              toast('Category saved', 'success');
              modal.close();
              load();
            } catch (error) {
              toast(error.message, 'error');
              setBusy(button, false);
            }
          }
        }
      ]
    });
    modal.body.querySelector('#cFile').addEventListener('change', async event => {
      const file = event.target.files[0];
      if (!file) return;
      const prev = modal.body.querySelector('#cPrev');
      prev.textContent = 'Uploading...';
      try {
        imageUrl = await uploadImage(file, { folder: 'categories' });
        prev.innerHTML = `<img src="${esc(thumb(imageUrl, 240))}" alt="">`;
      } catch (error) {
        prev.textContent = 'No photo yet';
        toast(error.message, 'error');
      }
    });
    on(modal.body, 'click', '[data-icon]', (event, el) => {
      modal.body.querySelectorAll('#cIcons button').forEach(b => b.classList.toggle('active', b === el));
    });
  }

  on(root, 'click', '[data-add]', () => openForm(null));

  on(root, 'click', '[data-act]', async (event, button) => {
    const id = button.closest('tr').dataset.id;
    const category = items.find(cat => (cat.id || cat.slug) === id);
    if (button.dataset.act === 'edit') return openForm(category);
    const ok = await confirmDialog({
      title: 'Delete this category?',
      message: `Listings already using "${category.name}" keep their category, but sellers can no longer pick it.`,
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return;
    try {
      await admin.categories.remove(category.id);
      toast('Category deleted', 'success');
      load();
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  await load();
}
