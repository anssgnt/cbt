const CACHE_NAME = 'cbt-cache-v6.4';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/13.jpg'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // --- BYPASS CACHE UNTUK ADMIN (Armor 1000) ---
  // File admin-core.js dan soal-editor.html harus selalu fresh dari network.
  if (url.pathname.includes('admin-core.js') || url.pathname.includes('soal-editor.html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }) // Paksa ambil dari network tanpa cache browser
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Jika berhasil, clone dan simpan ke cache untuk fallback
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseToCache));
        }
        return response;
      })
      .catch(() => {
        // Jika offline, ambil dari cache
        return caches.match(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});
