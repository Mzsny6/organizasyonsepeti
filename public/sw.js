// Uygulama (PWA / Android) için çevrimdışı destek.
// - Sayfalar: önce ağ; bağlantı yoksa son görülen kopya, o da yoksa "İnternet yok" sayfası.
// - CSS/JS/simgeler: önbellekten hemen, arka planda yenilenir.
// - Fotoğraflar: önbellekte varsa oradan (en fazla 120 adet).
// - API, yönetim paneli, hesap ve favoriler önbelleğe alınmaz (kişisel veri).
const VERSION = "1";
const STATIC = `os-static-${VERSION}`;
const PAGES = `os-pages-${VERSION}`;
const IMAGES = `os-images-${VERSION}`;
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((cache) => cache.addAll([OFFLINE, "/assets/img/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([STATIC, PAGES, IMAGES]);
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((key) => cache.delete(key)));
}

async function page(request, store) {
  try {
    const response = await fetch(request);
    if (store && response.ok && response.type === "basic") {
      const cache = await caches.open(PAGES);
      await cache.put(request, response.clone());
      trim(PAGES, 40);
    }
    return response;
  } catch {
    return (store && (await caches.match(request, { cacheName: PAGES }))) || caches.match(OFFLINE);
  }
}

async function asset(request) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || refresh;
}

async function image(request) {
  const cache = await caches.open(IMAGES);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    trim(IMAGES, 120);
  }
  return response;
}

const PRIVATE = /^\/(api|admin|hesap|favoriler|\.netlify\/functions)(\/|$)/;

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(page(request, !PRIVATE.test(url.pathname)));
    return;
  }
  if (PRIVATE.test(url.pathname)) return;
  if (url.pathname.startsWith("/assets/")) event.respondWith(asset(request));
  else if (url.pathname.startsWith("/.netlify/images") || url.pathname.startsWith("/media/"))
    event.respondWith(image(request));
});
