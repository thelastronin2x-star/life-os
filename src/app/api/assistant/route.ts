import { NextRequest, NextResponse } from "next/server";
import { selectModel } from "@/lib/model-router";
import { ASSISTANT_BASE_PROMPT, SCOPE_PROMPTS } from "@/lib/assistant-prompts";
import { TOOLS_BY_SCOPE, type ToolScope } from "@/lib/assistant-tools";
import type { AssistantApiRequest, AssistantApiResponse } from "@/lib/assistant-api-types";

function isToolScope(scope: string | undefined): scope is ToolScope {
  return scope === "calendar" || scope === "health" || scope === "work";
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "assistant_not_configured" }, { status: 500 });
  }

  const body = (await request.json()) as AssistantApiRequest;
  const messages = body.messages ?? [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "empty_messages" }, { status: 400 });
  }

  const scopePrompt = body.scope && body.scope in SCOPE_PROMPTS ? SCOPE_PROMPTS[body.scope] : ASSISTANT_BASE_PROMPT;
  const system = body.context ? `${scopePrompt}\n\n${body.context}` : scopePrompt;
  const model = selectModel(body.taskType);

  // Tools only ever matter for the interactive chat turn (BubbleShell's tool
  // loop) — "quick-insight"/"report"/"categorization" calls never look at
  // toolCalls in the response, so attaching tools there was dead weight at
  // best and, at worst, an unused-scope quirk (a passive insight generation
  // could still decide to call create_event with nothing to execute it).
  const isChat = body.taskType === "chat";
  const tools = isChat && isToolScope(body.scope) ? TOOLS_BY_SCOPE[body.scope] : undefined;

  // Non-chat calls never carry tools, so they're free to stream — that's
  // exactly the passive-insight path this exists for. The chat/tool-loop
  // path stays non-streaming JSON: BubbleShell needs the structured
  // {text, toolCalls} shape to drive its tool round-trips, which doesn't
  // mix with incremental SSE text deltas.
  if (!isChat) {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      }),
    });

    if (!anthropicRes.ok || !anthropicRes.body) {
      const details = await anthropicRes.text().catch(() => "");
      return NextResponse.json({ error: "anthropic_request_failed", details }, { status: 502 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = anthropicRes.body!.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                controller.enqueue(encoder.encode(parsed.delta.text as string));
              }
            } catch {
              // ignore malformed / keep-alive SSE lines
            }
          }
        }
        controller.close();
      },
    });

    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...(tools && tools.length > 0 ? { tools } : {}),
    }),
  });

  if (!anthropicRes.ok) {
    const details = await anthropicRes.text().catch(() => "");
    return NextResponse.json({ error: "anthropic_request_failed", details }, { status: 502 });
  }

  const data = await anthropicRes.json();
  const blocks: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[] =
    data.content ?? [];

  const text = blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();

  const toolCalls = blocks
    .filter((b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } => b.type === "tool_use")
    .map((b) => ({ id: b.id, name: b.name, input: b.input }));

  const response: AssistantApiResponse = { text, toolCalls };
  return NextResponse.json(response);
}
