const CACHE_NAME = 'golf-score-cache-v7';
const ASSETS = [
  './',
  './index.html',
  './share-target.html',
  './css/style.css',
  './js/config.js',
  './js/seed-data.js',
  './js/db.js',
  './js/calc.js',
  './js/ocr.js',
  './js/share.js',
  './js/app.js',
  './manifest.json',
];

importScripts('js/db.js');

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target.html')) {
    event.respondWith(handleShareTarget(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('image');
    if (file) {
      await self.GolfDB.putPendingShare(file);
    }
  } catch (err) {
    console.error('share-target 처리 실패', err);
  }
  return Response.redirect('./index.html', 303);
}
