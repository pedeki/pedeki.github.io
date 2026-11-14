// Pedeki Entregador - deixa o app instalável e abre mais rápido
const CACHE = "pedeki-entregador-v2";
const BASE = ["entregador.html", "css/app.css", "js/base.js", "js/fb.js", "config.js", "icones/entregador-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
// sempre tenta a internet primeiro (pedidos ao vivo); sem internet, usa o que está guardado
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)).catch(() => {}); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
