/*
 * Service worker: uygulamanın internetsiz de açılması için dosyaları önbelleğe alır.
 * Strateji: önce ağ (her açılışta güncel sürüm), ağ yoksa önbellek.
 * Soru verileri burada değil, IndexedDB'de saklanır.
 */
const CACHE = 'kbb-soru-bankasi-v2';
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/markdown.js',
  './js/parser.js',
  './js/db.js',
  './js/store.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];
const NETWORK_TIMEOUT = 4000;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const timeout = ms => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

async function fallback(req) {
  const cached = await caches.match(req, { ignoreSearch: true });
  if (cached) return cached;
  if (req.mode === 'navigate') return caches.match('./index.html');
  return undefined;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  const network = fetch(req, { cache: 'no-cache' }).then(res => {
    if (res && res.ok) {
      const copy = res.clone();
      const save = caches.open(CACHE).then(c => c.put(req, copy));
      try { event.waitUntil(save); } catch (e) { /* yanıt zaten verilmiş */ }
    }
    return res;
  });
  network.catch(() => {});

  event.respondWith((async () => {
    try {
      return await Promise.race([network, timeout(NETWORK_TIMEOUT)]);
    } catch (e) {
      // Ağ yavaş veya yok: önbellekteki sürümü kullan; o da yoksa ağı beklemeye devam et
      const cached = await fallback(req);
      if (cached) return cached;
      try { return await network; } catch (err) { return Response.error(); }
    }
  })());
});
