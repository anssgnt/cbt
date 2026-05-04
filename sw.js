const CACHE_NAME = 'cbt-cache-v6';
const urlsToCache = [
  '/',
  '/index.html',
  '/soal-editor.html',
  '/style.css',
  '/script.js',
  '/admin-core.js',
  '/13.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // 🔥 JANGAN CACHE REQUEST FIREBASE!
  // Ini adalah fix utama untuk masalah data tidak update
  if (
    url.includes('firebaseio.com') ||
    url.includes('googleapis.com') ||
    url.includes('firestore.googleapis.com') ||
    url.includes('google.com/identitytoolkit') ||
    url.includes('cloudfunctions.net')
  ) {
    // Langsung fetch tanpa cache untuk Firebase
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Untuk request lain (static files), gunakan Network First strategy
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
    })
  );
});
