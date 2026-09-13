"use client";

import { SCHEMA_ICONS } from "@/lib/constructor-config";
import { cn } from "@/lib/cn";

export function SchemaIconPickerSheet({
  selected,
  onSelect,
  onClose,
}: {
  selected: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-card bg-bg p-5 shadow-card md:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 text-[15px] font-bold text-text">Іконка теми</div>
        <div className="grid grid-cols-4 gap-2.5">
          {Object.entries(SCHEMA_ICONS).map(([key, Icon]) => (
            <button
              key={key}
              onClick={() => {
                onSelect(key);
                onClose();
              }}
              className={cn(
                "flex aspect-square items-center justify-center rounded-card bg-surface-2 text-sage",
                selected === key && "well-pressed"
              )}
            >
              <Icon className="h-5 w-5" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
