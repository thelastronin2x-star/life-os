import { describe, expect, it } from "vitest";
import { buildTranslateUserMessage, parseTranslateResponse } from "./translate-normalize";

describe("buildTranslateUserMessage", () => {
  it("serializes headline/summary, defaulting missing summary to null", () => {
    const json = buildTranslateUserMessage([{ headline: "Fed hikes rates" }, { headline: "Oil drops", summary: "Details" }]);
    expect(JSON.parse(json)).toEqual([
      { headline: "Fed hikes rates", summary: null },
      { headline: "Oil drops", summary: "Details" },
    ]);
  });
});

describe("parseTranslateResponse", () => {
  it("parses a well-formed JSON array response", () => {
    const text = '[{"headline":"ФРС підвищує ставки","summary":"Деталі"}]';
    expect(parseTranslateResponse(text, 1)).toEqual([{ headline: "ФРС підвищує ставки", summary: "Деталі" }]);
  });

  it("tolerates surrounding prose around the JSON array", () => {
    const text = 'Ось переклад:\n[{"headline":"Заголовок","summary":null}]\nГотово.';
    expect(parseTranslateResponse(text, 1)).toEqual([{ headline: "Заголовок", summary: undefined }]);
  });

  it("returns null when the array length doesn't match", () => {
    const text = '[{"headline":"Тільки один"}]';
    expect(parseTranslateResponse(text, 2)).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    expect(parseTranslateResponse("not json at all", 1)).toBeNull();
  });

  it("returns null when an entry is missing a headline", () => {
    const text = '[{"summary":"немає заголовка"}]';
    expect(parseTranslateResponse(text, 1)).toBeNull();
  });
});
