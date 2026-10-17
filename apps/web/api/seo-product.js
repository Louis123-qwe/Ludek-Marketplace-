const SITE = (process.env.SITE_URL || 'https://ludekmarket.vercel.app').replace(/\/$/, '');
const API = (process.env.API_ORIGIN || 'https://ludek-market-api.onrender.com').replace(/\/$/, '');

const ESCAPES = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#39;', '"': '&quot;' };
const html = value => String(value ?? '').replace(/[<>&'"]/g, char => ESCAPES[char]);
const resize = url =>
  url && url.includes('res.cloudinary.com') && url.includes('/upload/')
    ? url.replace('/upload/', '/upload/f_auto,q_auto,w_1200/')
    : url || `${SITE}/og-default.png`;

function page(status, res, head, body) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
  res.status(status).send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${head}</head><body>${body}</body></html>`);
}

export default async function handler(req, res) {
  const id = String(req.query.id || '');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    page(400, res, '<title>Not found | Ludek Market</title><meta name="robots" content="noindex">', '<h1>Not found</h1>');
    return;
  }

  let listing = null;
  try {
    const response = await fetch(`${API}/api/listings/${encodeURIComponent(id)}`, { headers: { accept: 'application/json' } });
    if (response.ok) listing = await response.json();
  } catch (error) {
    listing = null;
  }

  if (!listing) {
    page(404, res, '<title>Listing not found | Ludek Market</title><meta name="robots" content="noindex">', '<h1>Listing not found</h1>');
    return;
  }

  const url = `${SITE}/product/${encodeURIComponent(listing.id)}`;
  const price = Number(listing.price || 0);
  const images = (listing.images || []).map(resize);
  const description = (listing.description || `${listing.title} for sale on Ludek Market, UNICROSS, Okuku Campus.`).replace(/\s+/g, ' ').slice(0, 160);
  const title = `${listing.title} for \u20a6${price.toLocaleString('en-NG')} | Ludek Market`;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description,
    sku: listing.id,
    image: images,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'NGN',
      price,
      availability: listing.status === 'sold' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock'
    }
  };

  const head = [
    `<title>${html(title)}</title>`,
    `<meta name="description" content="${html(description)}">`,
    `<link rel="canonical" href="${html(url)}">`,
    '<meta property="og:type" content="product">',
    '<meta property="og:site_name" content="Ludek Market">',
    `<meta property="og:title" content="${html(title)}">`,
    `<meta property="og:description" content="${html(description)}">`,
    `<meta property="og:url" content="${html(url)}">`,
    `<meta property="og:image" content="${html(images[0] || `${SITE}/og-default.png`)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${html(title)}">`,
    `<meta name="twitter:image" content="${html(images[0] || `${SITE}/og-default.png`)}">`,
    `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
  ].join('');

  page(
    200,
    res,
    head,
    `<main><h1>${html(listing.title)}</h1><p>\u20a6${price.toLocaleString('en-NG')}</p><p>${html(description)}</p>${images[0] ? `<img src="${html(images[0])}" alt="${html(listing.title)}" width="600">` : ''}<p><a href="${html(url)}">View on Ludek Market</a></p></main>`
  );
}
