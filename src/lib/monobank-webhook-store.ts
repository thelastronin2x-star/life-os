import "server-only";
import { redis } from "./redis";
import type { BankWebhookEvent } from "./bank-source";

const SECRET_TTL_SECONDS = 180 * 24 * 60 * 60; // matches the session cookie's lifetime
const EVENTS_TTL_SECONDS = 90 * 24 * 60 * 60; // abandoned queues self-clean well within it
const MAX_DRAIN = 1000;

export type WebhookEvent = BankWebhookEvent;

function secretKey(secretId: string) {
  return `mono:secret:${secretId}`;
}

function eventsKey(secretId: string) {
  return `mono:events:${secretId}`;
}

export async function registerWebhookSecret(secretId: string): Promise<void> {
  await redis.set(secretKey(secretId), 1, { ex: SECRET_TTL_SECONDS });
}

export async function isWebhookSecretValid(secretId: string): Promise<boolean> {
  return (await redis.get(secretKey(secretId))) !== null;
}

export async function pushWebhookEvent(secretId: string, event: WebhookEvent): Promise<void> {
  const key = eventsKey(secretId);
  await redis.rpush(key, event);
  await redis.expire(key, EVENTS_TTL_SECONDS);
}

/** Non-destructive read — events stay queued until the client explicitly
 *  acks them (see ackWebhookEvents), so an interrupted client (reload,
 *  crash, lost network) never loses a transaction it never got to persist. */
export async function peekWebhookEvents(secretId: string): Promise<WebhookEvent[]> {
  const events = await redis.lrange<WebhookEvent>(eventsKey(secretId), 0, MAX_DRAIN - 1);
  return events ?? [];
}

// Removes only the contiguous prefix of queued events whose transaction id
// is in `ids`, stopping at the first non-match — never a blind "pop N"
// count, which would be wrong the moment a second poll (setInterval racing
// visibilitychange, or a second device) peeks the same events: if Monobank
// pushes a genuinely new event between the two acks, a count-based ack would
// pop that new, never-processed event instead of the ones actually handled,
// silently dropping a real transaction. Implemented as a single Lua script
// so the read-then-pop is atomic on Redis's side — otherwise this exact race
// just moves one level down instead of being fixed.
const ACK_PREFIX_SCRIPT = `
local key = KEYS[1]
local idSet = {}
for i = 1, #ARGV do
  idSet[ARGV[i]] = true
end
local len = redis.call('LLEN', key)
local prefix = 0
for i = 0, len - 1 do
  local raw = redis.call('LINDEX', key, i)
  if not raw then break end
  local ok, decoded = pcall(cjson.decode, raw)
  if not ok or type(decoded) ~= 'table' or not decoded.transaction or not idSet[decoded.transaction.id] then
    break
  end
  prefix = prefix + 1
end
if prefix > 0 then
  redis.call('LPOP', key, prefix)
end
return prefix
`;

export async function ackWebhookEvents(secretId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await redis.eval(ACK_PREFIX_SCRIPT, [eventsKey(secretId)], ids);
}

export async function deleteWebhookSecret(secretId: string): Promise<void> {
  await redis.del(secretKey(secretId), eventsKey(secretId));
}
