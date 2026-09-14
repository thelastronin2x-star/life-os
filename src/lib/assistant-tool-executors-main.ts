"use client";

import { executeCalendarTool } from "./assistant-tool-executors-calendar";
import { executeHealthTool } from "./assistant-tool-executors-health";
import { executeWorkTool } from "./assistant-tool-executors-work";
import { executeFinanceTool } from "./assistant-tool-executors-finance";
import { executeAutomationTool } from "./assistant-tool-executors-automation";

const CALENDAR_NAMES = new Set(["create_event", "move_event", "delete_event"]);
const HEALTH_NAMES = new Set([
  "add_water",
  "log_wellbeing",
  "toggle_body_zone",
  "log_activity",
  "increment_habit",
  "toggle_medication_done",
  "start_sleep",
  "end_sleep",
]);
const WORK_NAMES = new Set(["calc_risk", "set_risk_limit"]);
const FINANCE_NAMES = new Set(["update_budget_limit", "move_budget", "create_budget_category"]);
const AUTOMATION_NAMES = new Set(["create_automation_rule"]);

/** Single dispatcher for the assistant-main scope, which merges every other
 *  scope's tools (minus prepare_trade_draft, see assistant-tools.ts) into
 *  one set — every real name across all five scopes is unique, so this is a
 *  plain name lookup rather than needing the caller to track which scope a
 *  tool call came from. Used both by the dialogue-flow's tap/free-text
 *  execution and by ProactiveCard's "repeat the same action" (see
 *  /assistant/page.tsx). */
export function executeAssistantMainTool(name: string, input: Record<string, unknown>): string {
  if (CALENDAR_NAMES.has(name)) return executeCalendarTool(name, input);
  if (HEALTH_NAMES.has(name)) return executeHealthTool(name, input);
  if (WORK_NAMES.has(name)) return executeWorkTool(name, input, { onDraftTrade: () => undefined });
  if (FINANCE_NAMES.has(name)) return executeFinanceTool(name, input);
  if (AUTOMATION_NAMES.has(name)) return executeAutomationTool(name, input);
  return `Невідомий інструмент: ${name}.`;
}
