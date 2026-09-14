"use client";

import type { CommunicationTone } from "@/lib/assistant-api-types";

const TONE_OPTIONS: { id: CommunicationTone; name: string; description: string }[] = [
  { id: "concise", name: "Коротко й чесно", description: "Мінімум слів, прямо по суті" },
  { id: "supportive", name: "Розгорнуто й підтримуюче", description: "Більше пояснень, тепліший тон" },
  { id: "colleague", name: "Як досвідчений колега", description: "Професійно, на рівних" },
];

/** Shown once, on first /assistant visit while settings.communicationTone
 *  is still null (see /assistant/page.tsx), and reused as-is for the
 *  Settings entry that lets it be changed later — same component, same
 *  options, just a different `onClose` (dismissible from Settings, not
 *  dismissible without picking on first use since there's no sane default
 *  to fall back to that wouldn't be a silent guess). */
export function ToneOfVoiceSheet({
  value,
  onSelect,
  onClose,
}: {
  value: CommunicationTone | null;
  onSelect: (tone: CommunicationTone) => void;
  onClose: (() => void) | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="w-full max-w-md rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-1 font-heading text-[15px] font-semibold text-text">Тон спілкування асистента</div>
        <div className="mb-4 text-[11.5px] text-text-faint">Можна змінити пізніше в налаштуваннях</div>
        <div className="space-y-2">
          {TONE_OPTIONS.map((opt) => {
            const active = opt.id === value;
            return (
              <button
                key={opt.id}
                onClick={() => {
                  onSelect(opt.id);
                  onClose?.();
                }}
                className={`w-full rounded-card-sm border p-3 text-left ${
                  active ? "border-accent bg-surface-2" : "border-border bg-surface"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-text">{opt.name}</span>
                  {active && <span className="text-accent">✓</span>}
                </div>
                <div className="mt-0.5 text-[11px] text-text-faint">{opt.description}</div>
              </button>
            );
          })}
        </div>
        {onClose && (
          <button onClick={onClose} className="mt-4 w-full text-[12px] text-text-faint">
            Закрити
          </button>
        )}
      </div>
    </div>
  );
}
