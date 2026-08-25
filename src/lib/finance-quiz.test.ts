import { describe, expect, it } from "vitest";
import { pickQuizQuestions, quizStatus, FINANCIAL_LITERACY_QUESTIONS, type QuizQuestion } from "./finance-quiz";
import type { QuizAttempt } from "./finance-store";

function attempt(scorePct: number): QuizAttempt {
  return { id: "a1", date: "2026-08-01", answers: [], scorePct };
}

describe("pickQuizQuestions", () => {
  it("returns the requested count", () => {
    expect(pickQuizQuestions(FINANCIAL_LITERACY_QUESTIONS, 3)).toHaveLength(3);
  });

  it("returns the whole bank when count >= bank size", () => {
    const picked = pickQuizQuestions(FINANCIAL_LITERACY_QUESTIONS, 5);
    expect(picked).toHaveLength(5);
    expect(new Set(picked.map((q) => q.id))).toEqual(new Set(FINANCIAL_LITERACY_QUESTIONS.map((q) => q.id)));
  });

  it("draws a real subset from a larger bank", () => {
    const bigBank: QuizQuestion[] = Array.from({ length: 10 }, (_, i) => ({
      id: `q${i}`,
      prompt: "p",
      options: [{ id: "a", text: "a" }],
      correctOptionId: "a",
      explanation: "e",
    }));
    const picked = pickQuizQuestions(bigBank, 5);
    expect(picked).toHaveLength(5);
    expect(new Set(picked.map((q) => q.id)).size).toBe(5); // no duplicates
  });
});

describe("quizStatus", () => {
  it("is bad with no attempt", () => {
    expect(quizStatus(null)).toBe("bad");
  });
  it.each([
    [80, "good"],
    [100, "good"],
    [60, "warn"],
    [79, "warn"],
    [59, "bad"],
    [0, "bad"],
  ])("classifies score %s as %s", (score, status) => {
    expect(quizStatus(attempt(score as number))).toBe(status);
  });
});
