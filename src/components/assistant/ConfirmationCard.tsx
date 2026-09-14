"use client";

import Link from "next/link";
import type { DialogueConfirmation } from "@/lib/assistant-store";

/** The "what actually changed" card after a dialogue-flow option executes —
 *  exact before/after lines, never a restatement of the option's own
 *  label/reasoning, plus a deep link into the affected screen. */
export function ConfirmationCard({ confirmation }: { confirmation: DialogueConfirmation }) {
  return (
    <div className="card-raised max-w-[92%] rounded-card border border-sage/30 bg-surface p-3.5">
      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-sage">
        <span>✓</span> Виконано
      </div>
      <div className="space-y-1">
        {confirmation.summary.map((line, i) => (
          <div key={i} className="text-[12.5px] text-text">
            {line}
          </div>
        ))}
      </div>
      <Link href={confirmation.deepLink.href} className="mt-2.5 inline-block text-[11.5px] font-semibold text-sage">
        {confirmation.deepLink.label} →
      </Link>
    </div>
  );
}
