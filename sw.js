// Lift service worker: lets the app open with no signal (e.g. gym basement)
// and lets Android offer "Install app".
// Strategy: always try the network first (so updates show up right away),
// fall back to the cached copy when offline.
const CACHE = "lift-v12";
const CORE = ["./", "index.html", "config.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const supabaseLib = url.hostname === "cdn.jsdelivr.net";
  if (!sameOrigin && !supabaseLib) return; // database calls always go straight to the network

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true })
          .then(hit => hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))
      )
  );
});
