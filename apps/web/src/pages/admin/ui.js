import { h, esc } from '../../lib/dom.js';

export const adminHead = (title, text = '', actions = '') => h`
  <div class="page-head">
    <div><h2>${esc(title)}</h2>${text ? `<p class="muted">${esc(text)}</p>` : ''}</div>
    ${actions ? `<div class="head-actions">${actions}</div>` : ''}
  </div>`;

export const table = (columns, rows, empty = 'Nothing to show yet.') =>
  rows.length
    ? h`<div class="table-wrap"><table class="table">
        <thead><tr>${columns.map(col => `<th class="${col.cls || ''}">${esc(col.label)}</th>`)}</tr></thead>
        <tbody>${rows.map(row => `<tr data-id="${esc(row.id)}">${columns.map(col => `<td class="${col.cls || ''}" data-label="${esc(col.label)}">${col.render(row)}</td>`).join('')}</tr>`)}</tbody>
      </table></div>`
    : `<div class="empty-inline">${esc(empty)}</div>`;

export const statCard = (label, value, tone = '') =>
  `<div class="stat ${tone}"><b>${value}</b><span>${esc(label)}</span></div>`;

export const filterTabs = (options, active, key = 'filter') =>
  `<div class="tabs" role="tablist">${options.map(([value, label]) => `<button class="${value === active ? 'active' : ''}" data-${key}="${esc(value)}">${esc(label)}</button>`).join('')}</div>`;
