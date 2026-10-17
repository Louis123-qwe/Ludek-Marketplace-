import { esc } from '../lib/dom.js';
import { store } from '../lib/store.js';
import { waLink } from '../lib/format.js';
import { BRAND } from '../config.js';
import { logoMark } from './brand.js';

export const FOOTER_PAGES = new Set(['home', 'browse', 'marketplace', 'privacy', 'terms', 'user-agreement']);

export function siteFooter() {
  const settings = store.get().settings || {};
  const email = String(settings.supportEmail || '').trim();
  const whatsapp = String(settings.supportWhatsapp || '').trim();
  const support = [
    email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : '',
    whatsapp ? `<a href="${esc(waLink(whatsapp, 'Hello Ludek Market support'))}" target="_blank" rel="noopener">WhatsApp support</a>` : ''
  ].join('');

  return `
    <div class="sfoot-in">
      <div class="sfoot-brand">
        <a class="sfoot-logo" href="/" aria-label="${esc(BRAND.name)} home">${logoMark(44, true)}<span><b>Ludek<i> Market</i></b><small>${esc(BRAND.campus)}</small></span></a>
        <p>The campus marketplace where students buy, sell and find services from each other.</p>
      </div>
      <nav class="sfoot-col" aria-label="Marketplace">
        <h3>Marketplace</h3>
        <a href="/browse">Browse listings</a>
        <a href="/add-listing">Sell an item</a>
        <a href="/saved">Saved items</a>
      </nav>
      <nav class="sfoot-col" aria-label="Legal">
        <h3>Legal</h3>
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms and Conditions</a>
        <a href="/user-agreement">User Agreement</a>
      </nav>
      ${support ? `<nav class="sfoot-col" aria-label="Support"><h3>Support</h3>${support}</nav>` : ''}
    </div>
    <p class="sfoot-copy">&copy; ${new Date().getFullYear()} ${esc(BRAND.name)}. All rights reserved.</p>`;
}
