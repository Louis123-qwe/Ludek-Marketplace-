import { http } from './client.js';

export const listings = {
  list: query => http.get('/api/listings', query),
  get: id => http.get(`/api/listings/${id}`),
  mine: query => http.get('/api/me/listings', query),
  create: body => http.post('/api/listings', body),
  update: (id, body) => http.patch(`/api/listings/${id}`, body),
  remove: id => http.del(`/api/listings/${id}`),
  view: id => http.post(`/api/listings/${id}/view`),
  chatTap: id => http.post(`/api/listings/${id}/chat-tap`)
};
