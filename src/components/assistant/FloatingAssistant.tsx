"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAssistantStore, type MiniContext, type ChatMessage, type ContextInsight } from "@/lib/assistant-store";
import { useAppStore, useHasHydrated } from "@/lib/store";
import { buildCalendarContext, buildWorkContext, callAssistantOnce } from "@/lib/assistant-context";
import { useCalendarInsightSync, useWorkInsightSync } from "@/lib/use-source-insight-sync";
import type { Profile } from "@/lib/store";
import { ChatBubbleIcon } from "@/components/icons";

const CONTEXT_LABEL: Record<MiniContext, string> = {
  calendar: "Календар",
  work: "Робота",
};

const CONTEXT_PLACEHOLDER: Record<MiniContext, string> = {
  calendar: "Напиши про календар...",
  work: "Напиши про угоди...",
};

const CONTEXT_CHIPS: Record<MiniContext, string[]> = {
  calendar: ["Покажи свята місяця", "Що заплановано завтра?"],
  work: ["Порівняй мої сетапи", "Яка динаміка win rate?"],
};

export function FloatingAssistant({ context }: { context: MiniContext }) {
  // Split so each context calls exactly one, unconditional sync hook — a
  // single component branching between useCalendarInsightSync/useWorkInsightSync
  // based on the context prop would be a conditional hook call.
  return context === "calendar" ? <CalendarBubble /> : <WorkBubble />;
}

function CalendarBubble() {
  const sync = useCalendarInsightSync();
  return <BubbleShell context="calendar" cached={sync.cached} buildContextBlock={buildCalendarContext} />;
}

function WorkBubble() {
  const profile = useAppStore((s) => s.profile);
  const sync = useWorkInsightSync(profile);
  return (
    <BubbleShell
      context="work"
      cached={sync.cached}
      buildContextBlock={() => buildWorkContext(profile)}
      profile={profile}
    />
  );
}

interface BubbleShellProps {
  context: MiniContext;
  cached: ContextInsight | undefined;
  buildContextBlock: () => string;
  profile?: Profile;
}

function BubbleShell({ context, cached, buildContextBlock, profile }: BubbleShellProps) {
  const hydrated = useHasHydrated();
  const router = useRouter();
  const { markContextInsightSeen, addMessage } = useAssistantStore();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const workProfileLabel = context === "work" ? (profile === "trader" ? " · Трейдер" : " · IT") : "";

  // Always reflect the last real cached insight for this context, regardless
  // of whether it's technically stale — staleness only controls whether a
  // background regen is queued, never whether the last known text is shown.
  // Without this, reopening the app on a day the signature already changed
  // would show "Аналізую…" even though a perfectly good previous answer is
  // sitting right there in the persisted store.
  useEffect(() => {
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local display state from the persisted cache, not a derived render value
      setLastMessage(cached.text);
    }
  }, [cached]);

  const showBadge = Boolean(cached) && !cached!.seen;

  function handleToggle() {
    const next = !open;
    if (next && showBadge) markContextInsightSeen(context);
    setOpen(next);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isBusy) return;
    setInput("");
    setIsBusy(true);

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text, context };
    addMessage(userMsg);

    try {
      const reply = await callAssistantOnce(text, buildContextBlock(), "chat");
      addMessage({ id: crypto.randomUUID(), role: "assistant", content: reply, context });
      setLastMessage(reply);
    } catch {
      setLastMessage("Вибач, сталася помилка. Спробуй ще раз.");
    } finally {
      setIsBusy(false);
    }
  }

  function handleExpand() {
    setOpen(false);
    router.push("/assistant");
  }

  if (!hydrated) return null;

  return (
    <>
      <button
        onClick={handleToggle}
        className="fixed bottom-[84px] right-4 z-[45] flex h-[52px] w-[52px] items-center justify-center rounded-full bg-sage shadow-lg"
        style={{ boxShadow: "0 8px 24px color-mix(in srgb, var(--sage) 40%, transparent)" }}
      >
        <span className="absolute inset-[-4px] animate-ping rounded-full border-[1.5px] border-sage opacity-60" />
        <span className="relative text-bg">
          {open ? (
            <span className="text-xl">✕</span>
          ) : (
            <ChatBubbleIcon className="h-6 w-6" />
          )}
        </span>
        {showBadge && !open && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-bg bg-clay text-[9px] font-bold text-bg">
            1
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-[144px] left-3.5 right-3.5 z-[45] flex max-h-[400px] flex-col overflow-hidden rounded-card bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-border p-3">
            <div className="flex items-center gap-2">
              <span className="h-[7px] w-[7px] rounded-full bg-sage" />
              <div>
                <div className="text-[12.5px] font-semibold text-text">Асистент</div>
                <div className="text-[9.5px] text-text-faint">
                  контекст: {CONTEXT_LABEL[context]}
                  {workProfileLabel}
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-surface-2 text-[12px] text-text-faint"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="mb-2.5 max-w-[88%] rounded-[13px] rounded-bl-[4px] border border-border bg-surface-2 p-2.5 text-[12px] leading-relaxed text-text">
              {lastMessage ?? "Ще немає даних для цього контексту."}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CONTEXT_CHIPS[context].map((chip) => (
                <button
                  key={chip}
                  onClick={() => setInput(chip)}
                  className="rounded-full border border-border bg-surface-2 px-2.5 py-1.5 text-[10px] text-text-dim"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-border p-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={CONTEXT_PLACEHOLDER[context]}
              className="flex-1 rounded-full border border-border bg-surface-2 px-3.5 py-2 text-[12px] text-text outline-none"
            />
            <button
              onClick={handleSend}
              disabled={isBusy || !input.trim()}
              className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-sage text-[13px] text-bg disabled:opacity-40"
            >
              →
            </button>
          </div>
          <button
            onClick={handleExpand}
            className="border-t border-border py-2 text-center text-[9.5px] font-semibold text-sage"
          >
            Розгорнути в повний чат →
          </button>
        </div>
      )}
    </>
  );
}
