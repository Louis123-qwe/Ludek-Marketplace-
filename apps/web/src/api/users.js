import { http } from './client.js';

export const users = {
  sync: body => http.post('/api/me/sync', body),
  me: () => http.get('/api/me'),
  update: body => http.patch('/api/me', body),
  stats: () => http.get('/api/me/stats'),
  publicProfile: id => http.get(`/api/users/${id}`),
  reviews: id => http.get(`/api/users/${id}/reviews`),
  addReview: (id, body) => http.post(`/api/users/${id}/reviews`, body)
};
