"use client";

export function PickerSheet<T extends string>({
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  title: string;
  options: { id: T; name: string }[];
  value: T;
  onSelect: (id: T) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="w-full max-w-md rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-heading text-[15px] font-semibold text-text">{title}</div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>
        <div className="space-y-2">
          {options.map((opt) => {
            const active = opt.id === value;
            return (
              <button
                key={opt.id}
                onClick={() => {
                  onSelect(opt.id);
                  onClose();
                }}
                className={`flex w-full items-center justify-between rounded-[12px] border p-3 text-left text-[13px] ${
                  active
                    ? "border-accent bg-surface-2 text-text"
                    : "border-border bg-surface text-text-dim"
                }`}
              >
                {opt.name}
                {active && <span className="text-accent">✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
