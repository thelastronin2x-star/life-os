"use client";

import { useState } from "react";
import { BubbleShell } from "./BubbleShell";
import { useHealthInsightSync } from "@/lib/use-health-insight-sync";
import { buildHealthContext } from "@/lib/assistant-context-health";
import { executeHealthTool } from "@/lib/assistant-tool-executors-health";

/** Only imports health-domain modules (plus the scope-agnostic BubbleShell)
 *  — mounted exclusively on /health, so this is the entire surface of what
 *  that page's bundle pulls in for the assistant.
 *
 *  Owns `open` (not BubbleShell) — see CalendarBubble.tsx for why. */
export function HealthBubble() {
  const [open, setOpen] = useState(false);
  const sync = useHealthInsightSync(open);
  return (
    <BubbleShell
      scope="health"
      cached={sync.cached}
      buildContextBlock={buildHealthContext}
      executeTool={executeHealthTool}
      open={open}
      onOpenChange={setOpen}
      isFetching={sync.isFetching}
      streamingText={sync.streamingText}
    />
  );
}
