export const BRAND = {
  name: 'Ludek Market',
  campus: 'UNICROSS, Okuku Campus'
};

// In production the browser always calls same-origin /api (Vercel proxies it to Render);
// a cross-origin value would be blocked by the CSP.
export const API_URL = import.meta.env.DEV ? (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') : '';

export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAvhaV4JR59o2lW7tniMu1GyrEte6ZjvQ8',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'dmb-5b8e2.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'dmb-5b8e2',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:225510920822:web:89cc6d0f27ec97d90ac557'
};

export const DEFAULT_CATEGORIES = [
  { slug: 'electronics', name: 'Electronics', icon: 'phone' },
  { slug: 'fashion', name: 'Fashion', icon: 'shirt' },
  { slug: 'food', name: 'Food', icon: 'utensils' },
  { slug: 'books', name: 'Books', icon: 'book' },
  { slug: 'hostel', name: 'Hostel', icon: 'building' },
  { slug: 'services', name: 'Services', icon: 'wrench' },
  { slug: 'tutoring', name: 'Tutoring', icon: 'cap' },
  { slug: 'housing', name: 'Housing', icon: 'home' }
];

export const CONDITIONS = [
  { value: 'new', label: 'Brand new' },
  { value: 'like-new', label: 'Like new' },
  { value: 'used-good', label: 'Used, good' },
  { value: 'used-fair', label: 'Used, fair' },
  { value: 'service', label: 'Service or not applicable' }
];

export const SORTS = [
  { value: 'new', label: 'Newest first' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'popular', label: 'Most viewed' }
];

export const REPORT_REASONS = [
  'Scam or fraud',
  'Prohibited item',
  'Wrong category',
  'Misleading price',
  'Already sold',
  'Other'
];

export const LEVELS = ['100', '200', '300', '400', '500', '600'];
export const MAX_IMAGES = 6;
