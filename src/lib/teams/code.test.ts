import { describe, expect, it } from "vitest";
import { generateTeamCode, normalizeTeamCode, teamAvatarInitials } from "./code";

describe("generateTeamCode", () => {
  it("generates a 6-char code from the deterministic alphabet, excluding ambiguous chars", () => {
    const code = generateTeamCode(() => 0);
    expect(code).toHaveLength(6);
    expect(code).not.toMatch(/[01OIL]/);
  });

  it("varies with the random source", () => {
    const codeA = generateTeamCode(() => 0);
    const codeB = generateTeamCode(() => 0.99);
    expect(codeA).not.toBe(codeB);
  });
});

describe("normalizeTeamCode", () => {
  it("trims, uppercases, and strips internal whitespace", () => {
    expect(normalizeTeamCode(" k7q x9m \n")).toBe("K7QX9M");
  });
});

describe("teamAvatarInitials", () => {
  it("uses first two letters of a single-word name", () => {
    expect(teamAvatarInitials("Економ-24")).toBe("ЕК");
  });

  it("uses first letter of first two words for a multi-word name", () => {
    expect(teamAvatarInitials("Нічні бики")).toBe("НБ");
  });

  it("returns a placeholder for an empty name", () => {
    expect(teamAvatarInitials("   ")).toBe("??");
  });
});
