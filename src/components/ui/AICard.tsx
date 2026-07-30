import { ReactNode } from "react";

export function AICard({ text, sub }: { text: ReactNode; sub?: string }) {
  return (
    <div className="relative mb-3 overflow-hidden rounded-card bg-surface shadow-card p-3.5 pb-3">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-[130px] w-[130px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%)",
        }}
      />
      <div className="relative mb-2 flex items-center gap-1.5">
        <span className="relative flex h-[7px] w-[7px]">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-accent" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">
          Асистент
        </span>
      </div>
      <div className="relative text-[13.5px] font-medium leading-relaxed text-text [&_b]:text-text">
        {text}
      </div>
      {sub && <div className="relative mt-1.5 text-[11.5px] text-text-dim">{sub}</div>}
    </div>
  );
}
