import { h } from '../lib/dom.js';
import { navigate, setTitle } from '../router.js';

const STALL = '<svg viewBox="0 0 240 200" width="270" height="225" fill="none" role="img" aria-label="Market stall"><ellipse cx="120" cy="186" rx="98" ry="9" fill="#2D5016" opacity=".12"/><rect x="48" y="88" width="144" height="92" rx="6" fill="#fff" stroke="#2D5016" stroke-width="3"/><path d="M36 88 54 36h132l18 52z" fill="#2D5016"/><path d="M90 36 84 88M120 36v52M150 36l6 52" stroke="#FAF7F0" stroke-width="9" opacity=".85"/><g fill="#2D5016"><circle cx="48" cy="92" r="12"/><circle cx="84" cy="92" r="12"/><circle cx="120" cy="92" r="12"/><circle cx="156" cy="92" r="12"/><circle cx="192" cy="92" r="12"/></g><rect x="62" y="132" width="44" height="34" rx="6" fill="#C8DFB0" stroke="#2D5016" stroke-width="3"/><rect x="118" y="124" width="56" height="42" rx="6" fill="#EFF6E8" stroke="#2D5016" stroke-width="3"/><circle cx="84" cy="124" r="9" fill="#4E8426"/><circle cx="102" cy="126" r="7" fill="#6BA33A"/><rect x="132" y="108" width="28" height="18" rx="4" fill="#2D5016"/></svg>';
const FIND = '<svg viewBox="0 0 240 200" width="270" height="225" fill="none" role="img" aria-label="Search the market"><rect x="26" y="22" width="68" height="68" rx="16" fill="#C8DFB0"/><rect x="104" y="22" width="68" height="68" rx="16" fill="#fff" stroke="#2D5016" stroke-width="3"/><rect x="26" y="100" width="68" height="68" rx="16" fill="#fff" stroke="#2D5016" stroke-width="3"/><rect x="104" y="100" width="68" height="68" rx="16" fill="#EFF6E8"/><rect x="52" y="36" width="18" height="40" rx="5" fill="#2D5016"/><path d="M124 38h28v40h-28z" fill="#C8DFB0" stroke="#2D5016" stroke-width="3"/><path d="M40 138h40v-14H40z M40 138v14M80 138v14" stroke="#2D5016" stroke-width="4" stroke-linecap="round"/><path d="M122 116l16-10 16 10v26h-32z" fill="#4E8426"/><circle cx="168" cy="130" r="32" fill="#FAF7F0" fill-opacity=".72" stroke="#2D5016" stroke-width="8"/><path d="m192 154 26 26" stroke="#2D5016" stroke-width="11" stroke-linecap="round"/></svg>';
const CHAT = '<svg viewBox="0 0 240 200" width="270" height="225" fill="none" role="img" aria-label="Chat bubbles"><rect x="22" y="24" width="140" height="62" rx="20" fill="#fff" stroke="#2D5016" stroke-width="3"/><path d="M50 86l-6 20 24-20z" fill="#fff" stroke="#2D5016" stroke-width="3" stroke-linejoin="round"/><rect x="42" y="44" width="92" height="9" rx="4.5" fill="#C8DFB0"/><rect x="42" y="62" width="58" height="9" rx="4.5" fill="#C8DFB0"/><rect x="78" y="112" width="140" height="62" rx="20" fill="#2D5016"/><path d="M190 174l8 18-26-18z" fill="#2D5016"/><rect x="98" y="130" width="70" height="9" rx="4.5" fill="#FAF7F0" opacity=".85"/><rect x="98" y="148" width="44" height="9" rx="4.5" fill="#FAF7F0" opacity=".55"/><path d="M178 148l8 8 14-16" stroke="#C8DFB0" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SELL = '<svg viewBox="0 0 240 200" width="270" height="225" fill="none" role="img" aria-label="Camera and price tag"><rect x="30" y="66" width="132" height="96" rx="18" fill="#fff" stroke="#2D5016" stroke-width="3"/><path d="M70 66l9-18h38l9 18" fill="#C8DFB0" stroke="#2D5016" stroke-width="3" stroke-linejoin="round"/><circle cx="96" cy="114" r="28" fill="#EFF6E8" stroke="#2D5016" stroke-width="3"/><circle cx="96" cy="114" r="13" fill="#2D5016"/><circle cx="142" cy="84" r="5" fill="#4E8426"/><g transform="rotate(14 192 66)"><rect x="152" y="34" width="72" height="54" rx="12" fill="#2D5016"/><circle cx="166" cy="48" r="4.5" fill="#FAF7F0"/><text x="196" y="74" font-family="Syne,sans-serif" font-weight="800" font-size="24" fill="#FAF7F0" text-anchor="middle">₦</text></g><path d="M176 118v34M164 130l12-12 12 12" stroke="#4E8426" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const TRUST = '<svg viewBox="0 0 240 200" width="270" height="225" fill="none" role="img" aria-label="Verified shield and map pin"><path d="M112 20l62 22v44c0 40-26 68-62 84-36-16-62-44-62-84V42z" fill="#2D5016"/><path d="M84 96l20 20 38-40" stroke="#FAF7F0" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><g transform="translate(168 112)"><path d="M22 66S0 40 0 22a22 22 0 0 1 44 0c0 18-22 44-22 44z" fill="#C8DFB0" stroke="#2D5016" stroke-width="3.5"/><circle cx="22" cy="22" r="8" fill="#2D5016"/></g></svg>';

