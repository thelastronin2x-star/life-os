"use client";

import { useState } from "react";
import { FIELD_TYPES } from "@/lib/constructor-config";
import type { FieldType } from "@/lib/schema-store";
import { cn } from "@/lib/cn";

export function FieldTypePickerSheet({
  onAdd,
  onClose,
}: {
  onAdd: (name: string, type: FieldType, options?: string[]) => void;
  onClose: () => void;
}) {
  const [selectedType, setSelectedType] = useState<FieldType | null>(null);
  const [name, setName] = useState("");
  const [optionsText, setOptionsText] = useState("");

  const needsOptions = selectedType === "select" || selectedType === "checklist";

  function handleAdd() {
    if (!selectedType || !name.trim()) return;
    const options = needsOptions
      ? optionsText
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
      : undefined;
    onAdd(name.trim(), selectedType, options);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-card bg-bg p-5 shadow-card md:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 text-[15px] font-bold text-text">Тип поля</div>

        <div className="grid grid-cols-2 gap-2.5">
          {FIELD_TYPES.map((t) => {
            const Icon = t.icon;
            const sel = selectedType === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedType(t.id)}
                className={cn(
                  "card-raised flex items-center gap-2.5 rounded-card bg-surface p-3.5",
                  sel && "well-pressed"
                )}
              >
                <Icon className="h-[15px] w-[15px] flex-shrink-0 text-sage" />
                <span className="truncate text-[11.5px] font-semibold text-text">{t.label}</span>
              </button>
            );
          })}
        </div>

        {selectedType && (
          <div className="mt-4">
            <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-faint">Назва поля</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Наприклад, Автор"
              autoFocus
              className="mb-3 w-full rounded-input border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none"
            />
            {needsOptions && (
              <>
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-faint">
                  Варіанти (через кому)
                </div>
                <input
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder="Спокій, Азарт, Страх, Помста"
                  className="mb-3 w-full rounded-input border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none"
                />
              </>
            )}
            <button
              onClick={handleAdd}
              disabled={!name.trim()}
              className="w-full rounded-btn bg-sage py-3 text-center text-[12.5px] font-bold text-bg disabled:opacity-40"
            >
              Додати
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
