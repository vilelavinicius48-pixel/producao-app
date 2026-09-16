const CACHE = "producao-app-static-v1";
const STATIC_ASSETS = ["/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// App depende de dados em tempo real (Supabase) e Server Actions — só os
// ícones estáticos são cacheados; todo o resto sempre busca da rede.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/icons/")) return;

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
