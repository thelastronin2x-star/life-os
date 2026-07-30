import { describe, expect, it } from "vitest";
import { clampRingPercent } from "./ring-math";

describe("clampRingPercent", () => {
  it("passes through a normal in-range percent", () => {
    expect(clampRingPercent(42)).toBe(42);
  });

  it("clamps NaN (e.g. 0/0, a goal or limit of exactly 0) to 0", () => {
    expect(clampRingPercent(0 / 0)).toBe(0);
  });

  it("clamps +Infinity (e.g. a positive contributed against a 0 target) to 100", () => {
    expect(clampRingPercent(1 / 0)).toBe(100);
  });

  it("clamps -Infinity to 0", () => {
    expect(clampRingPercent(-1 / 0)).toBe(0);
  });

  it("clamps negative values to 0", () => {
    expect(clampRingPercent(-50)).toBe(0);
  });

  it("clamps values over 100 to 100", () => {
    expect(clampRingPercent(250)).toBe(100);
  });

  it("treats exactly 0 and 100 as already valid", () => {
    expect(clampRingPercent(0)).toBe(0);
    expect(clampRingPercent(100)).toBe(100);
  });
});
