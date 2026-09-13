"use client";

import { ATTACH_TAB_LABELS } from "@/lib/constructor-config";
import type { AttachTab, Schema } from "@/lib/schema-store";
import { cn } from "@/lib/cn";

const TABS: AttachTab[] = ["work", "finance", "calendar", "health", "home"];

export function AttachTargetPickerSheet({
  current,
  otherSchemas,
  onSelect,
  onClose,
}: {
  current: AttachTab | null;
  /** Every OTHER schema, so a tab already claimed elsewhere can show what
   *  attaching here would detach — attaching is always exclusive per tab. */
  otherSchemas: Schema[];
  onSelect: (tab: AttachTab | null) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-card bg-bg p-5 shadow-card md:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 text-[15px] font-bold text-text">Прив&apos;язка</div>

        <button
          onClick={() => {
            onSelect(null);
            onClose();
          }}
          className={cn(
            "mb-2 flex w-full items-center justify-between rounded-card-sm bg-surface-2 px-3.5 py-3 text-left",
            current === null && "well-pressed"
          )}
        >
          <span className="text-[13px] font-semibold text-text">Не використовувати</span>
          <span className="text-[10.5px] text-text-faint">Самостійна тема</span>
        </button>

        {TABS.map((tab) => {
          const occupiedBy = otherSchemas.find((s) => s.attachedTo?.tab === tab);
          return (
            <button
              key={tab}
              onClick={() => {
                onSelect(tab);
                onClose();
              }}
              className={cn(
                "mb-2 flex w-full items-center justify-between rounded-card-sm bg-surface-2 px-3.5 py-3 text-left",
                current === tab && "well-pressed"
              )}
            >
              <span className="text-[13px] font-semibold text-text">{ATTACH_TAB_LABELS[tab]}</span>
              {occupiedBy && <span className="text-[10.5px] text-gold">замінить «{occupiedBy.name}»</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
