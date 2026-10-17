import { http } from './client.js';

export const favorites = {
  list: () => http.get('/api/me/favorites'),
  ids: () => http.get('/api/me/favorites/ids'),
  add: id => http.put(`/api/favorites/${id}`),
  remove: id => http.del(`/api/favorites/${id}`)
};
