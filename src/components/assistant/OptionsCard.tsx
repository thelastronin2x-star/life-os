"use client";

import type { PresentedOption } from "@/lib/assistant-store";
import { cn } from "@/lib/cn";

/** Renders a present_options message — 2-3 concrete action cards plus the
 *  always-appended neutral "show everything" choice (action: null, styled
 *  as an outline row rather than a filled card so it doesn't compete
 *  visually with the real actions). Tapping a still-unresolved option is
 *  the tap half of the dialogue-resolution protocol — see
 *  /assistant/page.tsx's handleOptionPick, which also handles the free-text
 *  half via the select_option classifier. */
export function OptionsCard({
  problemSummary,
  options,
  resolved,
  onSelect,
}: {
  problemSummary: string;
  options: PresentedOption[];
  resolved: boolean;
  onSelect: (option: PresentedOption) => void;
}) {
  return (
    <div className="card-raised max-w-[92%] rounded-card bg-surface p-3.5">
      <div className="mb-3 text-[13px] font-medium leading-relaxed text-text">{problemSummary}</div>
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            disabled={resolved}
            onClick={() => onSelect(opt)}
            className={cn(
              "w-full rounded-card-sm border p-3 text-left transition-opacity disabled:cursor-default",
              opt.action
                ? "border-border bg-surface-2 text-text"
                : "border-dashed border-border bg-transparent text-text-dim",
              resolved && "opacity-50"
            )}
          >
            <div className="text-[12.5px] font-semibold">{opt.label}</div>
            {opt.action && (
              <>
                <div className="mt-1 text-[11px] text-text-faint">{opt.reasoning}</div>
                <div className="mt-1 text-[11px] text-sage">{opt.expectedResult}</div>
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
