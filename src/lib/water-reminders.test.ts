import { describe, expect, it } from "vitest";
import { computeReminderTimes, shouldSkipReminder, minutesOfHHMM } from "./water-reminders";

describe("computeReminderTimes", () => {
  it("returns [] for 0 reminders", () => {
    expect(computeReminderTimes(0, "09:00", "22:00")).toEqual([]);
  });

  it("returns [] for an inverted or empty window", () => {
    expect(computeReminderTimes(5, "22:00", "09:00")).toEqual([]);
    expect(computeReminderTimes(5, "09:00", "09:00")).toEqual([]);
  });

  it("spaces reminders evenly, matching the prompt's own worked example", () => {
    // 09:00-22:00 = 780 min, / 6 = 130 min interval -> 11:10, 13:20, 15:30, 17:40, 19:50
    expect(computeReminderTimes(5, "09:00", "22:00")).toEqual(["11:10", "13:20", "15:30", "17:40", "19:50"]);
  });

  it("never lands exactly on either boundary", () => {
    const times = computeReminderTimes(3, "09:00", "22:00");
    expect(times[0]).not.toBe("09:00");
    expect(times[times.length - 1]).not.toBe("22:00");
  });

  it("handles a single reminder as the window midpoint", () => {
    expect(computeReminderTimes(1, "10:00", "14:00")).toEqual(["12:00"]);
  });
});

describe("shouldSkipReminder", () => {
  it("does not skip at the first real reminder slot with nothing drunk yet", () => {
    // computeReminderTimes never lands exactly on the boundary, so the
    // earliest a reminder actually fires is somewhat after activeStart —
    // expectedByNow is small but nonzero, and 0ml is already behind it.
    expect(shouldSkipReminder(0, 2000, minutesOfHHMM("11:10"), "09:00", "22:00")).toBe(false);
  });

  it("skips exactly at the boundary where 0 drunk still meets 0 expected", () => {
    // A pure edge case of the formula (0 >= 0) that real reminder slots
    // never actually hit, since they're never scheduled on the boundary.
    expect(shouldSkipReminder(0, 2000, minutesOfHHMM("09:00"), "09:00", "22:00")).toBe(true);
  });

  it("skips once intake already matches or exceeds the pace-adjusted expectation", () => {
    // Halfway through the window (09:00-22:00 -> 15:30), half the goal is expected.
    expect(shouldSkipReminder(1000, 2000, minutesOfHHMM("15:30"), "09:00", "22:00")).toBe(true);
    expect(shouldSkipReminder(999, 2000, minutesOfHHMM("15:30"), "09:00", "22:00")).toBe(false);
  });

  it("does not skip when behind pace", () => {
    expect(shouldSkipReminder(100, 2000, minutesOfHHMM("19:50"), "09:00", "22:00")).toBe(false);
  });

  it("never skips with no goal set", () => {
    expect(shouldSkipReminder(5000, 0, minutesOfHHMM("12:00"), "09:00", "22:00")).toBe(false);
  });

  it("does not skip for an inverted window", () => {
    expect(shouldSkipReminder(5000, 2000, minutesOfHHMM("12:00"), "22:00", "09:00")).toBe(false);
  });
});
