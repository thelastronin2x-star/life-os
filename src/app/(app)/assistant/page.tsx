"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAssistantStore, type ChatMessage, type PresentedOption, type DialogueConfirmation } from "@/lib/assistant-store";
import { useAppStore } from "@/lib/store";
import { useAdviceStore, type AdviceType, type AdviceDomain, type AdviceRecord } from "@/lib/advice-store";
import { useFinanceStore } from "@/lib/finance-store";
import { usePropAccountsStore } from "@/lib/prop-accounts-store";
import { FINANCE_CATEGORIES, type FinanceCategoryKey } from "@/lib/finance-categories";
import { generateReport, type ReportType } from "@/lib/reports";
import { callAssistantTurn } from "@/lib/assistant-client";
import { buildAssistantMainContext, findProactiveInsights, type ProactiveInsight } from "@/lib/assistant-problem-detectors";
import { executeAssistantMainTool } from "@/lib/assistant-tool-executors-main";
import type { AnthropicContentBlock, AssistantApiMessage } from "@/lib/assistant-api-types";
import { OptionsCard } from "@/components/assistant/OptionsCard";
import { ConfirmationCard } from "@/components/assistant/ConfirmationCard";
import { ProactiveCard } from "@/components/assistant/ProactiveCard";
import { ToneOfVoiceSheet } from "@/components/assistant/ToneOfVoiceSheet";
import { cn } from "@/lib/cn";
import { BarChartIcon, TrendingUpIcon, ChatBubbleIcon } from "@/components/icons";

const REPORT_CHIPS: {
  type: ReportType;
  label: string;
  Icon: typeof BarChartIcon;
  userText: string;
}[] = [
  { type: "weekly", label: "Звіт за тиждень", Icon: BarChartIcon, userText: "Згенеруй звіт за тиждень" },
  { type: "monthly", label: "Звіт за місяць", Icon: TrendingUpIcon, userText: "Згенеруй звіт за місяць" },
];

function detectReportType(text: string): ReportType | null {
  const lower = text.toLowerCase();
  if (!lower.includes("звіт")) return null;
  if (lower.includes("місяц") || lower.includes("місяч")) return "monthly";
  if (lower.includes("тижд") || lower.includes("тижн")) return "weekly";
  return null;
}

/** Maps an executed tool call to the AdviceRecord fields it should log, and
 *  to the deep-link confirmation card — see advice-store.ts's AdviceType
 *  comment for why only budget-limit/risk-limit get a real metricRef. */
function classifyAction(
  tool: string,
  input: Record<string, unknown>
): { adviceType: AdviceType; domain: AdviceDomain; metricRef: AdviceRecord["metricRef"] } {
  if (tool === "update_budget_limit" || tool === "move_budget" || tool === "create_budget_category") {
    const categoryName =
      tool === "move_budget"
        ? String(input.toCategoryName ?? "")
        : tool === "create_budget_category"
          ? (FINANCE_CATEGORIES[input.categoryKey as FinanceCategoryKey]?.name ?? "")
          : String(input.categoryName ?? "");
    const { budgetCategories } = useFinanceStore.getState();
    const category = budgetCategories.find((c) => c.name === categoryName);
    const accountId = category
      ? Object.entries(category.limitsByAccount).sort((a, b) => b[1] - a[1])[0]?.[0]
      : undefined;
    return {
      adviceType: "budget-limit",
      domain: "finance",
      metricRef: category && accountId ? { categoryId: category.id, accountId } : null,
    };
  }
  if (tool === "set_risk_limit") {
    const { accounts } = usePropAccountsStore.getState();
    const account = accounts.find((a) => a.firm.toLowerCase().includes(String(input.firm ?? "").toLowerCase()));
    return {
      adviceType: "risk-limit",
      domain: "work",
      metricRef: account ? { accountId: account.id, drawdownPctAtAdvice: account.drawdownPct } : null,
    };
  }
  if (tool === "create_automation_rule") return { adviceType: "automation-rule", domain: "automation", metricRef: null };
  return { adviceType: "calendar-event", domain: "calendar", metricRef: null };
}

