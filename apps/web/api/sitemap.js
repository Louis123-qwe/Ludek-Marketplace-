const SITE = (process.env.SITE_URL || 'https://ludekmarket.vercel.app').replace(/\/$/, '');
const API = (process.env.API_ORIGIN || 'https://ludek-market-api.onrender.com').replace(/\/$/, '');

const ESCAPES = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' };
const xml = value => String(value).replace(/[<>&'"]/g, char => ESCAPES[char]);

async function getJson(path) {
  const response = await fetch(`${API}${path}`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

export default async function handler(req, res) {
  const urls = [
    { loc: '/', changefreq: 'daily', priority: '1.0' },
    { loc: '/browse', changefreq: 'hourly', priority: '0.9' },
    { loc: '/privacy', changefreq: 'yearly', priority: '0.3' },
    { loc: '/terms', changefreq: 'yearly', priority: '0.3' },
    { loc: '/user-agreement', changefreq: 'yearly', priority: '0.3' }
  ];

  try {
    const categories = await getJson('/api/categories');
    for (const category of categories) {
      urls.push({ loc: `/browse?category=${encodeURIComponent(category.slug)}`, changefreq: 'daily', priority: '0.7' });
    }
    for (let page = 1; page <= 20; page += 1) {
      const data = await getJson(`/api/listings?sort=new&limit=50&page=${page}`);
      for (const listing of data.items) {
        urls.push({
          loc: `/product/${encodeURIComponent(listing.id)}`,
          lastmod: listing.updatedAt || listing.createdAt,
          changefreq: 'weekly',
          priority: '0.8'
        });
      }
      if (page >= data.pages) break;
    }
  } catch (error) {
    urls.length = Math.max(urls.length, 2);
  }

  const body = urls
    .map(
      item =>
        `<url><loc>${xml(SITE + item.loc)}</loc>${item.lastmod ? `<lastmod>${xml(new Date(item.lastmod).toISOString())}</lastmod>` : ''}<changefreq>${item.changefreq}</changefreq><priority>${item.priority}</priority></url>`
    )
    .join('');

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
}
