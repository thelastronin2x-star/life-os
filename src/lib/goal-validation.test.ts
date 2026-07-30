import { describe, expect, it } from "vitest";
import { validateGoal } from "./goal-validation";

describe("validateGoal", () => {
  it("accepts a normal positive target and contributed", () => {
    expect(validateGoal(10000, 2500)).toBeNull();
  });

  it("accepts contributed = 0 (a freshly-started goal)", () => {
    expect(validateGoal(10000, 0)).toBeNull();
  });

  it("rejects target = 0", () => {
    expect(validateGoal(0, 0)).toBe("Ціль має бути більшою за нуль");
  });

  it("rejects a negative target", () => {
    expect(validateGoal(-500, 0)).toBe("Ціль має бути більшою за нуль");
  });

  it("rejects a negative contributed amount", () => {
    expect(validateGoal(10000, -100)).toBe("Накопичена сума не може бути від'ємною");
  });

  it("checks target before contributed when both are invalid", () => {
    expect(validateGoal(0, -100)).toBe("Ціль має бути більшою за нуль");
  });
});
