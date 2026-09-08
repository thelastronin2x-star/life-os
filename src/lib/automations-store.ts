"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Only the automations that actually run something real. The hub screen
 *  also lists a handful of not-yet-built ones (see AiAutomationsPage) —
 *  those render as fixed, disabled rows with no store-backed toggle at all,
 *  on purpose: a toggle that flips state but runs no logic behind it is
 *  exactly the "fake AI feature" this app avoids everywhere else (see
 *  ASSISTANT_BASE_PROMPT's "never invent numbers/patterns" rule and every
 *  correlation card on AI Аналітика, all backed by real per-user stats). */
export type AutomationId = "instant-warnings" | "retro-tagging" | "calendar-blocker";

export interface CustomRule {
  id: string;
  text: string;
  createdAt: string;
}

interface AutomationsState {
  enabled: Record<AutomationId, boolean>;
  customRules: CustomRule[];
  toggleAutomation: (id: AutomationId) => void;
  addCustomRule: (text: string) => void;
  removeCustomRule: (id: string) => void;
  /** Trade/macro-event ids the calendar blocker has already acted on —
   *  persisted (not a component ref) so reopening the app doesn't re-scan
   *  history and create duplicate blocks for the same loss/event every
   *  mount. See use-smart-calendar-blocker.ts. */
  autoBlockedTradeIds: string[];
  autoBlockedMacroEventIds: string[];
  markTradeBlocked: (tradeId: string) => void;
  markMacroEventBlocked: (eventId: string) => void;
}

const DEFAULT_ENABLED: Record<AutomationId, boolean> = {
  "instant-warnings": true,
  "retro-tagging": true,
  "calendar-blocker": false,
};

export const useAutomationsStore = create<AutomationsState>()(
  persist(
    (set) => ({
      enabled: DEFAULT_ENABLED,
      customRules: [],
      toggleAutomation: (id) => set((s) => ({ enabled: { ...s.enabled, [id]: !s.enabled[id] } })),
      // Custom rules are stored as structured {text} records, not free text
      // reinterpreted on every read — matches the prompt's own explicit
      // requirement. Actual condition evaluation isn't built yet (arbitrary
      // natural-language conditions need a real rule engine); the rule is
      // saved honestly and simply doesn't fire until that exists.
      addCustomRule: (text) =>
        set((s) => ({
          customRules: [...s.customRules, { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }],
        })),
      removeCustomRule: (id) => set((s) => ({ customRules: s.customRules.filter((r) => r.id !== id) })),
      autoBlockedTradeIds: [],
      autoBlockedMacroEventIds: [],
      markTradeBlocked: (tradeId) => set((s) => ({ autoBlockedTradeIds: [...s.autoBlockedTradeIds, tradeId] })),
      markMacroEventBlocked: (eventId) => set((s) => ({ autoBlockedMacroEventIds: [...s.autoBlockedMacroEventIds, eventId] })),
    }),
    { name: "life-os-automations" }
  )
);
