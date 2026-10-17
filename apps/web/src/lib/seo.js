const SITE = String(import.meta.env.VITE_SITE_URL || location.origin).replace(/\/$/, '');
const NAME = 'Ludek Market';
const DEFAULT_DESCRIPTION =
  'Ludek Market is the campus marketplace for UNICROSS, Okuku Campus. Buy and sell phones, books, fashion, food, hostels, services and tutoring with fellow students.';
const DEFAULT_IMAGE = `${SITE}/og-default.png`;

let robots = 'index,follow';

function meta(attribute, key, content) {
  let el = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attribute, key);
    document.head.append(el);
  }
  el.setAttribute('content', content);
}

function link(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.append(el);
  }
  el.setAttribute('href', href);
}

function structured(data) {
  let el = document.getElementById('ld-page');
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'ld-page';
    document.head.append(el);
  }
  el.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
}

export function setSeo({ title, description, image, path, type = 'website', jsonLd } = {}) {
  const fullTitle = title ? `${title} | ${NAME}` : `${NAME} | UNICROSS, Okuku Campus`;
  const text = String(description || DEFAULT_DESCRIPTION).replace(/\s+/g, ' ').trim().slice(0, 160);
  const picture = image || DEFAULT_IMAGE;
  const url = SITE + (path ?? location.pathname);

  document.title = fullTitle;
  meta('name', 'description', text);
  meta('name', 'robots', robots);
  meta('property', 'og:site_name', NAME);
  meta('property', 'og:locale', 'en_NG');
  meta('property', 'og:type', type);
  meta('property', 'og:title', fullTitle);
  meta('property', 'og:description', text);
  meta('property', 'og:url', url);
  meta('property', 'og:image', picture);
  meta('name', 'twitter:card', 'summary_large_image');
  meta('name', 'twitter:title', fullTitle);
  meta('name', 'twitter:description', text);
  meta('name', 'twitter:image', picture);
  link('canonical', url);
  structured(jsonLd);
}

export function resetSeo({ noindex = false } = {}) {
  robots = noindex ? 'noindex,nofollow' : 'index,follow';
  setSeo({});
}

export const setTitle = title => setSeo({ title });

const CONDITIONS = {
  new: 'https://schema.org/NewCondition',
  'like-new': 'https://schema.org/NewCondition',
  'used-good': 'https://schema.org/UsedCondition',
  'used-fair': 'https://schema.org/UsedCondition'
};

const resize = (url, width) =>
  url && url.includes('res.cloudinary.com') && url.includes('/upload/')
    ? url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`)
    : url;

export function productSeo(listing) {
  const images = (listing.images || []).map(url => resize(url, 1200));
  const path = `/product/${listing.id}`;
  const price = Number(listing.price || 0).toLocaleString('en-NG');
  const description = listing.description
    ? listing.description
    : `${listing.title} for sale on ${NAME}, UNICROSS, Okuku Campus.`;

  setSeo({
    title: `${listing.title} for ₦${price}`,
    description,
    image: images[0],
    path,
    type: 'product',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Product',
          name: listing.title,
          description,
          sku: listing.id,
          category: listing.category,
          image: images,
          itemCondition: CONDITIONS[listing.condition],
          offers: {
            '@type': 'Offer',
            url: SITE + path,
            priceCurrency: 'NGN',
            price: Number(listing.price || 0),
            availability: listing.status === 'sold' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
            seller: { '@type': 'Person', name: listing.seller?.storeName || listing.seller?.fullName || 'Seller' }
          }
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Browse', item: `${SITE}/browse` },
            { '@type': 'ListItem', position: 2, name: listing.title, item: SITE + path }
          ]
        }
      ]
    }
  });
}

export function sellerSeo(seller, name) {
  const path = `/seller/${seller.id}`;
  setSeo({
    title: `${name} on Ludek Market`,
    description: seller.bio || `${name} sells on ${NAME}, UNICROSS, Okuku Campus.`,
    image: resize(seller.avatarUrl, 600),
    path,
    type: 'profile',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name,
      url: SITE + path,
      image: seller.avatarUrl || undefined,
      description: seller.bio || undefined
    }
  });
}
