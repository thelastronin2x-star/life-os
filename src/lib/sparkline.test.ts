import { describe, expect, it } from "vitest";
import { sparklinePoints } from "./sparkline";

describe("sparklinePoints", () => {
  it("returns an empty string for no values", () => {
    expect(sparklinePoints([], 100, 20)).toBe("");
  });

  it("draws a flat middle line for a single value", () => {
    expect(sparklinePoints([42], 100, 20)).toBe("0,10 100,10");
  });

  it("draws a flat middle line when every value is identical", () => {
    expect(sparklinePoints([5, 5, 5], 100, 20)).toBe("0,10 100,10");
  });

  it("maps min to the bottom and max to the top, within padding", () => {
    const points = sparklinePoints([0, 10], 100, 20, 3);
    const [first, last] = points.split(" ");
    expect(first).toBe("0.00,17.00");
    expect(last).toBe("100.00,3.00");
  });

  it("spaces x coordinates evenly across the width", () => {
    const points = sparklinePoints([1, 2, 3, 4], 90, 20).split(" ");
    const xs = points.map((p) => parseFloat(p.split(",")[0]));
    expect(xs).toEqual([0, 30, 60, 90]);
  });
});
