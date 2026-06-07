// Ludek Marketplace — Service Worker
// Version: 23.0.0
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAvhaV4JR59o2lW7tniMu1GyrEte6ZjvQ8",
  authDomain: "dmb-5b8e2.firebaseapp.com",
  projectId: "dmb-5b8e2",
  storageBucket: "dmb-5b8e2.firebasestorage.app",
  messagingSenderId: "225510920822",
  appId: "1:225510920822:web:89cc6d0f27ec97d90ac557"
});

const messaging = firebase.messaging();

const CACHE_NAME = 'ludek-v23';
const STATIC_CACHE = 'ludek-static-v23';
const DYNAMIC_CACHE = 'ludek-dynamic-v23';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/marketplace.html',
  '/main.css',
  '/components.css',
  '/app.js',
  '/auth.js',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/landing.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap'
];

// Install event — pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS.map(url => {
          // Use no-cors for cross-origin resources
          if (url.startsWith('https://')) {
            return new Request(url, { mode: 'no-cors' });
          }
          return url;
        })).catch((err) => {
          console.warn('[SW] Some assets failed to cache:', err);
        });
      })
  );
  self.skipWaiting();
});

// Activate event — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event — network first with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Firebase / Firestore / Auth requests
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebase.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com')
  ) {
    return;
  }

  // Cache-first for static assets
  if (
  request.url.endsWith('.css') ||
  request.url.endsWith('.js') ||
  request.url.includes('/assets/') ||
  request.url.includes('fonts.googleapis.com') ||
  request.url.includes('font-awesome')
) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then((networkResponse) => {
          return caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        }).catch(() => {
          // Return nothing for failed asset requests
        });
      })
    );
    return;
  }

  // Network-first for HTML pages
  if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          return caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // Default: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, networkResponse.clone());
        });
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification.title || 'Ludek Marketplace';
  const options = {
    body:    payload.notification.body || '',
    icon:    '/assets/icon-192.png',
    badge:   '/assets/icon-192.png',
    vibrate: [100, 50, 100],
    data:    { url: payload.fcmOptions?.link || '/' }
  };
  self.registration.showNotification(title, options);
});
