"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;
    // A new service worker took control (it activated after the page already
    // loaded under the old one) — reload once so the fresh build actually
    // shows up, instead of leaving the user stuck on stale JS until they
    // manually refresh or reinstall the PWA.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      // Standalone PWAs don't reliably re-check for updates just from being
      // reopened — force a check whenever the app regains focus/visibility.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          registration.update().catch(() => undefined);
        }
      });
    }).catch(() => undefined);
  }, []);

  return null;
}
