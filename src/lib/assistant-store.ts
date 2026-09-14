"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ChatRole = "user" | "assistant";

/** One concrete action offered by present_options — see assistant-tools.ts's
 *  DIALOGUE_TOOLS comment for the full protocol. `action: null` marks the
 *  always-appended neutral "show me everything" choice, which the app adds
 *  itself rather than trusting the model to remember it every time. */
export interface PresentedOption {
  id: string;
  label: string;
  reasoning: string;
  expectedResult: string;
  action: { tool: string; input: Record<string, unknown> } | null;
}

export interface DialogueConfirmation {
  /** Lines like "Ліміт 'Одяг': 300₴", "Перенесено: 320₴" — exactly what
   *  changed, not a restatement of the option's own label/reasoning. */
  summary: string[];
  deepLink: { href: string; label: string };
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** Which mini-assistant this came from, if any — unset for messages sent
   *  from the full /assistant chat screen, which isn't scoped to a context. */
  context?: MiniContext;
  /** Set only on an assistant message that called present_options. Renders
   *  as OptionsCard instead of plain text. `resolved` flips true the moment
   *  the user picks one (tap or free-text) — a pending (unresolved) options
   *  message is what routes the NEXT user message through the select_option
   *  classifier instead of the normal chat flow. See /assistant/page.tsx. */
  options?: PresentedOption[];
  resolved?: boolean;
  /** Set only on the assistant message that reports a just-executed action's
   *  outcome — renders as ConfirmationCard instead of plain text. */
  confirmation?: DialogueConfirmation;
}

export type ReportType = "weekly" | "monthly";

export interface AssistantReport {
  id: string;
  type: ReportType;
  periodLabel: string;
  date: string;
  text: string;
}

/** Contexts with their own floating bubble UI. */
export type MiniContext = "calendar" | "health" | "work";
/** Every source that generates its own cached insight. "finance" has no
 *  bubble of its own (only ever feeds the old per-source Home pick, kept for
 *  compatibility); "global" is Home's own cross-source insight, generated
 *  from buildGlobalContext rather than picked from the other three.
 *  "work-analytics" is its own source (not "work" — that one already belongs
 *  to the Робота mini-bubble and shares its cache) for the AI Analytics
 *  screen's longer, period-scoped narrative. "student" is the Student
 *  profile's own Робота-tab assistant blurb — not folded into "work" since
 *  the two profiles' Робота screens never render at once but do share the
 *  underlying cache keyed by source, and a trader's insight bleeding into
 *  the student screen (or vice versa) on a profile switch would be a real
 *  bug, not just a wasted regeneration. */
export type InsightSource = MiniContext | "finance" | "global" | "work-analytics" | "student";

export interface ContextInsight {
  text: string;
  signature: string;
  seen: boolean;
  /** ISO timestamp — lets the Home card pick whichever source's insight is
   *  freshest instead of generating its own combined text. */
  generatedAt: string;
}

interface AssistantState {
  messages: ChatMessage[];
  addMessage: (m: ChatMessage) => void;
  updateMessage: (id: string, content: string) => void;
  patchMessage: (id: string, patch: Partial<ChatMessage>) => void;
  clearMessages: () => void;

  reports: AssistantReport[];
  addReport: (r: Omit<AssistantReport, "id">) => void;
  lastWeeklyReportAt: string | null;
  lastMonthlyReportAt: string | null;
  setLastWeeklyReportAt: (date: string) => void;
  setLastMonthlyReportAt: (date: string) => void;

  contextInsights: Partial<Record<InsightSource, ContextInsight>>;
  setContextInsight: (source: InsightSource, insight: ContextInsight) => void;
  markContextInsightSeen: (context: MiniContext) => void;
}

export const useAssistantStore = create<AssistantState>()(
  persist(
    (set) => ({
      messages: [],
      addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
      updateMessage: (id, content) =>
        set((s) => ({ messages: s.messages.map((msg) => (msg.id === id ? { ...msg, content } : msg)) })),
      patchMessage: (id, patch) =>
        set((s) => ({ messages: s.messages.map((msg) => (msg.id === id ? { ...msg, ...patch } : msg)) })),
      clearMessages: () => set({ messages: [] }),

      reports: [],
      addReport: (r) => set((s) => ({ reports: [{ ...r, id: crypto.randomUUID() }, ...s.reports] })),
      lastWeeklyReportAt: null,
      lastMonthlyReportAt: null,
      setLastWeeklyReportAt: (date) => set({ lastWeeklyReportAt: date }),
      setLastMonthlyReportAt: (date) => set({ lastMonthlyReportAt: date }),

      contextInsights: {},
      setContextInsight: (context, insight) =>
        set((s) => ({ contextInsights: { ...s.contextInsights, [context]: insight } })),
      markContextInsightSeen: (context) =>
        set((s) => {
          const existing = s.contextInsights[context];
          if (!existing) return s;
          return { contextInsights: { ...s.contextInsights, [context]: { ...existing, seen: true } } };
        }),
    }),
    { name: "life-os-assistant" }
  )
);
