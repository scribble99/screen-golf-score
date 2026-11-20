const CACHE_NAME = 'golf-score-cache-v9';
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
    caches
      .open(CACHE_NAME)
      // {cache: 'reload'} bypasses the browser's own HTTP cache too, not
      // just ours — without it, a stale network response can get baked
      // into the (freshly-versioned) SW cache again.
      .then((cache) => Promise.all(ASSETS.map((url) => fetch(url, { cache: 'reload' }).then((res) => cache.put(url, res)))))
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

// Network-first: while developing/iterating, a stale cached copy silently
// winning over a fresh deploy is much more confusing than the small cost of
// hitting the network on every load. Falls back to cache only when offline.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target.html')) {
    event.respondWith(handleShareTarget(event.request));
    return;
  }

  if (event.request.method !== 'GET') return;

  event.respondWith(
    // GitHub Pages sends Cache-Control: max-age=600 on every asset, and a
    // plain fetch() honors that via the browser's own HTTP cache — so a
    // "network-first" fetch could silently resolve from that disk cache for
    // up to 10 minutes after a deploy instead of actually hitting the
    // network. {cache: 'no-store'} forces a real network round-trip every
    // time so a fresh deploy shows up immediately.
    fetch(event.request, { cache: 'no-store' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
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
