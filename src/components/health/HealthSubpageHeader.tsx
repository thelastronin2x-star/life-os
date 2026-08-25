import Link from "next/link";

export function HealthSubpageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="pb-3.5 pt-2">
      <Link href="/health" className="mb-2 flex items-center gap-2 text-[12.5px] text-text-dim">
        <span className="flex h-7 w-7 items-center justify-center rounded-icon border border-border bg-surface">
          ‹
        </span>
        Здоров&apos;я
      </Link>
      <div className="font-heading text-lg font-semibold text-text">{title}</div>
      <div className="mt-0.5 text-[11.5px] text-text-faint">{subtitle}</div>
    </div>
  );
}
