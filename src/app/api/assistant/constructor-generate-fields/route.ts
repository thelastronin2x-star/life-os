import { NextRequest, NextResponse } from "next/server";
import { selectModel } from "@/lib/model-router";

const GENERATE_FIELDS_TOOL = {
  name: "generate_schema_fields",
  description: "Перетворює вільний опис бажаної теми на структурований список полів.",
  input_schema: {
    type: "object" as const,
    properties: {
      fields: {
        type: "array",
        description: "Список полів теми, у розумному порядку заповнення",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Коротка назва поля" },
            type: {
              type: "string",
              enum: ["text", "longtext", "number", "select", "boolean", "scale10", "date", "checklist"],
              description:
                "text=короткий текст, longtext=довгий текст, number=число, select=список вибору (потрібні options), boolean=так/ні, scale10=шкала 1-10, date=дата, checklist=чеклист (потрібні options)",
            },
            required: { type: "boolean" },
            options: {
              type: "array",
              items: { type: "string" },
              description: "Тільки для select/checklist — варіанти вибору чи пункти чеклиста",
            },
          },
          required: ["name", "type", "required"],
        },
      },
    },
    required: ["fields"],
  },
};

const SYSTEM_PROMPT = `Ти допомагаєш користувачу застосунку "0.0 / Life OS" перетворити вільний опис власної теми відстеження на структурований список полів. Викликай generate_schema_fields з розумним набором полів (зазвичай 3-6), що покривають усе, що людина описала. Обирай найпростіший тип, що підходить (не роби все text, якщо є число, шкала чи вибір). Ніколи не вигадуй поля, яких людина не просила.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "assistant_not_configured" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { description?: string } | null;
  const description = body?.description?.trim();
  if (!description) {
    return NextResponse.json({ error: "empty_description" }, { status: 400 });
  }

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: selectModel("categorization"),
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: description }],
      tools: [GENERATE_FIELDS_TOOL],
      tool_choice: { type: "tool", name: "generate_schema_fields" },
    }),
  });

  if (!anthropicRes.ok) {
    const details = await anthropicRes.text().catch(() => "");
    return NextResponse.json({ error: "anthropic_request_failed", details }, { status: 502 });
  }

  const data = await anthropicRes.json();
  const blocks: { type: string; input?: Record<string, unknown> }[] = data.content ?? [];
  const toolBlock = blocks.find((b) => b.type === "tool_use");
  const fields = (toolBlock?.input?.fields as unknown[] | undefined) ?? [];

  return NextResponse.json({ fields });
}
