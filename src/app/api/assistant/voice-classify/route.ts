import { NextRequest, NextResponse } from "next/server";
import { selectModel } from "@/lib/model-router";
import type { VoiceClassifyResponse, VoiceClassifyResult } from "@/lib/voice-classify-types";

const ROUTE_TOOL = {
  name: "route_voice_command",
  description:
    "Визначає, до якого розділу застосунку належить сказане користувачем, яка конкретна дія малась на увазі, і витягує структуровані поля цієї дії.",
  input_schema: {
    type: "object" as const,
    properties: {
      section: {
        type: "string",
        enum: ["finance", "work", "calendar", "health"],
        description: "Фінанси / Робота (трейдинг) / Календар / Здоров'я",
      },
      action: {
        type: "string",
        description: "Коротка машинна назва дії, напр. add_expense, add_trade, add_event, log_water, log_weight, log_mood",
      },
      confidence: {
        type: "number",
        description: "Впевненість класифікації від 0 до 1",
      },
      title: {
        type: "string",
        description: "Короткий людський підпис того, що сталося — показується користувачу як назва картки",
      },
      amount: { type: "number", description: "Сума грошей, якщо йдеться про фінанси" },
      categoryName: { type: "string", description: "Назва категорії витрат/доходу, якщо можна визначити" },
      instrumentSymbol: { type: "string", description: "Символ інструмента, напр. EUR/USD, якщо йдеться про угоду" },
      direction: { type: "string", enum: ["LONG", "SHORT"], description: "Напрямок угоди, якщо йдеться про трейдинг" },
      date: { type: "string", description: "Дата події у форматі YYYY-MM-DD, з урахуванням поточної дати нижче" },
      time: { type: "string", description: "Час у форматі HH:MM, якщо вказаний" },
      healthMetric: { type: "string", enum: ["water"], description: "Показник здоров'я, поки підтримується лише вода" },
      healthValue: { type: "number", description: "Кількість мілілітрів води" },
    },
    required: ["section", "action", "confidence", "title"],
  },
};

const SYSTEM_PROMPT = `Ти — диспетчер голосових команд застосунку "0.0 / Life OS". Користувач наговорив одну фразу українською. Твоя задача — викликати route_voice_command із визначеним розділом, дією та витягнутими полями.

Розділи:
- finance: витрата, дохід, переказ грошей
- work: нова угода в трейдинг-журналі
- calendar: нова подія чи зустріч
- health: випита вода (мл)

Якщо фраза явно ні до чого з цього не належить або зовсім незрозуміла — став confidence нижче 0.4.
Ніколи не вигадуй суму, дату чи інші деталі, яких немає у фразі — залишай поле відсутнім, а не вигаданим значенням.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "assistant_not_configured" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { transcript?: string; nowIso?: string } | null;
  const transcript = body?.transcript?.trim();
  if (!transcript) {
    return NextResponse.json({ error: "empty_transcript" }, { status: 400 });
  }
  const nowIso = body?.nowIso ?? new Date().toISOString();

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: selectModel("categorization"),
      max_tokens: 512,
      system: `${SYSTEM_PROMPT}\n\nПоточна дата й час: ${nowIso}`,
      messages: [{ role: "user", content: transcript }],
      tools: [ROUTE_TOOL],
      tool_choice: { type: "tool", name: "route_voice_command" },
    }),
  });

  if (!anthropicRes.ok) {
    const details = await anthropicRes.text().catch(() => "");
    return NextResponse.json({ error: "anthropic_request_failed", details }, { status: 502 });
  }

  const data = await anthropicRes.json();
  const blocks: { type: string; input?: Record<string, unknown> }[] = data.content ?? [];
  const toolBlock = blocks.find((b) => b.type === "tool_use");

  const result = (toolBlock?.input as VoiceClassifyResult | undefined) ?? null;
  const response: VoiceClassifyResponse = { heard: transcript, result };
  return NextResponse.json(response);
}
