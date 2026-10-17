import { h, esc, on, setBusy, toast, confirmDialog } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { store } from '../lib/store.js';
import { users } from '../api/users.js';
import { logout, resetPassword } from '../firebase.js';
import { uploadImage } from '../lib/upload.js';
import { topbar, adminSwitch, bindAdminSwitch } from '../components/bits.js';
import { avatar } from '../components/ui.js';
import { LEVELS } from '../config.js';
import { isValidPhone, splitName } from '../lib/format.js';
import { navigate, setTitle } from '../router.js';

export default function profilePage(root) {
  setTitle('Profile');
  let profile = store.get().profile;
  const { firstName, lastName } = splitName(profile.fullName);

  const input = (id, label, value = '', attrs = '') => `<div class="fld" data-field="${id}"><label for="${id}">${label}</label><input class="in" id="${id}" name="${id}" value="${esc(value)}" ${attrs}><span class="err" hidden></span></div>`;

  root.innerHTML = h`
    ${topbar({ title: 'Profile', sub: 'Shown to buyers', right: `<a class="gpill glass" href="/seller/${esc(profile.id)}">View public page</a>` })}
    <section class="pad">
      <div class="pf-banner" id="bannerBox" ${profile.bannerUrl ? `style="background-image:url('${esc(profile.bannerUrl)}')"` : ''}><label class="gpill glass">${icon('image', 15)}Change banner<input type="file" id="bannerInput" accept="image/*" hidden></label></div>
      <div class="pf-av"><div id="avatarBox">${avatar(profile, 92)}</div><label class="gpill glass">Change photo<input type="file" id="avatarInput" accept="image/*" hidden></label></div>
      <form class="card2 stack2" id="profileForm" novalidate>
        <div class="two">${input('firstName', 'First name', firstName, 'autocomplete="given-name"')}${input('lastName', 'Last name', lastName, 'autocomplete="family-name"')}</div>
        ${input('storeName', 'Store name', profile.storeName, 'maxlength="60"')}
        <div class="fld"><label for="bio">Bio <small id="bioCount">${(profile.bio || '').length}/160</small></label><textarea class="in ta" id="bio" name="bio" maxlength="160">${esc(profile.bio)}</textarea></div>
        ${input('whatsapp', 'WhatsApp number', profile.whatsapp, 'type="tel" inputmode="tel" placeholder="08012345678"')}
        ${input('instagram', 'Instagram username', profile.instagram, 'placeholder="@yourstore"')}
        <div class="two">${input('department', 'Department', profile.department, 'maxlength="60"')}<div class="fld"><label for="level">Level</label><select class="in" id="level" name="level"><option value="">Select</option>${LEVELS.map(l => `<option value="${l}" ${profile.level === l ? 'selected' : ''}>${l} level</option>`)}</select></div></div>
        <div class="fld"><label for="email">Email</label><input class="in" id="email" value="${esc(profile.email)}" disabled></div>
        <div class="two"><button class="bt bt-ghost" type="button" id="resetBtn">${icon('lock', 17)}Reset password</button><button class="bt bt-primary" type="submit">Save changes</button></div>
      </form>
      ${profile.role === 'admin' ? `<div class="card2 adm-card"><div><b>Admin mode</b><small>Switch between the admin panel and the normal site.</small></div>${adminSwitch(profile)}</div>` : ''}
      <button class="signout" id="signOut">${icon('logout', 18)}Sign out</button>
    </section>`;

  const form = root.querySelector('#profileForm');
  const showError = (name, message) => {
    const wrap = form.querySelector(`[data-field="${name}"]`);
    wrap.classList.add('bad');
    const el = wrap.querySelector('.err');
    el.textContent = message;
    el.hidden = false;
    return false;
  };
  form.bio.addEventListener('input', () => (root.querySelector('#bioCount').textContent = `${form.bio.value.length}/160`));

  async function upload(file, kind) {
    if (!file) return;
    const box = root.querySelector(kind === 'avatar' ? '#avatarBox' : '#bannerBox');
    box.classList.add('uploading');
    try {
      const url = await uploadImage(file, { folder: kind === 'avatar' ? 'avatars' : 'banners' });
      profile = await users.update(kind === 'avatar' ? { avatarUrl: url } : { bannerUrl: url });
      store.set({ profile });
      if (kind === 'avatar') box.innerHTML = avatar(profile, 92);
      else box.style.backgroundImage = `url('${url}')`;
      toast('Photo updated', 'success');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      box.classList.remove('uploading');
    }
  }
  root.querySelector('#avatarInput').addEventListener('change', e => upload(e.target.files[0], 'avatar'));
  root.querySelector('#bannerInput').addEventListener('change', e => upload(e.target.files[0], 'banner'));

  bindAdminSwitch(root);
  on(root, 'click', '#resetBtn', async (event, button) => {
    setBusy(button, true, 'Sending');
    try {
      await resetPassword(profile.email);
      toast('Reset link sent to your email', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
    setBusy(button, false);
  });

  on(root, 'click', '#signOut', async () => {
    if (!(await confirmDialog({ title: 'Sign out?', message: 'You can log back in any time.', confirmText: 'Sign out' }))) return;
    await logout();
    navigate('/');
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    form.querySelectorAll('.bad').forEach(el => el.classList.remove('bad'));
    form.querySelectorAll('.err').forEach(el => (el.hidden = true));
    const data = Object.fromEntries(new FormData(form));
    let valid = true;
    if (!data.firstName.trim()) valid = showError('firstName', 'Enter your first name.');
    if (!data.lastName.trim()) valid = showError('lastName', 'Enter your last name.');
    if (data.whatsapp.trim() && !isValidPhone(data.whatsapp)) valid = showError('whatsapp', 'Enter a valid Nigerian number.');
    if (!valid) return;
    const button = form.querySelector('button[type="submit"]');
    setBusy(button, true, 'Saving');
    try {
      profile = await users.update({
        fullName: `${data.firstName.trim()} ${data.lastName.trim()}`,
        storeName: data.storeName.trim(),
        bio: data.bio.trim(),
        whatsapp: data.whatsapp.trim(),
        instagram: data.instagram.trim().replace(/^@/, ''),
        department: data.department.trim(),
        level: data.level
      });
      store.set({ profile });
      toast('Profile saved', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
    setBusy(button, false);
  });
}
