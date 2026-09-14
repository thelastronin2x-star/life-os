"use client";

import { useAutomationsStore } from "./automations-store";

export function executeAutomationTool(name: string, input: Record<string, unknown>): string {
  if (name === "create_automation_rule") {
    const text = String(input.text ?? "").trim();
    if (!text) return "Не вистачає опису правила.";
    useAutomationsStore.getState().addCustomRule(text);
    return `Правило збережено: "${text}".`;
  }

  return `Невідомий інструмент: ${name}.`;
}
