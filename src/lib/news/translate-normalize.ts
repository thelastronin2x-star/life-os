/** Pure prompt-building/response-parsing for news translation, kept out of
 *  the `server-only` translate.ts (which does the actual fetch() call) — same
 *  split as alpha-vantage-normalize.ts/alpha-vantage-provider.ts. */

export interface TranslatableFields {
  headline: string;
  summary?: string;
}

export function buildTranslateSystemPrompt(): string {
  return (
    "Перекладай фінансові новини з англійської на українську мову. " +
    'Тобі дають JSON-масив об\'єктів {"headline": string, "summary": string | null}. ' +
    "Поверни ТІЛЬКИ JSON-масив тієї самої довжини і в тому самому порядку, де кожен об'єкт " +
    "має ті самі поля headline/summary, перекладені українською. " +
    "Зберігай тікери, числа, назви компаній та валют без змін. " +
    "Не додавай жодного тексту до або після JSON-масиву."
  );
}

export function buildTranslateUserMessage(items: TranslatableFields[]): string {
  return JSON.stringify(items.map((item) => ({ headline: item.headline, summary: item.summary ?? null })));
}

/** Parses Claude's response back into the same shape/order it was given.
 *  Returns null on ANY malformed, mismatched-length, or unexpected-shape
 *  response so the caller can fall back to the original (untranslated) text
 *  rather than caching garbage. */
export function parseTranslateResponse(text: string, expectedCount: number): TranslatableFields[] | null {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length !== expectedCount) return null;

  const result: TranslatableFields[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null || typeof (entry as { headline?: unknown }).headline !== "string") {
      return null;
    }
    const summary = (entry as { summary?: unknown }).summary;
    result.push({
      headline: (entry as { headline: string }).headline,
      summary: typeof summary === "string" ? summary : undefined,
    });
  }
  return result;
}
