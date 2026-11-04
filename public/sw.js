const CACHE_NAME = "pawnir-shell-v8";
const API_CACHE_NAME = "pawnir-api-v8";

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.webmanifest",
  "/hero-baby-stray-sleeping-vector.png",
  "/pawnir-logo.png",
  "/pawnir-logo-dark.png",
  "/favicon-32x32.png",
  "/favicon-192x192.png",
  "/favicon-512x512.png",
  "/apple-touch-icon.png",
  "/og-image.svg"
];

const CACHEABLE_API_PREFIXES = [
  "/api/lost-found",
  "/api/donors",
  "/api/fosters",
  "/api/adoptions",
  "/api/vets",
  "/api/community-stats"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.pathname === "/api/stream" || url.pathname.startsWith("/auth/")) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    const isCacheableApi = CACHEABLE_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
    if (!isCacheableApi) return;

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const exact = await caches.match(request);
          if (exact) return exact;
          const byPath = await caches.match(url.pathname, { ignoreSearch: true });
          if (byPath) return byPath;
          return new Response(JSON.stringify({ error: "Offline", offline: true }), {
            status: 503,
            headers: { "Content-Type": "application/json; charset=utf-8" }
          });
        })
    );
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === "navigate") {
          const shell = (await caches.match("/")) || (await caches.match("/index.html"));
          if (shell) return shell;
        }
        return new Response("", { status: 504, statusText: "Offline" });
      })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
