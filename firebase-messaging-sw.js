// Pedeki - avisos de NOVO PEDIDO (loja) e NOVA ENTREGA (entregador) no celular
// (fica na raiz do site; não precisa mexer)

// ao tocar no aviso, abre o painel nos pedidos
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || "https://pedeki.github.io/painel.html#pedidos";
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    const pagina = link.includes("entregador") ? "entregador.html" : "painel.html";
    const aberto = cs.find(c => c.url.includes(pagina));
    return aberto ? aberto.focus() : clients.openWindow(link);
  }));
});

importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"
);
self.window = self;
importScripts("config.js");
firebase.initializeApp(self.PEDEKI.firebase);

firebase.messaging().onBackgroundMessage(m => {
  const d = m.data || {};
  return self.registration.showNotification(d.titulo || "🔔 Novo pedido!", {
    body: d.corpo || "Abra o painel para ver o pedido.",
    icon: "pedeki-icone.png",
    badge: "pedeki-badge.png",
    tag: (String(d.link || "").includes("entregador") ? "entrega-" : "pedido-") + (d.pedido || Date.now()),
    renotify: true,
    requireInteraction: true,
    vibrate: [600, 200, 600, 200, 600, 200, 1000],
    data: { link: d.link }
  });
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
