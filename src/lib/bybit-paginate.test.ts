import { describe, expect, it } from "vitest";
import { fetchAllPages } from "./bybit-paginate";

// Shaped like a real /v5/position/closed-pnl list item — only the fields
// this pagination logic actually touches (list, nextPageCursor) matter here.
interface Item {
  orderId: string;
}

describe("fetchAllPages", () => {
  it("returns everything from a single page when nextPageCursor is absent", async () => {
    const page = { list: [{ orderId: "1" }, { orderId: "2" }] };
    const fetchPage = async () => page;

    const items = await fetchAllPages<Item>(fetchPage, 50);
    expect(items).toEqual(page.list);
  });

  it("follows nextPageCursor across multiple pages and concatenates in order", async () => {
    const pages: Record<string, { list: Item[]; nextPageCursor?: string }> = {
      start: { list: [{ orderId: "1" }, { orderId: "2" }], nextPageCursor: "cursor-a" },
      "cursor-a": { list: [{ orderId: "3" }], nextPageCursor: "cursor-b" },
      "cursor-b": { list: [{ orderId: "4" }] }, // no cursor — last page, matching Bybit's real response shape
    };
    const seenCursors: (string | undefined)[] = [];
    const fetchPage = async (cursor: string | undefined) => {
      seenCursors.push(cursor);
      return pages[cursor ?? "start"];
    };

    const items = await fetchAllPages<Item>(fetchPage, 50);
    expect(items.map((i) => i.orderId)).toEqual(["1", "2", "3", "4"]);
    expect(seenCursors).toEqual([undefined, "cursor-a", "cursor-b"]);
  });

  it("treats an empty-string nextPageCursor the same as absent — Bybit's own \"no more pages\" signal", async () => {
    const fetchPage = async () => ({ list: [{ orderId: "1" }], nextPageCursor: "" });

    const items = await fetchAllPages<Item>(fetchPage, 50);
    expect(items).toHaveLength(1);
  });

  it("stops at maxPages if the API keeps returning a cursor forever, instead of looping forever", async () => {
    let calls = 0;
    const fetchPage = async () => {
      calls += 1;
      return { list: [{ orderId: String(calls) }], nextPageCursor: "always-more" };
    };

    const items = await fetchAllPages<Item>(fetchPage, 3);
    expect(items).toHaveLength(3);
    expect(calls).toBe(3);
  });

  it("returns an empty array when the first page itself has an empty list", async () => {
    const fetchPage = async () => ({ list: [] });

    const items = await fetchAllPages<Item>(fetchPage, 50);
    expect(items).toEqual([]);
  });
});
