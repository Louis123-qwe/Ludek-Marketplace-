import { emptyState } from '../../components/ui.js';
import { setTitle } from '../../router.js';

const sections = {
  overview: () => import('./overview.js'),
  users: () => import('./users.js'),
  listings: () => import('./listings.js'),
  categories: () => import('./categories.js'),
  reports: () => import('./reports.js'),
  announcements: () => import('./announcements.js'),
  ticker: () => import('./ticker.js'),
  sales: () => import('./sales.js'),
  ads: () => import('./ads.js'),
  settings: () => import('./settings.js'),
  logs: () => import('./logs.js')
};

export default async function admin(root, ctx) {
  const key = ctx.params.section || 'overview';
  const load = sections[key];

  if (!load) {
    root.innerHTML = emptyState({
      icon: 'search',
      title: 'Section not found',
      action: '<a class="btn btn-primary" href="/admin">Back to overview</a>'
    });
    return;
  }

  setTitle('Admin');
  const module = await load();
  return module.default(root, ctx);
}
