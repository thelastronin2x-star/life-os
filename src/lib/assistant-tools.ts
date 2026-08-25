/** Anthropic tool-use schemas, grouped by assistant scope. Pure data — no
 *  side effects here, execution lives in assistant-tool-executors.ts (which
 *  needs "use client" to touch the Zustand stores; this file doesn't). */

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const CALENDAR_TOOLS: ToolDefinition[] = [
  {
    name: "create_event",
    description: "Створює нову подію в календарі.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Назва події" },
        date: { type: "string", description: "Дата у форматі YYYY-MM-DD" },
        time: { type: "string", description: "Час у форматі HH:MM, якщо вказаний" },
        category: { type: "string", enum: ["personal", "work"], description: "Категорія, за замовчуванням personal" },
      },
      required: ["title", "date"],
    },
  },
  {
    name: "move_event",
    description: "Переносить наявну подію на іншу дату і/або час. Назва й дата мають точно збігатися з подією з контексту.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Точна назва події з контексту" },
        fromDate: { type: "string", description: "Поточна дата події, YYYY-MM-DD" },
        toDate: { type: "string", description: "Нова дата, YYYY-MM-DD" },
        toTime: { type: "string", description: "Новий час HH:MM, якщо міняється" },
      },
      required: ["title", "fromDate", "toDate"],
    },
  },
  {
    name: "delete_event",
    description: "Видаляє подію з календаря. Назва й дата мають точно збігатися з подією з контексту.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Точна назва події з контексту" },
        date: { type: "string", description: "Дата події, YYYY-MM-DD" },
      },
      required: ["title", "date"],
    },
  },
];

const HEALTH_TOOLS: ToolDefinition[] = [
  {
    name: "add_water",
    description: "Додає випиту воду до сьогоднішнього обсягу.",
    input_schema: {
      type: "object",
      properties: { ml: { type: "number", description: "Кількість мілілітрів" } },
      required: ["ml"],
    },
  },
  {
    name: "log_wellbeing",
    description: "Записує загальне самопочуття на сьогодні.",
    input_schema: {
      type: "object",
      properties: {
        feeling: {
          type: "string",
          enum: ["Погано", "Так собі", "Добре", "Дуже добре", "Чудово"],
          description: "Один із 5 рівнів загального відчуття",
        },
        note: { type: "string", description: "Необов'язкова нотатка" },
      },
      required: ["feeling"],
    },
  },
  {
    name: "toggle_body_zone",
    description: "Додає або прибирає зону тіла із самопочуттям на сьогодні.",
    input_schema: {
      type: "object",
      properties: { zone: { type: "string", description: "Назва зони, напр. 'Голова', 'Живіт', 'Спина / руки'" } },
      required: ["zone"],
    },
  },
  {
    name: "log_activity",
    description: "Записує сьогоднішнє тренування.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Тип активності, напр. 'Біг'" },
        minutes: { type: "number", description: "Тривалість у хвилинах" },
      },
      required: ["type", "minutes"],
    },
  },
  {
    name: "increment_habit",
    description: "Збільшує сьогоднішній лічильник звички на 1.",
    input_schema: {
      type: "object",
      properties: { habitName: { type: "string", description: "Назва звички, напр. 'Кава'" } },
      required: ["habitName"],
    },
  },
  {
    name: "toggle_medication_done",
    description: "Позначає прийом ліків/добавки виконаним або невиконаним на сьогодні.",
    input_schema: {
      type: "object",
      properties: { medName: { type: "string", description: "Назва ліків з контексту" } },
      required: ["medName"],
    },
  },
  {
    name: "start_sleep",
    description: "Починає відлік сну (користувач ліг спати зараз).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "end_sleep",
    description: "Завершує поточний сон (користувач прокинувся зараз).",
    input_schema: { type: "object", properties: {} },
  },
];

const WORK_TOOLS: ToolDefinition[] = [
  {
    name: "prepare_trade_draft",
    description: "Відкриває форму нової угоди з передзаповненими полями. Не зберігає угоду — тільки готує чернетку.",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Символ інструменту, напр. 'GBPUSD'" },
        direction: { type: "string", enum: ["LONG", "SHORT"] },
        entry: { type: "number" },
        stop: { type: "number" },
        take: { type: "number", description: "Ціль, якщо вказана" },
        lot: { type: "number", description: "Обсяг лота, якщо вказаний" },
      },
      required: ["symbol", "direction", "entry", "stop"],
    },
  },
  {
    name: "calc_risk",
    description: "Рахує співвідношення ризик/прибуток (R:R) для заданих рівнів угоди.",
    input_schema: {
      type: "object",
      properties: {
        entry: { type: "number" },
        stop: { type: "number" },
        take: { type: "number" },
      },
      required: ["entry", "stop", "take"],
    },
  },
];

export const TOOLS_BY_SCOPE = {
  calendar: CALENDAR_TOOLS,
  health: HEALTH_TOOLS,
  work: WORK_TOOLS,
} as const;

export type ToolScope = keyof typeof TOOLS_BY_SCOPE;
