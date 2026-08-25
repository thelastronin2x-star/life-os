"use client";

import { useState } from "react";

/** The "+Своє" chip repeated across Здоров'я widgets (mood factors, symptom
 *  tags, activity types, habits) — tap turns it into a small text input,
 *  Enter or the confirm button commits it via `onAdd`. */
export function AddCustomChip({ onAdd, label = "+ Своє" }: { onAdd: (name: string) => void; label?: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  function commit() {
    const trimmed = value.trim();
    if (trimmed) onAdd(trimmed);
    setValue("");
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="rounded-full border border-dashed border-border px-2.5 py-1 text-[10.5px] text-text-faint"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        onBlur={commit}
        className="w-24 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[10.5px] text-text outline-none"
      />
    </div>
  );
}
