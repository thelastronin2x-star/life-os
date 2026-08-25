import { describe, expect, it } from "vitest";
import { initialSm2State, reviewSm2, addDays, REVIEW_QUALITY } from "./sm2";

describe("reviewSm2", () => {
  it("schedules 1 day, then 6 days, then ease-scaled intervals on successive easy reviews", () => {
    let state = initialSm2State();
    state = reviewSm2(state, REVIEW_QUALITY.easy);
    expect(state.repetitions).toBe(1);
    expect(state.intervalDays).toBe(1);

    state = reviewSm2(state, REVIEW_QUALITY.easy);
    expect(state.repetitions).toBe(2);
    expect(state.intervalDays).toBe(6);

    state = reviewSm2(state, REVIEW_QUALITY.easy);
    expect(state.repetitions).toBe(3);
    expect(state.intervalDays).toBeGreaterThan(6);
  });

  it("resets repetitions and drops to a 1-day interval on 'again'", () => {
    let state = initialSm2State();
    state = reviewSm2(state, REVIEW_QUALITY.easy);
    state = reviewSm2(state, REVIEW_QUALITY.easy);
    expect(state.repetitions).toBe(2);

    state = reviewSm2(state, REVIEW_QUALITY.again);
    expect(state.repetitions).toBe(0);
    expect(state.intervalDays).toBe(1);
  });

  it("never lets ease factor drop below the 1.3 floor", () => {
    let state = initialSm2State();
    for (let i = 0; i < 20; i++) {
      state = reviewSm2(state, REVIEW_QUALITY.again);
    }
    expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("grows ease factor on repeated easy reviews", () => {
    let state = initialSm2State();
    for (let i = 0; i < 5; i++) {
      state = reviewSm2(state, REVIEW_QUALITY.easy);
    }
    expect(state.easeFactor).toBeGreaterThan(2.5);
  });
});

describe("addDays", () => {
  it("adds days across a month boundary", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
  });

  it("supports zero (same day)", () => {
    expect(addDays("2026-03-15", 0)).toBe("2026-03-15");
  });
});
