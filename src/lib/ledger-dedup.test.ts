import { describe, expect, it } from "vitest";
import { dedupKeyFor } from "./ledger-dedup";

describe("dedupKeyFor", () => {
  it("splits a provider-prefixed externalId into source and id", () => {
    expect(dedupKeyFor({ id: "local-1", externalId: "monobank:abc123" })).toEqual({
      source: "monobank",
      externalId: "abc123",
    });
  });

  it("uses the transaction's own local id as the key for a manual entry with no externalId", () => {
    expect(dedupKeyFor({ id: "local-42", externalId: undefined })).toEqual({
      source: "manual-local",
      externalId: "local-42",
    });
  });

  it("stays stable across repeated calls for the same manual transaction (idempotency)", () => {
    const t = { id: "local-42", externalId: undefined };
    expect(dedupKeyFor(t)).toEqual(dedupKeyFor(t));
  });

  it("falls back to 'unknown' source for a malformed externalId with no colon", () => {
    expect(dedupKeyFor({ id: "local-1", externalId: "justanid" })).toEqual({
      source: "unknown",
      externalId: "justanid",
    });
  });

  it("gives two different manual transactions two different keys", () => {
    const a = dedupKeyFor({ id: "local-1", externalId: undefined });
    const b = dedupKeyFor({ id: "local-2", externalId: undefined });
    expect(a).not.toEqual(b);
  });

  it("handles a colon appearing inside the id portion (splits only on the first colon)", () => {
    expect(dedupKeyFor({ id: "local-1", externalId: "monobank:abc:123" })).toEqual({
      source: "monobank",
      externalId: "abc:123",
    });
  });
});
