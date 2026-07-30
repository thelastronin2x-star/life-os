"use client";

import { useAppStore } from "@/lib/store";
import { TraderWork } from "@/components/work/TraderWork";
import { ITWork } from "@/components/work/ITWork";
import { FloatingAssistant } from "@/components/assistant/FloatingAssistant";

export default function WorkPage() {
  const profile = useAppStore((s) => s.profile);

  return (
    <div>
      <div className="pb-3.5 pt-2">
        <div className="font-heading text-lg font-semibold text-text">Робота</div>
        <div className="mt-0.5 text-[11.5px] text-text-faint">
          {profile === "trader" ? "Трейдер" : "IT / Розробник"}
        </div>
      </div>
      {profile === "trader" ? <TraderWork /> : <ITWork />}

      <FloatingAssistant context="work" />
    </div>
  );
}
