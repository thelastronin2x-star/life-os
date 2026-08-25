"use client";

import { useState } from "react";
import { BubbleShell } from "./BubbleShell";
import { useWorkInsightSync } from "@/lib/use-work-insight-sync";
import { buildWorkContext } from "@/lib/assistant-context-work";
import { executeWorkTool, type TradeDraft } from "@/lib/assistant-tool-executors-work";
import { useAppStore } from "@/lib/store";

/** Only imports work-domain modules (plus the scope-agnostic BubbleShell) —
 *  mounted exclusively on /work/journal, so this is the entire surface of
 *  what that page's bundle pulls in for the assistant.
 *
 *  Owns `open` (not BubbleShell) — see CalendarBubble.tsx for why. */
export function WorkBubble({ onDraftTrade }: { onDraftTrade: (draft: TradeDraft) => void }) {
  const profile = useAppStore((s) => s.profile);
  const [open, setOpen] = useState(false);
  const sync = useWorkInsightSync(profile, open);
  const workProfileLabel = profile === "trader" ? " · Трейдер" : " · IT";
  return (
    <BubbleShell
      scope="work"
      cached={sync.cached}
      buildContextBlock={() => buildWorkContext(profile)}
      executeTool={(name, input) => executeWorkTool(name, input, { onDraftTrade })}
      workProfileLabel={workProfileLabel}
      open={open}
      onOpenChange={setOpen}
      isFetching={sync.isFetching}
      streamingText={sync.streamingText}
    />
  );
}
