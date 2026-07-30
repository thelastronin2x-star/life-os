import { ReactNode } from "react";

export function Chip({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-full border border-border bg-surface px-3 py-1.5 text-[11px] text-text-dim">
      {children}
    </div>
  );
}
