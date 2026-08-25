"use client";

/** Fire-and-forget confirmation push for a *manual* tap — "Лягти спати"/
 *  "Прокинувся(лась)" pressed by the user's own thumb, not triggered by the
 *  bedtime reminder's deep-link (that path already just showed the user a
 *  notification about this same thing; sending another one right after
 *  would be a redundant double-notification, so callers on that path must
 *  not call this). No-ops harmlessly if the device never subscribed to
 *  push — send-to-self just finds zero subscriptions server-side. */
export function sendSelfPush(title: string, body: string) {
  fetch("/api/push/send-to-self", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body }),
  }).catch(() => undefined);
}
