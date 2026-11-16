/* Us, In Places — service worker
   Naikkan VERSION setiap kali kamu deploy supaya cache lama dibuang. */
const VERSION = 'v1';
const SHELL = 'uip-shell-' + VERSION;
const LIBS  = 'uip-libs-' + VERSION;   // font + library CDN
const TILES = 'uip-tiles-' + VERSION;  // tile peta
const IMGS  = 'uip-imgs-' + VERSION;   // poster film
const KEEP  = [SHELL, LIBS, TILES, IMGS];

const PRECACHE = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

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

  // Halaman utama: ambil yang terbaru, kalau offline pakai cache
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put('./', copy));
        return res;
      }).catch(() => caches.match('./').then((r) => r || caches.match(req)))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    e.respondWith(swr(req, SHELL));
    return;
  }
  if (LIB_HOSTS.includes(url.hostname))  { e.respondWith(swr(req, LIBS));       return; }
  if (TILE_HOSTS.includes(url.hostname)) { e.respondWith(swr(req, TILES, 300)); return; }
  if (IMG_HOSTS.includes(url.hostname))  { e.respondWith(swr(req, IMGS, 120));  return; }
  // Selain itu (database, pencarian lokasi, API film, dll) dibiarkan lewat jaringan biasa
});