function buildConfirmation(tool: string, input: Record<string, unknown>, executorResult: string): DialogueConfirmation {
  switch (tool) {
    case "update_budget_limit":
      return {
        summary: [`Ліміт "${input.categoryName}": ${Number(input.newLimit).toFixed(0)}`],
        deepLink: { href: "/balance", label: "Переглянути у Фінансах" },
      };
    case "move_budget":
      return {
        summary: [
          `Перенесено: ${Number(input.amount).toFixed(0)}`,
          `З "${input.fromCategoryName}" в "${input.toCategoryName}"`,
        ],
        deepLink: { href: "/balance", label: "Переглянути у Фінансах" },
      };
    case "create_budget_category": {
      const name = FINANCE_CATEGORIES[input.categoryKey as FinanceCategoryKey]?.name ?? String(input.categoryKey ?? "");
      return {
        summary: [`Нова категорія: ${name}`, `Ліміт: ${Number(input.limit).toFixed(0)}`],
        deepLink: { href: "/balance", label: "Переглянути у Фінансах" },
      };
    }
    case "set_risk_limit":
      return {
        summary: [`Ліміт просадки "${input.firm}": ${input.newMaxDrawdown}%`],
        deepLink: { href: "/work/prop-accounts", label: "Переглянути в Роботі" },
      };
    case "create_automation_rule":
      return {
        summary: [`Нове правило: "${input.text}"`],
        deepLink: { href: "/profile/settings/ai-automations", label: "Переглянути автоматизацію" },
      };
    case "create_event":
      return {
        summary: [`Подія: "${input.title}"`, `Дата: ${input.date}${input.time ? ` о ${input.time}` : ""}`],
        deepLink: { href: "/calendar", label: "Переглянути в Календарі" },
      };
    default:
      return { summary: [executorResult], deepLink: { href: "/assistant", label: "" } };
  }
}

