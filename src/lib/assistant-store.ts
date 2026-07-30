"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** Which mini-assistant this came from, if any — unset for messages sent
   *  from the full /assistant chat screen, which isn't scoped to a context. */
  context?: MiniContext;
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
export type MiniContext = "calendar" | "work";
/** Every source the Home card can pick an insight from — "finance" has no
 *  bubble of its own, it only ever feeds the Home card. */
export type InsightSource = MiniContext | "finance";

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
