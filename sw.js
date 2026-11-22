// Service worker : l'app fonctionne hors connexion après la première ouverture.
// Pour forcer une mise à jour chez tous les appareils, change CACHE_VERSION.
const CACHE_VERSION = "horus-v45";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "icons/horus-icon.png", "vendor/jspdf.umd.min.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages : réseau d'abord (version la plus récente), cache en secours si hors ligne ou lent.
  if (req.mode === "navigate") {
    // La page athlète a son propre cache : elle ne doit jamais remplacer « index.html » (l'app du praticien).
    const KEY = url.pathname.endsWith("/athlete.html") ? "athlete.html" : "index.html";
    event.respondWith(
      (async () => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);
        try {
          const fresh = await fetch(req, { signal: ctrl.signal });
          clearTimeout(timer);
          const copy = fresh.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(KEY, copy));
          return fresh;
        } catch (e) {
          clearTimeout(timer);
          return (await caches.match(KEY)) || (KEY === "index.html" ? await caches.match("./") : null) || Response.error();
        }
      })()
    );
    return;
  }

  // Le reste (icônes, manifeste) : cache d'abord.
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