export default function AssistantPage() {
  const { messages, addMessage, updateMessage, patchMessage, clearMessages } = useAssistantStore();
  const profile = useAppStore((s) => s.profile);
  const tone = useAppStore((s) => s.settings.communicationTone);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const adviceRecords = useAdviceStore((s) => s.records);
  const addAdvice = useAdviceStore((s) => s.addAdvice);

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [dismissedInsightIds, setDismissedInsightIds] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const behavior = hasMountedRef.current ? "smooth" : "auto";
    hasMountedRef.current = true;
    bottomRef.current?.scrollIntoView({ behavior });
  }, [messages]);

  const proactiveInsights: ProactiveInsight[] = findProactiveInsights(adviceRecords).filter(
    (i) => !dismissedInsightIds.includes(i.id)
  );

  async function runProactiveAction(insight: ProactiveInsight) {
    const resultText = executeAssistantMainTool(insight.action.tool, insight.action.input);
    const confirmation = buildConfirmation(insight.action.tool, insight.action.input, resultText);
    const { adviceType, domain, metricRef } = classifyAction(insight.action.tool, insight.action.input);
    addMessage({ id: crypto.randomUUID(), role: "assistant", content: resultText, confirmation });
    addAdvice({
      date: new Date().toISOString(),
      domain,
      adviceType,
      summary: insight.summary,
      userAction: "accepted",
      action: insight.action,
      outcomeCheckedAt: adviceType === "budget-limit" || adviceType === "risk-limit" ? null : new Date().toISOString().slice(0, 10),
      outcomeResult: adviceType === "budget-limit" || adviceType === "risk-limit" ? null : "not_measurable",
      metricRef,
    });
    setDismissedInsightIds((prev) => [...prev, insight.id]);
  }

  async function runReportFlow(type: ReportType) {
    const assistantId = crypto.randomUUID();
    addMessage({ id: assistantId, role: "assistant", content: "" });
    setIsStreaming(true);
    try {
      const text = await generateReport(type, profile);
      updateMessage(assistantId, text);
    } catch {
      updateMessage(assistantId, "Не вдалося згенерувати звіт. Спробуй ще раз.");
    } finally {
      setIsStreaming(false);
    }
  }

  /** The main dialogue loop — mirrors BubbleShell's tool round-trip, plus
   *  the present_options branch: when the model calls it, the loop stops
   *  immediately (never auto-executed) and the message renders as
   *  OptionsCard instead of plain text. See classifyAction/buildConfirmation
   *  above for what happens once the user actually picks one. */
  async function runChatFlow() {
    const assistantId = crypto.randomUUID();
    addMessage({ id: assistantId, role: "assistant", content: "" });
    setIsStreaming(true);

    try {
      const history = [...useAssistantStore.getState().messages].filter(
        (m) => m.id !== assistantId && m.content.trim() !== ""
      );
      let apiMessages: AssistantApiMessage[] = history.map((m) => ({ role: m.role, content: m.content }));
      const contextBlock = buildAssistantMainContext(profile);

      let finalText = "";
      let presented: { problemSummary: string; options: PresentedOption[] } | null = null;

      for (let round = 0; round < 3; round++) {
        const res = await callAssistantTurn(apiMessages, contextBlock, "chat", "assistant-main", tone ?? undefined);

        const presentCall = res.toolCalls.find((c) => c.name === "present_options");
        if (presentCall) {
          const rawOptions = Array.isArray(presentCall.input.options) ? (presentCall.input.options as Record<string, unknown>[]) : [];
          const options: PresentedOption[] = rawOptions.slice(0, 3).map((o) => ({
            id: crypto.randomUUID(),
            label: String(o.label ?? ""),
            reasoning: String(o.reasoning ?? ""),
            expectedResult: String(o.expectedResult ?? ""),
            action: o.tool ? { tool: String(o.tool), input: (o.toolInput as Record<string, unknown>) ?? {} } : null,
          }));
          options.push({ id: crypto.randomUUID(), label: "Показати повну картину", reasoning: "", expectedResult: "", action: null });
          presented = { problemSummary: String(presentCall.input.problemSummary ?? ""), options };
          break;
        }

        const otherCalls = res.toolCalls.filter((c) => c.name !== "select_option");
        if (otherCalls.length === 0) {
          finalText = res.text;
          break;
        }

        const assistantBlocks: AnthropicContentBlock[] = [
          ...(res.text ? [{ type: "text" as const, text: res.text }] : []),
          ...otherCalls.map((c) => ({ type: "tool_use" as const, id: c.id, name: c.name, input: c.input })),
        ];
        const toolResults: AnthropicContentBlock[] = otherCalls.map((c) => ({
          type: "tool_result" as const,
          tool_use_id: c.id,
          content: executeAssistantMainTool(c.name, c.input),
        }));
        apiMessages = [...apiMessages, { role: "assistant", content: assistantBlocks }, { role: "user", content: toolResults }];

        if (round === 2) finalText = res.text || "Забагато кроків підряд — спробуй сформулювати простіше.";
      }

      if (presented) {
        patchMessage(assistantId, { content: presented.problemSummary, options: presented.options, resolved: false });
      } else {
        updateMessage(assistantId, finalText || "Вибач, асистент зараз недоступний. Спробуй ще раз пізніше.");
      }
    } catch {
      updateMessage(assistantId, "Вибач, сталася помилка. Спробуй ще раз.");
    } finally {
      setIsStreaming(false);
    }
  }

  /** Executes a chosen option — the tap path calls this directly (no extra
   *  Claude round-trip needed, the tool+input were already generated when
   *  present_options was called); the free-text path resolves to the same
   *  option via the select_option classifier first, see handleSend below. */
  async function executeOption(pending: ChatMessage, option: PresentedOption) {
    patchMessage(pending.id, { resolved: true });

    if (!option.action) {
      addMessage({ id: crypto.randomUUID(), role: "user", content: "Покажи мені повну картину." });
      const inferredTool = pending.options?.find((o) => o.action)?.action?.tool;
      const inferred = inferredTool ? classifyAction(inferredTool, {}) : { adviceType: "calendar-event" as const, domain: "calendar" as const };
      addAdvice({
        date: new Date().toISOString(),
        domain: inferred.domain,
        adviceType: inferred.adviceType,
        summary: pending.content,
        userAction: "shown",
        action: null,
        outcomeCheckedAt: null,
        outcomeResult: null,
        metricRef: null,
      });
      await runChatFlow();
      return;
    }

    setIsStreaming(true);
    try {
      const resultText = executeAssistantMainTool(option.action.tool, option.action.input);
      const confirmation = buildConfirmation(option.action.tool, option.action.input, resultText);
      addMessage({ id: crypto.randomUUID(), role: "assistant", content: resultText, confirmation });

      const { adviceType, domain, metricRef } = classifyAction(option.action.tool, option.action.input);
      const isMeasurable = adviceType === "budget-limit" || adviceType === "risk-limit";
      addAdvice({
        date: new Date().toISOString(),
        domain,
        adviceType,
        summary: option.label,
        userAction: "accepted",
        action: option.action,
        outcomeCheckedAt: isMeasurable ? null : new Date().toISOString().slice(0, 10),
        outcomeResult: isMeasurable ? null : "not_measurable",
        metricRef,
      });
    } finally {
      setIsStreaming(false);
    }
  }

  /** A free-text reply while a present_options message is still unresolved
   *  gets classified against those options first (forced select_option
   *  tool_choice) — a genuine "not about the options" message (optionIndex
   *  -1, or an unrelated question) falls through to the normal chat flow
   *  below instead of being forced into a selection it isn't. */
  async function tryResolveFreeTextSelection(text: string, pending: ChatMessage): Promise<boolean> {
    if (!pending.options) return false;
    setIsStreaming(true);
    try {
      const optionsText = pending.options.map((o, i) => `${i}: ${o.label}`).join("\n");
      const res = await callAssistantTurn(
        [{ role: "user", content: `Варіанти:\n${optionsText}\n\nПовідомлення користувача: "${text}"` }],
        "",
        "chat",
        "assistant-main",
        tone ?? undefined,
        "select_option"
      );
      const call = res.toolCalls.find((c) => c.name === "select_option");
      const idx = call ? Number(call.input.optionIndex) : -1;
      if (!Number.isInteger(idx) || idx < 0 || idx >= pending.options.length) return false;
      await executeOption(pending, pending.options[idx]);
      return true;
    } catch {
      return false;
    } finally {
      setIsStreaming(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    addMessage({ id: crypto.randomUUID(), role: "user", content: text });

    const reportType = detectReportType(text);
    if (reportType) {
      await runReportFlow(reportType);
      return;
    }

    const lastAssistantWithOptions = [...useAssistantStore.getState().messages].reverse().find((m) => m.options);
    if (lastAssistantWithOptions && !lastAssistantWithOptions.resolved) {
      const handled = await tryResolveFreeTextSelection(text, lastAssistantWithOptions);
      if (handled) return;
    }

    await runChatFlow();
  }

  async function handleReportChip(type: ReportType, userText: string) {
    if (isStreaming) return;
    addMessage({ id: crypto.randomUUID(), role: "user", content: userText });
    await runReportFlow(type);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div>
      {tone === null && (
        <ToneOfVoiceSheet value={tone} onSelect={(t) => updateSettings({ communicationTone: t })} onClose={null} />
      )}

      <div className="mb-3 flex items-center justify-between pt-2">
        <div>
          <Link href="/work" className="mb-2 flex items-center gap-2 text-[12.5px] text-text-dim">
            <span className="flex h-7 w-7 items-center justify-center rounded-icon border border-border bg-surface">
              ‹
            </span>
            Робота
          </Link>
          <div className="font-heading text-lg font-semibold text-text">Асистент</div>
          <div className="mt-0.5 text-[11.5px] text-text-faint">на зв&apos;язку 24/7</div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/assistant/memory" className="text-[11px] text-text-faint">
            пам&apos;ять
          </Link>
          <Link href="/assistant/reports" className="text-[11px] text-text-faint">
            історія звітів
          </Link>
          {messages.length > 0 && (
            <button onClick={clearMessages} className="text-[11px] text-text-faint">
              очистити
            </button>
          )}
        </div>
      </div>

      {proactiveInsights.map((insight) => (
        <ProactiveCard
          key={insight.id}
          summary={insight.summary}
          pastReference={insight.pastReference}
          actionLabel={insight.actionLabel}
          onAction={() => runProactiveAction(insight)}
          onDismiss={() => setDismissedInsightIds((prev) => [...prev, insight.id])}
        />
      ))}

      {messages.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-2 px-4 text-center text-[12.5px] text-text-faint">
          <ChatBubbleIcon className="h-6 w-6" />
          Постав питання про календар, фінанси чи трейдинг — я на зв&apos;язку.
        </div>
      )}

      <div className="mb-3 flex gap-2">
        {REPORT_CHIPS.map((chip) => (
          <button
            key={chip.type}
            onClick={() => handleReportChip(chip.type, chip.userText)}
            disabled={isStreaming}
            className="card-raised flex flex-1 items-center justify-center gap-1.5 rounded-card-sm bg-surface py-2 text-center text-[11px] font-semibold text-text-dim disabled:opacity-40"
          >
            <chip.Icon className="h-3.5 w-3.5" /> {chip.label}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.options ? (
              <OptionsCard
                problemSummary={m.content}
                options={m.options}
                resolved={!!m.resolved}
                onSelect={(option) => executeOption(m, option)}
              />
            ) : m.confirmation ? (
              <ConfirmationCard confirmation={m.confirmation} />
            ) : (
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-[20px] px-3.5 py-2.5 text-[13px] font-medium leading-relaxed",
                  m.role === "user" ? "rounded-br-[7px] bg-text text-bg" : "rounded-bl-[7px] bg-surface text-text"
                )}
              >
                {m.content || (isStreaming && m.role === "assistant" ? "…" : "")}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-[84px] z-10 mt-3 md:bottom-3">
        <div className="flex items-end gap-2 rounded-btn bg-surface shadow-card py-1.5 pl-4 pr-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Напиши повідомлення..."
            className="max-h-28 flex-1 resize-none bg-transparent py-1.5 text-[13px] text-text outline-none placeholder:text-text-faint"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-btn bg-sage text-[14px] text-bg disabled:opacity-40"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
