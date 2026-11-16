/* Us, In Places — service worker
   Naikkan VERSION setiap kali kamu deploy supaya cache lama dibuang.
   PENTING: semua request ke /api/* (login Google, sesi, data, foto) TIDAK disentuh,
   selalu langsung ke jaringan. */
const VERSION = 'v2';
const SHELL = 'uip-shell-' + VERSION;
const LIBS  = 'uip-libs-' + VERSION;   // font + library CDN
const TILES = 'uip-tiles-' + VERSION;  // tile peta
const IMGS  = 'uip-imgs-' + VERSION;   // poster film
const KEEP  = [SHELL, LIBS, TILES, IMGS];

const PRECACHE = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const STATIC = /\.(?:png|jpe?g|webp|svg|ico|woff2?|webmanifest)$/i;

const LIB_HOSTS  = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];
const TILE_HOSTS = ['tiles.openfreemap.org', 'tile.openstreetmap.org'];
const IMG_HOSTS  = ['image.tmdb.org'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('uip-') && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(name, max) {
  const c = await caches.open(name);
  const ks = await c.keys();
  if (ks.length > max) await Promise.all(ks.slice(0, ks.length - max).map((k) => c.delete(k)));
}

function swr(req, cacheName, max) {
  return caches.open(cacheName).then(async (cache) => {
    const hit = await cache.match(req);
    const net = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) { cache.put(req, res.clone()).then(() => max && trim(cacheName, max)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // API, login Google, sesi, foto: jangan disentuh sama sekali
    if (url.pathname.startsWith('/api/')) return;

    if (req.mode === 'navigate') {
      // hanya halaman utama yang ditangani; navigasi lain (mis. callback login) langsung ke jaringan
      if (url.pathname !== '/' && url.pathname !== '/index.html') return;
      e.respondWith(
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put('./', copy));
          }
          return res;
        }).catch(() => caches.match('./').then((r) => r || Response.error()))
      );
      return;
    }
    if (STATIC.test(url.pathname)) e.respondWith(swr(req, SHELL));
    return;
  }

  if (LIB_HOSTS.includes(url.hostname))  { e.respondWith(swr(req, LIBS));       return; }
  if (TILE_HOSTS.includes(url.hostname)) { e.respondWith(swr(req, TILES, 300)); return; }
  if (IMG_HOSTS.includes(url.hostname))  { e.respondWith(swr(req, IMGS, 120));  return; }
  // selain itu dibiarkan lewat jaringan biasa
});
