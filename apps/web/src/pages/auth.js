import { h, esc, on, setBusy, toast } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { store } from '../lib/store.js';
import { signIn, signUp, resetPassword } from '../firebase.js';
import { isValidPhone } from '../lib/format.js';
import { logoMark, wordmark } from '../components/brand.js';
import { navigate, setTitle } from '../router.js';
import { adminMode } from '../components/bits.js';

const AUTH_ERRORS = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/user-not-found': 'No account uses that email.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'An account with this email already exists. Log in instead.',
  'auth/weak-password': 'Choose a stronger password.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.'
};

const authMessage = error => AUTH_ERRORS[error.code] || error.message || 'Could not sign you in. Try again.';

const RULES = [
  ['8 or more characters', value => value.length >= 8],
  ['A lowercase letter', value => /[a-z]/.test(value)],
  ['An uppercase letter', value => /[A-Z]/.test(value)],
  ['A special sign, like ! @ # $', value => /[^A-Za-z0-9]/.test(value)]
];

const LEVELS = ['Weak', 'Weak', 'Fair', 'Good', 'Strong'];
const defaultRoute = profile => (profile.role === 'admin' && adminMode.get() ? '/admin' : profile.role === 'seller' ? '/dashboard' : '/');

export default function auth(root, ctx) {
  setTitle('Log in');
  let mode = ctx.query.get('mode') === 'signup' ? 'signup' : ctx.query.get('mode') === 'reset' ? 'reset' : 'login';
  let role = ctx.query.get('role') === 'seller' ? 'seller' : 'customer';
  const next = ctx.query.get('next');

  const field = (id, label, attrs = '', trailing = '') => `
    <div class="fld" data-field="${id}">
      <label for="${id}">${label}</label>
      <div class="in-wrap"><input class="in" id="${id}" name="${id}" ${attrs}>${trailing}</div>
      <span class="err" hidden></span>
    </div>`;

  const eye = '<button type="button" class="eye" data-eye aria-label="Show or hide password">' + icon('eye', 20) + '</button>';

  function formMarkup() {
    if (mode === 'reset') {
      return h`
        <form id="authForm" class="stack2" novalidate>
          ${field('email', 'Email', 'type="email" autocomplete="email" inputmode="email" placeholder="you@email.com"')}
          <button class="bt bt-primary" type="submit">Send reset link</button>
        </form>`;
    }
    const signup = mode === 'signup';
    return h`
      <form id="authForm" class="stack2" novalidate>
        ${signup ? h`
          <div class="au-tog" role="radiogroup" aria-label="Account type">
            <button type="button" class="${role === 'customer' ? 'on' : ''}" data-role="customer">Customer</button>
            <button type="button" class="${role === 'seller' ? 'on' : ''}" data-role="seller">Vendor</button>
          </div>
          ${field('fullName', 'Full name', 'autocomplete="name" placeholder="Titi Ekemini"')}` : ''}
        ${field('email', 'Email', 'type="email" autocomplete="email" inputmode="email" placeholder="you@email.com"')}
        ${signup && role === 'seller' ? field('whatsapp', 'WhatsApp number', 'type="tel" inputmode="tel" autocomplete="tel" placeholder="08012345678"') : ''}
        ${field('password', 'Password', `type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="Enter your password"`, eye)}
        ${signup ? h`
          <div class="meter" id="meter"><i></i><i></i><i></i><i></i></div>
          <p class="meter-l" id="meterL">Password strength</p>
          <ul class="rules" id="rules">${RULES.map(([label]) => `<li><i></i>${label}</li>`)}</ul>` : '<a class="lnk lnk-r" href="/auth?mode=reset" data-mode="reset">Forgot password?</a>'}
        <button class="bt bt-primary" type="submit">${signup ? (role === 'seller' ? 'Create vendor account' : 'Create account') : 'Log in'}</button>
      </form>`;
  }

  const titles = {
    login: ['Welcome back', 'Log in to continue to Ludek Market.'],
    signup: ['Create your account', 'Sign up as a customer or a vendor.'],
    reset: ['Forgot password?', 'Enter your email and we will send you a reset link.']
  };

  const foot = {
    login: ['New here?', 'Sign up', 'signup'],
    signup: ['Already have an account?', 'Log in', 'login'],
    reset: ['Remembered it?', 'Back to log in', 'login']
  };

  function draw() {
    const [title, text] = titles[mode];
    const [question, label, target] = foot[mode];
    root.querySelector('#auBody').innerHTML = h`
      <h1>${title}</h1>
      <p class="au-sub">${text}</p>
      <div class="au-card glass">${formMarkup()}</div>
      <p class="au-foot">${question} <button type="button" class="lnk" data-mode="${target}">${label}</button></p>`;
    root.querySelector('#auBody input')?.focus({ preventScroll: true });
  }

  root.innerHTML = h`
    <div class="au">
      <span class="au-c au-c1"></span><span class="au-c au-c2"></span>
      <a class="brandlock" href="/">${logoMark(54)}${wordmark(24)}</a>
      <div id="auBody"></div>
    </div>`;
  draw();

  const showError = (name, message) => {
    const wrap = root.querySelector(`[data-field="${name}"]`);
    if (!wrap) return false;
    wrap.classList.add('bad');
    const el = wrap.querySelector('.err');
    el.textContent = message;
    el.hidden = false;
    return false;
  };
  const clearErrors = () => {
    root.querySelectorAll('.bad').forEach(el => el.classList.remove('bad'));
    root.querySelectorAll('.err').forEach(el => (el.hidden = true));
  };
  const value = name => root.querySelector(`#${name}`)?.value.trim() || '';

  on(root, 'click', '[data-mode]', (event, el) => {
    event.preventDefault();
    mode = el.dataset.mode;
    draw();
  });

  on(root, 'click', '[data-role]', (event, el) => {
    role = el.dataset.role;
    draw();
  });

  on(root, 'click', '[data-eye]', (event, button) => {
    const input = root.querySelector('#password');
    input.type = input.type === 'password' ? 'text' : 'password';
    button.classList.toggle('on', input.type === 'text');
  });

  root.addEventListener('input', event => {
    if (event.target.id !== 'password' || mode !== 'signup') return;
    const passed = RULES.map(([, test]) => test(event.target.value));
    const score = passed.filter(Boolean).length;
    root.querySelectorAll('#meter i').forEach((bar, i) => bar.classList.toggle('on', i < score));
    root.querySelector('#meterL').textContent = event.target.value ? `Password strength: ${LEVELS[score]}` : 'Password strength';
    root.querySelectorAll('#rules li').forEach((li, i) => li.classList.toggle('ok', passed[i]));
  });

  root.addEventListener('submit', async event => {
    event.preventDefault();
    clearErrors();
    const button = event.target.querySelector('button[type="submit"]');
    const email = value('email');
    let valid = true;
    if (!/^\S+@\S+\.\S+$/.test(email)) valid = showError('email', 'Enter a valid email address.');

    if (mode === 'reset') {
      if (!valid) return;
      setBusy(button, true, 'Sending');
      try {
        await resetPassword(email);
        toast('Reset link sent. Check your inbox.', 'success');
        mode = 'login';
        draw();
      } catch (error) {
        toast(authMessage(error), 'error');
        setBusy(button, false);
      }
      return;
    }

    const password = root.querySelector('#password').value;
    if (mode === 'signup') {
      const fullName = value('fullName');
      const whatsapp = value('whatsapp');
      if (fullName.split(/\s+/).filter(Boolean).length < 2) valid = showError('fullName', 'Enter your first and last name.');
      if (RULES.some(([, test]) => !test(password))) valid = showError('password', 'Meet every password rule below.');
      if (role === 'seller' && !isValidPhone(whatsapp)) valid = showError('whatsapp', 'Enter a valid Nigerian WhatsApp number.');
      if (!valid) return;
      setBusy(button, true, 'Creating account');
      store.set({ pending: { fullName, role, whatsapp } });
      try {
        await signUp({ email, password, fullName });
      } catch (error) {
        store.set({ pending: null });
        toast(authMessage(error), 'error');
        setBusy(button, false);
      }
      return;
    }

    if (!password) valid = showError('password', 'Enter your password.');
    if (!valid) return;
    setBusy(button, true, 'Logging in');
    try {
      await signIn(email, password);
    } catch (error) {
      toast(authMessage(error), 'error');
      setBusy(button, false);
    }
  });

  const go = state => {
    if (state.ready && state.profile) {
      localStorage.setItem('ludek_intro', '1');
      navigate(next || defaultRoute(state.profile), { replace: true });
    }
  };
  go(store.get());
  return store.subscribe(go);
}
