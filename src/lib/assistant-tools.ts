/** Anthropic tool-use schemas, grouped by assistant scope. Pure data — no
 *  side effects here, execution lives in assistant-tool-executors.ts (which
 *  needs "use client" to touch the Zustand stores; this file doesn't). */

import { FINANCE_CATEGORY_KEYS } from "./finance-categories";

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
  {
    name: "set_risk_limit",
    description:
      "Змінює ліміт максимальної просадки (maxDrawdown, у %) для проп-акаунта. Використовуй лише для акаунта, точна назва фірми якого є в контексті.",
    input_schema: {
      type: "object",
      properties: {
        firm: { type: "string", description: "Точна назва фірми проп-акаунта з контексту" },
        newMaxDrawdown: { type: "number", description: "Новий ліміт максимальної просадки, у відсотках" },
      },
      required: ["firm", "newMaxDrawdown"],
    },
  },
];

const FINANCE_TOOLS: ToolDefinition[] = [
  {
    name: "update_budget_limit",
    description: "Змінює місячний ліміт наявної бюджетної категорії на нове значення.",
    input_schema: {
      type: "object",
      properties: {
        categoryName: { type: "string", description: "Точна назва категорії з контексту, напр. 'Одяг'" },
        newLimit: { type: "number", description: "Нове значення ліміту" },
      },
      required: ["categoryName", "newLimit"],
    },
  },
  {
    name: "move_budget",
    description:
      "Переносить суму ліміту з однієї наявної бюджетної категорії в іншу (зменшує ліміт джерела, збільшує ліміт цілі на ту саму суму). Обидві категорії мають вже існувати в контексті.",
    input_schema: {
      type: "object",
      properties: {
        fromCategoryName: { type: "string", description: "Категорія-джерело, точна назва з контексту" },
        toCategoryName: { type: "string", description: "Категорія-ціль, точна назва з контексту" },
        amount: { type: "number", description: "Сума перенесення" },
      },
      required: ["fromCategoryName", "toCategoryName", "amount"],
    },
  },
  {
    name: "create_budget_category",
    description: "Створює нову бюджетну категорію з місячним лімітом.",
    input_schema: {
      type: "object",
      properties: {
        categoryKey: {
          type: "string",
          enum: [...FINANCE_CATEGORY_KEYS],
          description: "Ключ категорії, що найкраще відповідає потрібній назві",
        },
        limit: { type: "number", description: "Початковий місячний ліміт" },
      },
      required: ["categoryKey", "limit"],
    },
  },
];

const AUTOMATION_TOOLS: ToolDefinition[] = [
  {
    name: "create_automation_rule",
    description: "Зберігає нове користувацьке правило автоматизації як текстовий запис.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string", description: "Опис правила простою мовою" } },
      required: ["text"],
    },
  },
];

/** Not scope-gated — always attached to the assistant-main tool set. See
 *  assistant-prompts.ts's ASSISTANT_MAIN_PROMPT for the protocol: the model
 *  calls present_options when it spots a real, contextually-backed problem
 *  instead of just describing it, and never calls a mutating tool on the
 *  same turn — execution only happens after the user picks one, driven
 *  entirely client-side (see /assistant/page.tsx). select_option is only
 *  ever sent with a forced tool_choice, for classifying free-text replies
 *  ("зроби перший") against a pending option set. */
const DIALOGUE_TOOLS: ToolDefinition[] = [
  {
    name: "present_options",
    description:
      "Використовуй, коли контекст показує РЕАЛЬНУ конкретну проблему (перевищення ліміту категорії, близькість до ліміту просадки тощо) — постав вибір замість того, щоб просто описати проблему текстом. Не виконуй жодну дію сам у цьому виклику.",
    input_schema: {
      type: "object",
      properties: {
        problemSummary: { type: "string", description: "Короткий опис проблеми з конкретними цифрами з контексту" },
        options: {
          type: "array",
          description: "Рівно 2-3 конкретні дії-варіанти, згенеровані з реальних чисел контексту. Нейтральний варіант 'показати все' додає застосунок сам, його вказувати не треба.",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Коротка назва дії з конкретними числами, напр. 'Перенести 320₴ з Розваг в Одяг'" },
              reasoning: { type: "string", description: "Чому саме ця сума/значення" },
              expectedResult: { type: "string", description: "Що конкретно зміниться після виконання" },
              tool: {
                type: "string",
                enum: ["update_budget_limit", "move_budget", "create_budget_category", "set_risk_limit", "create_automation_rule", "create_event"],
                description: "Інструмент, який виконає цю дію",
              },
              toolInput: { type: "object", description: "Аргументи для інструмента, що відповідають його схемі" },
            },
            required: ["label", "reasoning", "expectedResult", "tool", "toolInput"],
          },
        },
      },
      required: ["problemSummary", "options"],
    },
  },
  {
    name: "select_option",
    description: "Визначає, який із запропонованих варіантів користувач обрав своїми словами.",
    input_schema: {
      type: "object",
      properties: {
        optionIndex: {
          type: "number",
          description: "0-based індекс обраного варіанта серед наданих, або -1, якщо жоден не підходить чи повідомлення не про вибір",
        },
      },
      required: ["optionIndex"],
    },
  },
];

// prepare_trade_draft is deliberately left out of assistant-main — it opens
// a trade form via a callback that only exists on /work/journal (see
// WorkBubble's onDraftTrade); the full-page assistant has nowhere to render
// that form, so keeping the tool here would make the model promise
// something this page can't deliver.
const WORK_TOOLS_MAIN = WORK_TOOLS.filter((t) => t.name !== "prepare_trade_draft");

export const TOOLS_BY_SCOPE = {
  calendar: CALENDAR_TOOLS,
  health: HEALTH_TOOLS,
  work: WORK_TOOLS,
  "assistant-main": [...CALENDAR_TOOLS, ...HEALTH_TOOLS, ...WORK_TOOLS_MAIN, ...FINANCE_TOOLS, ...AUTOMATION_TOOLS, ...DIALOGUE_TOOLS],
} as const;

export type ToolScope = keyof typeof TOOLS_BY_SCOPE;
