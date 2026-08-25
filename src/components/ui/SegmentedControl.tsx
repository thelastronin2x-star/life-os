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
    <div className="mb-3.5 flex rounded-btn bg-surface-2 p-1">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`flex-1 rounded-btn py-2 text-center text-xs font-semibold transition-colors ${
            value === opt.id ? "bg-surface text-text shadow-card" : "text-text-dim"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
