export type AssistantTaskType = "quick-insight" | "chat" | "report" | "categorization";

const CHEAP_MODEL = "claude-haiku-4-5-20251001";
const POWERFUL_MODEL = "claude-sonnet-4-6";

const MODEL_BY_TASK: Record<AssistantTaskType, string> = {
  "quick-insight": CHEAP_MODEL,
  categorization: CHEAP_MODEL,
  chat: POWERFUL_MODEL,
  report: POWERFUL_MODEL,
};

/** Centralized model choice — short/frequent automatic tasks go to the cheap
 *  model, real conversations and reports keep the powerful one. An unknown
 *  or missing taskType falls back to the powerful model rather than silently
 *  downgrading a call we don't recognize. */
export function selectModel(taskType?: string): string {
  if (taskType && taskType in MODEL_BY_TASK) {
    return MODEL_BY_TASK[taskType as AssistantTaskType];
  }
  return POWERFUL_MODEL;
}