const SLIDES = [
  { title: 'Your campus, your market', body: 'Buy and sell with students and sellers at UNICROSS, Okuku Campus.', art: STALL },
  { title: 'Find anything, fast', body: 'Phones, books, hostels, food and services, all in one place.', art: FIND },
  { title: 'Chat on WhatsApp', body: 'Tap once to message the seller. No middlemen, no waiting.', art: CHAT },
  { title: 'Sell in two minutes', body: 'Add photos, set your price and your listing goes live.', art: SELL },
  { title: 'Trusted and local', body: 'Verified sellers and campus meetups keep every deal safe.', art: TRUST }
];

export default function welcome(root) {
  setTitle('Welcome');
  let index = 0;

  root.innerHTML = h`
    <div class="wl">
      <span class="wl-c wl-c1"></span><span class="wl-c wl-c2"></span>
      <div class="wl-top">
        <div class="wl-dots">${SLIDES.map(() => '<i></i>')}</div>
        <button class="gpill" data-skip>Skip</button>
      </div>
      <div class="wl-view">
        <div class="wl-track">
          ${SLIDES.map(slide => `<section class="wl-slide"><div class="wl-art glass">${slide.art}</div><h2>${slide.title}</h2><p>${slide.body}</p></section>`)}
        </div>
      </div>
      <div class="wl-actions" id="acts"></div>
    </div>`;

  const track = root.querySelector('.wl-track');
  const dots = [...root.querySelectorAll('.wl-dots i')];
  const actions = root.querySelector('#acts');
  const finish = to => {
    localStorage.setItem('ludek_intro', '1');
    navigate(to);
  };

  const draw = () => {
    track.style.transform = `translateX(${-index * 100}%)`;
    dots.forEach((dot, i) => dot.classList.toggle('on', i === index));
    root.querySelector('[data-skip]').hidden = index === SLIDES.length - 1;
    actions.innerHTML =
      index === SLIDES.length - 1
        ? '<button class="bt bt-primary" data-go="/auth?mode=signup">Create account</button><button class="bt bt-ghost" data-go="/auth">I already have an account</button>'
        : '<button class="bt bt-primary" data-next>Next</button>';
  };

  root.addEventListener('click', event => {
    if (event.target.closest('[data-skip]')) finish('/');
    else if (event.target.closest('[data-next]')) {
      index = Math.min(index + 1, SLIDES.length - 1);
      draw();
    } else {
      const go = event.target.closest('[data-go]');
      if (go) finish(go.dataset.go);
    }
  });

  let startX = 0;
  const view = root.querySelector('.wl-view');
  view.addEventListener('touchstart', event => (startX = event.changedTouches[0].clientX), { passive: true });
  view.addEventListener('touchend', event => {
    const delta = event.changedTouches[0].clientX - startX;
    if (Math.abs(delta) < 45) return;
    index = Math.max(0, Math.min(SLIDES.length - 1, index + (delta < 0 ? 1 : -1)));
    draw();
  });

  draw();
}
