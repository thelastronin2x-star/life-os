"use client";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-3.5 flex rounded-xl border border-border bg-surface p-1">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`flex-1 rounded-lg py-2 text-center text-xs font-semibold transition-colors ${
            value === opt.id ? "bg-surface-2 text-text" : "text-text-faint"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
