"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAssistantStore, type MiniContext, type ChatMessage, type ContextInsight } from "@/lib/assistant-store";
import { useHasHydrated } from "@/lib/store";
import { callAssistantTurn } from "@/lib/assistant-client";
import type { AnthropicContentBlock, AssistantApiMessage } from "@/lib/assistant-api-types";
import { SparkleIcon } from "@/components/icons";

const CONTEXT_LABEL: Record<MiniContext, string> = {
  calendar: "Календар",
  health: "Здоров'я",
  work: "Робота",
};

const CONTEXT_PLACEHOLDER: Record<MiniContext, string> = {
  calendar: "Напиши про календар...",
  health: "Напиши, що зробив...",
  work: "Напиши про угоди...",
};

const CONTEXT_CHIPS: Record<MiniContext, string[]> = {
  calendar: ["Покажи свята місяця", "Що заплановано завтра?"],
  health: ["Випив 500мл води", "Як мій сон цього тижня?"],
  work: ["Порівняй мої сетапи", "Яка динаміка win rate?"],
};

export interface BubbleShellProps {
  scope: MiniContext;
  cached: ContextInsight | undefined;
  buildContextBlock: () => string;
  /** Runs one tool call against this scope's store and returns the result
   *  text that becomes the tool_result content sent back to the model. This
   *  is the ONLY scope-specific thing BubbleShell touches — it never imports
   *  a store or executor itself, so this one file can be shared by all three
   *  scoped bubbles without pulling their stores into each other's page
   *  bundle. Each CalendarBubble/HealthBubble/WorkBubble wrapper lives in
   *  its own file and passes its own scope's executor in here. */
  executeTool: (name: string, input: Record<string, unknown>) => string;
  workProfileLabel?: string;
  /** Owned by the wrapper (CalendarBubble etc.), not this component — the
   *  wrapper is what calls the insight-sync hook, and that hook needs to
   *  know whether the panel is open to pick the fast vs. slow debounce, so
   *  the "is it open" bit of state has to live where the hook is called. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** From the insight-sync hook — true while a background regeneration is
   *  in flight, so the message bubble (not the whole panel) can show a
   *  light "передумує" indicator instead of looking frozen. */
  isFetching: boolean;
  /** Live text as it streams in from the passive quick-insight call — see
   *  streamAssistantOnce. Null when nothing is streaming. */
  streamingText: string | null;
}

const MAX_TOOL_ROUNDTRIPS = 3;

export function BubbleShell({
  scope,
  cached,
  buildContextBlock,
  executeTool,
  workProfileLabel = "",
  open,
  onOpenChange,
  isFetching,
  streamingText,
}: BubbleShellProps) {
  const hydrated = useHasHydrated();
  const router = useRouter();
  const { markContextInsightSeen, addMessage } = useAssistantStore();

  const [input, setInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

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

  // The live streamed text takes over the moment a chunk arrives; before
  // that (streamingText === "") it still shows the previous lastMessage
  // rather than blanking the bubble, so a regeneration never looks like the
  // message vanished.
  const displayText = streamingText ? streamingText : lastMessage;

  function handleToggle() {
    const next = !open;
    if (next && showBadge) markContextInsightSeen(scope);
    onOpenChange(next);
  }

  /** Drives the tool-use loop: sends one turn, and if the model asks for
   *  tool_use, executes it locally against this scope's own store and
   *  replays the result back for a follow-up turn — capped so a model that
   *  keeps asking for tools can't loop forever. */
  async function runTurn(userText: string): Promise<string> {
    const contextBlock = buildContextBlock();
    let messages: AssistantApiMessage[] = [{ role: "user", content: userText }];

    for (let round = 0; round < MAX_TOOL_ROUNDTRIPS; round++) {
      const res = await callAssistantTurn(messages, contextBlock, "chat", scope);
      if (res.toolCalls.length === 0) return res.text;

      const assistantBlocks: AnthropicContentBlock[] = [
        ...(res.text ? [{ type: "text" as const, text: res.text }] : []),
        ...res.toolCalls.map((tc) => ({ type: "tool_use" as const, id: tc.id, name: tc.name, input: tc.input })),
      ];
      const toolResultBlocks: AnthropicContentBlock[] = res.toolCalls.map((tc) => ({
        type: "tool_result" as const,
        tool_use_id: tc.id,
        content: executeTool(tc.name, tc.input),
      }));
      messages = [
        ...messages,
        { role: "assistant", content: assistantBlocks },
        { role: "user", content: toolResultBlocks },
      ];
    }
    return "Забагато кроків підряд — спробуй сформулювати простіше.";
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isBusy) return;
    setInput("");
    setIsBusy(true);

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text, context: scope };
    addMessage(userMsg);

    try {
      const reply = await runTurn(text);
      addMessage({ id: crypto.randomUUID(), role: "assistant", content: reply, context: scope });
      setLastMessage(reply);
    } catch {
      setLastMessage("Вибач, сталася помилка. Спробуй ще раз.");
    } finally {
      setIsBusy(false);
    }
  }

  function handleExpand() {
    onOpenChange(false);
    router.push("/assistant");
  }

  if (!hydrated) return null;

  return (
    <>
      <button
        onClick={handleToggle}
        className="assistant-fab fixed bottom-[84px] right-4 z-[45] flex h-[52px] w-[52px] items-center justify-center rounded-full bg-text shadow-lg"
      >
        <span className="relative text-bg">
          {open ? <span className="text-xl">✕</span> : <SparkleIcon className="assistant-fab-icon h-6 w-6" />}
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
                  контекст: {CONTEXT_LABEL[scope]}
                  {workProfileLabel}
                </div>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-surface-2 text-[12px] text-text-faint"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="mb-2.5 max-w-[88%] rounded-[13px] rounded-bl-[4px] border border-border bg-surface-2 p-2.5 text-[12px] leading-relaxed text-text">
              {displayText ?? (isFetching ? "" : "Ще немає даних для цього контексту.")}
              {isFetching && (
                <span className="ai-thinking-dots ml-1 inline-flex items-center gap-[3px] align-middle" aria-label="Асистент передумує">
                  <span className="ai-thinking-dot h-[4px] w-[4px] rounded-full bg-text-faint" />
                  <span className="ai-thinking-dot h-[4px] w-[4px] rounded-full bg-text-faint" />
                  <span className="ai-thinking-dot h-[4px] w-[4px] rounded-full bg-text-faint" />
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CONTEXT_CHIPS[scope].map((chip) => (
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
              placeholder={CONTEXT_PLACEHOLDER[scope]}
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
