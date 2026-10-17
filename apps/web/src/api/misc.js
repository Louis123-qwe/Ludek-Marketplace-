import { http } from './client.js';

export const misc = {
  categories: () => http.get('/api/categories'),
  settings: () => http.get('/api/settings'),
  publicStats: () => http.get('/api/stats'),
  feed: () => http.get('/api/feed'),
  ads: () => http.get('/api/ads'),
  recentSales: () => http.get('/api/sales/recent'),
  notifications: {
    list: () => http.get('/api/me/notifications'),
    unread: () => http.get('/api/me/notifications/unread'),
    markRead: () => http.post('/api/me/notifications/read')
  },
  reports: {
    create: body => http.post('/api/reports', body)
  },
  uploads: {
    sign: body => http.post('/api/uploads/sign', body)
  }
};
