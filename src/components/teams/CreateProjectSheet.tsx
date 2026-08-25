"use client";

import { useState } from "react";
import type { TeamProjectKind } from "@/lib/teams/types";
import { cn } from "@/lib/cn";

const KIND_OPTIONS: { id: TeamProjectKind; label: string; hint: string }[] = [
  { id: "note", label: "Нотатка", hint: "Спільний документ, куди учасники додають записи" },
  { id: "session", label: "Регулярна сесія", hint: "Розклад зустрічі з нагадуванням" },
  { id: "parts_project", label: "Проєкт із частинами", hint: "Розподіл частин роботи між учасниками" },
  { id: "shared_deck", label: "Спільна колода карток", hint: "Флеш-картки, які поповнює вся команда" },
];

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

export function CreateProjectSheet({
  onCreate,
  onClose,
}: {
  onCreate: (kind: TeamProjectKind, name: string, status?: string) => Promise<{ ok: boolean }>;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<TeamProjectKind>("note");
  const [name, setName] = useState("");
  const [weekday, setWeekday] = useState(1);
  const [time, setTime] = useState("19:00");
  const [pending, setPending] = useState(false);

  async function handleCreate() {
    if (!name.trim() || pending) return;
    setPending(true);
    const status = kind === "session" ? `${WEEKDAY_LABELS[weekday - 1]}, ${time}` : undefined;
    const result = await onCreate(kind, name, status);
    setPending(false);
    if (result.ok) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-card bg-bg p-5 shadow-card md:rounded-card" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[14px] font-bold text-text">Новий проєкт</div>
          <button onClick={onClose} className="text-[13px] font-bold text-text-dim">
            Закрити
          </button>
        </div>

        <div className="mb-4 space-y-1.5">
          {KIND_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setKind(opt.id)}
              className={cn("w-full rounded-card-sm border p-3 text-left", kind === opt.id ? "border-sage bg-sage/5" : "border-border bg-surface")}
            >
              <div className="text-[12.5px] font-bold text-text">{opt.label}</div>
              <div className="mt-0.5 text-[10.5px] text-text-faint">{opt.hint}</div>
            </button>
          ))}
        </div>

        <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-faint">Назва</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={kind === "session" ? "напр. Розбір угод" : "напр. Стратегія на тиждень"}
          className="mb-4 w-full rounded-input border border-border bg-surface px-3 py-2.5 text-[13px] text-text outline-none"
        />

        {kind === "session" && (
          <div className="mb-4 flex gap-2">
            <select
              value={weekday}
              onChange={(e) => setWeekday(Number(e.target.value))}
              className="flex-1 rounded-input border border-border bg-surface px-3 py-2.5 text-[13px] text-text outline-none"
            >
              {WEEKDAY_LABELS.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-28 rounded-input border border-border bg-surface px-3 py-2.5 text-[13px] text-text outline-none"
            />
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={!name.trim() || pending}
          className="w-full rounded-btn bg-text py-3 text-[12.5px] font-extrabold text-bg disabled:opacity-50"
        >
          {pending ? "Зачекай…" : "Додати проєкт"}
        </button>
      </div>
    </div>
  );
}
