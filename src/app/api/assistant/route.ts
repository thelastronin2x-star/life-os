import { NextRequest, NextResponse } from "next/server";
import { selectModel } from "@/lib/model-router";

const SYSTEM_PROMPT =
  "Ти — AI-асистент у застосунку \"0.0 / Life OS\", персональному помічнику для планування дня, фінансів і трейдингу. Відповідай українською мовою, стисло і по суті, у дружньому тоні. Не використовуй markdown-розмітку (без **, ##, -, нумерованих списків тощо) — тільки звичайний текст, оскільки він показується без рендерингу. Якщо контекст нижче показує, що даних немає або їх недостатньо (порожній журнал угод, немає транзакцій, немає подій) — чесно скажи, що даних ще замало для інсайтів чи статистики, і запропонуй почати їх вносити. Ніколи не вигадуй цифри, тренди чи патерни, яких немає в наданому контексті.";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "assistant_not_configured" }, { status: 500 });
  }

  const body = (await request.json()) as { messages?: IncomingMessage[]; context?: string; taskType?: string };
  const messages = body.messages ?? [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "empty_messages" }, { status: 400 });
  }

  const system = body.context ? `${SYSTEM_PROMPT}\n\n${body.context}` : SYSTEM_PROMPT;
  const model = selectModel(body.taskType);

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

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
