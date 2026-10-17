const state = {
  ready: false,
  user: null,
  profile: null,
  unread: 0,
  favs: new Set(),
  categories: [],
  settings: {},
  pending: null
};

const subscribers = new Set();

export const store = {
  get: () => state,
  set(patch) {
    Object.assign(state, patch);
    subscribers.forEach(fn => fn(state));
  },
  subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }
};
