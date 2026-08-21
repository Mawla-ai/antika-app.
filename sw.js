// Antika Service Worker v2.0
const CACHE_NAME = 'antika-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/chat.js',
  './js/calls.js',
  './js/notifications.js',
  './js/realtime.js',
  './firebase-config.js',
  './manifest.json',
  './assets/logo_192.png',
  './assets/logo_512.png'
];

// Install: cache static assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('SW: Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for static, network-first for Firebase/CDN
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip non-GET and Firebase/external requests
  if (e.request.method !== 'GET') return;
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('google') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('cdnjs')) {
    return; // Let them go through network always
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

// Push notifications handler
self.addEventListener('push', (e) => {
  const options = {
    body: 'تنبيه جديد من النظام',
    icon: './assets/logo_192.png',
    badge: './assets/logo_192.png',
    tag: 'antika-msg',
    silent: false,
    vibrate: [200, 100, 200],
    data: { url: './' }
  };
  e.waitUntil(self.registration.showNotification('لديك تنبيه', options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || './'));
});
