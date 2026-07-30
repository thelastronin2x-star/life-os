import { describe, expect, it } from "vitest";
import { median } from "./stats";

describe("median", () => {
  it("returns the middle value for an odd-length array", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("averages the two middle values for an even-length array", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("is resistant to a single large outlier, unlike the average", () => {
    const daily = [50, 55, 60, 45, 3000];
    expect(median(daily)).toBe(55);
  });

  it("returns 0 for an empty array", () => {
    expect(median([])).toBe(0);
  });

  it("does not mutate the input array", () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});
