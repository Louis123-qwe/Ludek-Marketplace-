export const BRAND = {
  name: 'Ludek Market',
  campus: 'UNICROSS, Okuku Campus'
};

export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
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
