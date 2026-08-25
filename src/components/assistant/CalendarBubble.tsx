"use client";

import { useState } from "react";
import { BubbleShell } from "./BubbleShell";
import { useCalendarInsightSync } from "@/lib/use-calendar-insight-sync";
import { buildCalendarContext } from "@/lib/assistant-context-calendar";
import { executeCalendarTool } from "@/lib/assistant-tool-executors-calendar";

/** Only imports calendar-domain modules (plus the scope-agnostic
 *  BubbleShell) — mounted exclusively on /calendar, so this is the entire
 *  surface of what that page's bundle pulls in for the assistant.
 *
 *  Owns `open` (not BubbleShell) because it's the one that has to decide
 *  which debounce cadence useCalendarInsightSync uses — the hook needs to
 *  know the panel is open before BubbleShell itself ever finds out. */
export function CalendarBubble() {
  const [open, setOpen] = useState(false);
  const sync = useCalendarInsightSync(open);
  return (
    <BubbleShell
      scope="calendar"
      cached={sync.cached}
      buildContextBlock={buildCalendarContext}
      executeTool={executeCalendarTool}
      open={open}
      onOpenChange={setOpen}
      isFetching={sync.isFetching}
      streamingText={sync.streamingText}
    />
  );
}
