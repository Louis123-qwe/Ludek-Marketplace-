import { h, esc, setBusy, toast } from '../../lib/dom.js';
import { store } from '../../lib/store.js';
import { admin } from '../../api/admin.js';
import { isValidPhone } from '../../lib/format.js';
import { adminHead } from './ui.js';

const TOGGLES = [
  ['showLiveProducts', 'Live strip: products', 'Newest listings scroll across the strip on the home screen.'],
  ['showRecentSales', 'Live strip: recent sales', 'Sold items appear with a blinking time.'],
  ['showAdminMessages', 'Live strip: admin messages', 'Messages you add on the Ticker page.'],
  ['showAds', 'Show ads on home', 'The sponsored banner slider on the home screen.'],
  ['requireApproval', 'Review new listings', 'New listings stay pending until you approve them.'],
  ['allowSignups', 'Allow new sign-ups', 'Turn off to pause new accounts.'],
  ['maintenance', 'Maintenance mode', 'Visitors see a maintenance page. Admins can still log in.']
];

export default async function settings(root) {
  const current = await admin.settings.get();

  root.innerHTML = h`
    ${adminHead('Settings', 'Platform-wide controls.')}
    <form class="card form-card stack" id="form" novalidate>
      ${TOGGLES.map(([key, label, hint]) => `
        <label class="switch-row switch-block">
          <input type="checkbox" name="${key}" ${current[key] ? 'checked' : ''}>
          <span class="switch"></span>
          <span><b>${label}</b><small>${hint}</small></span>
        </label>`)}
      <div class="grid-2">
        <div class="field"><label for="supportEmail">Support email</label><input class="input" id="supportEmail" name="supportEmail" type="email" value="${esc(current.supportEmail)}"></div>
        <div class="field"><label for="supportWhatsapp">Support WhatsApp</label><input class="input" id="supportWhatsapp" name="supportWhatsapp" type="tel" value="${esc(current.supportWhatsapp)}" placeholder="08012345678"></div>
      </div>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Save settings</button></div>
    </form>`;

  const form = root.querySelector('#form');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const whatsapp = form.supportWhatsapp.value.trim();
    if (whatsapp && !isValidPhone(whatsapp)) return toast('Enter a valid Nigerian WhatsApp number.', 'error');

    const body = {
      ...Object.fromEntries(TOGGLES.map(([key]) => [key, form.elements[key].checked])),
      supportEmail: form.supportEmail.value.trim(),
      supportWhatsapp: whatsapp
    };

    const button = form.querySelector('button[type="submit"]');
    setBusy(button, true, 'Saving');
    try {
      const saved = await admin.settings.save(body);
      store.set({ settings: { ...store.get().settings, ...(saved || body) } });
      toast('Settings saved', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
    setBusy(button, false);
  });
}
