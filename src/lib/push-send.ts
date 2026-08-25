import "server-only";
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { pushSubscriptions } from "./db/schema";

webpush.setVapidDetails(
  "mailto:thelastronin2x@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** iOS drops a subscription silently every so often — a 404/410 from Apple's
 *  push service means the browser's own record is gone, not a transient
 *  failure, so the row is deleted rather than retried. Every other error
 *  (network blip, 5xx) is swallowed too: one dead/slow subscription among a
 *  device's several must never block the rest from getting their push. */
export async function sendPush(subscription: PushSubscriptionRow, payload: PushPayload): Promise<void> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, subscription.endpoint));
    }
  }
}
