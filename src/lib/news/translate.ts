import "server-only";
import { selectModel } from "@/lib/model-router";
import type { NewsItem } from "./types";
import { buildTranslateSystemPrompt, buildTranslateUserMessage, parseTranslateResponse } from "./translate-normalize";

/** Translates headline+summary to Ukrainian via one batched, non-streaming
 *  Claude call (direct fetch — same pattern as /api/assistant/route.ts's
 *  non-chat branch), on the cheap model tier since this is a repetitive,
 *  high-volume, low-complexity task. Always returns something usable: on a
 *  missing key, HTTP failure, or malformed/misaligned response, it falls
 *  back to the original English items unchanged rather than throwing —
 *  this runs inside an hourly cron job that must never fail over a
 *  translation hiccup. */
export async function translateNewsItems(items: NewsItem[]): Promise<NewsItem[]> {
  if (items.length === 0) return items;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return items;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: selectModel("categorization"),
        max_tokens: 4096,
        system: buildTranslateSystemPrompt(),
        messages: [{ role: "user", content: buildTranslateUserMessage(items) }],
      }),
    });
    if (!res.ok) return items;

    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("");

    const translated = parseTranslateResponse(text, items.length);
    if (!translated) return items;

    return items.map((item, i) => ({
      ...item,
      headline: translated[i].headline,
      summary: translated[i].summary,
    }));
  } catch {
    return items;
  }
}
