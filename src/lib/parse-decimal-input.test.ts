import { describe, expect, it } from "vitest";
import { parseDecimalInput } from "./parse-decimal-input";

describe("parseDecimalInput", () => {
  it("parses a plain integer", () => {
    expect(parseDecimalInput("1842")).toBe(1842);
  });

  it("parses a period-separated decimal", () => {
    expect(parseDecimalInput("1.0842")).toBe(1.0842);
  });

  it("parses a comma-separated decimal — the Ukrainian keyboard case", () => {
    expect(parseDecimalInput("1,0842")).toBe(1.0842);
  });

  it("parses a negative comma-separated decimal", () => {
    expect(parseDecimalInput("-1,5")).toBe(-1.5);
  });

  it("parses a leading-dot decimal", () => {
    expect(parseDecimalInput(",5")).toBe(0.5);
    expect(parseDecimalInput(".5")).toBe(0.5);
  });

  it("parses a trailing-dot decimal", () => {
    expect(parseDecimalInput("5,")).toBe(5);
    expect(parseDecimalInput("5.")).toBe(5);
  });

  it("returns null for empty input", () => {
    expect(parseDecimalInput("")).toBeNull();
    expect(parseDecimalInput("   ")).toBeNull();
  });

  it("returns null for a lone minus or separator", () => {
    expect(parseDecimalInput("-")).toBeNull();
    expect(parseDecimalInput(",")).toBeNull();
    expect(parseDecimalInput(".")).toBeNull();
  });

  it("returns null for non-numeric garbage, including trailing junk", () => {
    expect(parseDecimalInput("abc")).toBeNull();
    expect(parseDecimalInput("1.5abc")).toBeNull();
    expect(parseDecimalInput("1,5,2")).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(parseDecimalInput("  1,5  ")).toBe(1.5);
  });
});
