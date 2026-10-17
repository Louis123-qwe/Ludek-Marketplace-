import { store } from './store.js';
import { DEFAULT_CATEGORIES } from '../config.js';

const prettify = slug => String(slug || '').replace(/[-_]+/g, ' ').replace(/^\w/, char => char.toUpperCase());

export const categories = () => (store.get().categories.length ? store.get().categories : DEFAULT_CATEGORIES);
export const categoryName = slug => categories().find(item => item.slug === slug)?.name || prettify(slug);
export const categoryIcon = slug => categories().find(item => item.slug === slug)?.icon || 'tag';
