"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAssistantStore } from "@/lib/assistant-store";
import { useAppStore } from "@/lib/store";
import { generateReport, type ReportType } from "@/lib/reports";
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

export default function AssistantPage() {
  const { messages, addMessage, updateMessage, clearMessages } = useAssistantStore();
  const profile = useAppStore((s) => s.profile);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    // Jump instantly on the mount that follows opening this tab — an animated
    // scroll competing with the tab's own enter transition is what caused the
    // visible stutter. Only animate for messages that arrive afterwards.
    const behavior = hasMountedRef.current ? "smooth" : "auto";
    hasMountedRef.current = true;
    bottomRef.current?.scrollIntoView({ behavior });
  }, [messages]);

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

  async function runChatFlow() {
    const assistantId = crypto.randomUUID();
    addMessage({ id: assistantId, role: "assistant", content: "" });
    setIsStreaming(true);

    try {
      const history = [...useAssistantStore.getState().messages].filter(
        (m) => m.id !== assistantId && m.content.trim() !== ""
      );

      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          taskType: "chat",
        }),
      });

      if (!res.ok || !res.body) {
        updateMessage(assistantId, "Вибач, асистент зараз недоступний. Спробуй ще раз пізніше.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        updateMessage(assistantId, acc);
      }
    } catch {
      updateMessage(assistantId, "Вибач, сталася помилка. Спробуй ще раз.");
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
    } else {
      await runChatFlow();
    }
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
      <div className="mb-3 flex items-center justify-between pt-2">
        <div>
          <div className="font-heading text-lg font-semibold text-text">Асистент</div>
          <div className="mt-0.5 text-[11.5px] text-text-faint">на зв&apos;язку 24/7</div>
        </div>
        <div className="flex items-center gap-3">
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
            className="flex flex-1 items-center justify-center gap-1.5 rounded-card-sm bg-surface shadow-card py-2 text-center text-[11px] font-semibold text-text-dim disabled:opacity-40"
          >
            <chip.Icon className="h-3.5 w-3.5" /> {chip.label}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-[14px] px-3.5 py-2.5 text-[13px] leading-relaxed",
                m.role === "user" ? "bg-accent text-bg" : "border border-border bg-surface text-text"
              )}
            >
              {m.content || (isStreaming && m.role === "assistant" ? "…" : "")}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-[84px] z-10 mt-3 flex items-end gap-2 border-t border-border bg-bg pt-2.5 md:bottom-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Напиши повідомлення..."
          className="max-h-28 flex-1 resize-none rounded-input border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none"
        />
        <button
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          className="flex-shrink-0 rounded-btn bg-accent px-4 py-2.5 text-[13px] font-semibold text-bg disabled:opacity-40"
        >
          →
        </button>
      </div>
    </div>
  );
}
