"use client";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** iOS has no Push API at all outside an installed, standalone PWA — this
 *  is the one check every entry point into subscribing has to pass first,
 *  so the UI can show "Додай на головний екран" instead of a dead button
 *  or (worse) silently doing nothing. */
export function canRequestPush(): boolean {
  if (typeof window === "undefined") return false;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  if (isIOS && !isStandalone) return false;
  return "serviceWorker" in navigator && "PushManager" in window;
}

export type PushSubscribeResult = "subscribed" | "already-subscribed" | "denied" | "unsupported";

/** Must only ever be called from a click handler — Notification.
 *  requestPermission() called on page load is exactly what gets the
 *  request silently blocked on iOS, not just ignored. */
export async function subscribeToPush(): Promise<PushSubscribeResult> {
  if (!canRequestPush()) return "unsupported";

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    // Already subscribed locally — still worth telling the server again in
    // case this device's row was pruned server-side (e.g. after a 410).
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(existing.toJSON()),
    }).catch(() => undefined);
    return "already-subscribed";
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_KEY!),
  });

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });

  return "subscribed";
}

/** Server-side deactivation only (see /api/push/unsubscribe) plus the
 *  matching browser-side unsubscribe() — this is the explicit "turn off
 *  notifications" toggle, never called automatically (e.g. on some future
 *  logout), since re-subscribing on iOS needs a fresh user gesture and
 *  can't be done silently on the app's behalf. */
export async function unsubscribeFromPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (!existing) return;

  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: existing.endpoint }),
  }).catch(() => undefined);

  await existing.unsubscribe();
}

export async function getPushSubscriptionStatus(): Promise<"subscribed" | "not-subscribed" | "unsupported"> {
  if (!canRequestPush()) return "unsupported";
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  return existing ? "subscribed" : "not-subscribed";
}
