import { http } from './client.js';

export const admin = {
  overview: () => http.get('/api/admin/overview'),
  sales: query => http.get('/api/admin/sales', query),
  users: {
    list: query => http.get('/api/admin/users', query),
    update: (id, body) => http.patch(`/api/admin/users/${id}`, body)
  },
  listings: {
    list: query => http.get('/api/admin/listings', query),
    update: (id, body) => http.patch(`/api/admin/listings/${id}`, body),
    remove: id => http.del(`/api/admin/listings/${id}`)
  },
  categories: {
    create: body => http.post('/api/admin/categories', body),
    update: (id, body) => http.patch(`/api/admin/categories/${id}`, body),
    remove: id => http.del(`/api/admin/categories/${id}`)
  },
  reports: {
    list: query => http.get('/api/admin/reports', query),
    update: (id, body) => http.patch(`/api/admin/reports/${id}`, body)
  },
  announcements: {
    list: () => http.get('/api/admin/announcements'),
    create: body => http.post('/api/admin/announcements', body),
    remove: id => http.del(`/api/admin/announcements/${id}`)
  },
  ads: {
    list: () => http.get('/api/admin/ads'),
    create: body => http.post('/api/admin/ads', body),
    update: (id, body) => http.patch(`/api/admin/ads/${id}`, body),
    remove: id => http.del(`/api/admin/ads/${id}`)
  },
  notify: body => http.post('/api/admin/notifications', body),
  ticker: {
    list: () => http.get('/api/admin/ticker'),
    create: body => http.post('/api/admin/ticker', body),
    update: (id, body) => http.patch(`/api/admin/ticker/${id}`, body),
    remove: id => http.del(`/api/admin/ticker/${id}`)
  },
  settings: {
    get: () => http.get('/api/admin/settings'),
    save: body => http.put('/api/admin/settings', body)
  },
  logs: query => http.get('/api/admin/logs', query)
};
