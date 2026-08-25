"use client";

import type { AssistantTaskType } from "./model-router";
import type { AssistantApiMessage, AssistantApiResponse, AssistantScopeParam } from "./assistant-api-types";

/** Just the HTTP call — deliberately has zero store imports. Every scoped
 *  bubble and Home's global insight import this, so any store it touched
 *  would leak into every page's bundle regardless of scope. Context-building
 *  (which DOES need stores) lives in the per-domain assistant-context-*.ts
 *  files instead. */

/** Streams a single-turn, no-tools reply (insight/report/categorization —
 *  never "chat", which needs the structured tool_calls shape from
 *  callAssistantTurn instead and is never streamed). `onChunk` fires with
 *  the accumulated text so far on every SSE chunk — the caller decides
 *  whether that means "repaint the message live" or "ignore until done."
 *  Resolves with the final full text either way, for writing into the
 *  insight cache. */
export async function streamAssistantOnce(
  userPrompt: string,
  context: string,
  taskType: AssistantTaskType,
  scope: AssistantScopeParam | undefined,
  onChunk?: (accumulated: string) => void
): Promise<string> {
  const res = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: userPrompt }], context, taskType, scope }),
  });
  if (!res.ok || !res.body) {
    throw new Error("assistant_request_failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let acc = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    acc += decoder.decode(value, { stream: true });
    onChunk?.(acc);
  }
  return acc.trim();
}

/** Same call, without the incremental callback — for callers (reports.ts)
 *  that only want the final text. */
export async function callAssistantOnce(
  userPrompt: string,
  context: string,
  taskType: AssistantTaskType,
  scope?: AssistantScopeParam
): Promise<string> {
  return streamAssistantOnce(userPrompt, context, taskType, scope);
}

/** The full non-streaming response (text + any tool_use requests) for a
 *  single turn — what a scoped bubble's tool loop drives repeatedly,
 *  appending the assistant's tool_use turn and a user tool_result turn
 *  between calls. See BubbleShell.tsx. Only ever called with
 *  taskType: "chat" — that's the one path the API still answers as JSON. */
export async function callAssistantTurn(
  messages: AssistantApiMessage[],
  context: string,
  taskType: AssistantTaskType,
  scope?: AssistantScopeParam
): Promise<AssistantApiResponse> {
  const res = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context, taskType, scope }),
  });
  if (!res.ok) {
    throw new Error("assistant_request_failed");
  }
  return (await res.json()) as AssistantApiResponse;
}
