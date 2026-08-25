const CACHE_NAME = "life-os-shell-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first: always prefer a live response so the app never goes stale
// while online. Only fall back to the cached shell when there's no network.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.url.includes("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: "Life OS", body: event.data?.text() ?? "" };
  }

  // waitUntil is required, not just tidy — a push the SW doesn't resolve
  // with a shown notification reads to iOS as "silent," and enough silent
  // pushes in a row gets the subscription revoked outright.
  event.waitUntil(
    self.registration.showNotification(data.title || "Life OS", {
      body: data.body || "",
      icon: "/manifest-icon-192",
      badge: "/manifest-icon-192",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
