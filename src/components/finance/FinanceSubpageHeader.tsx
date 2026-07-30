import Link from "next/link";

export function FinanceSubpageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="pb-3.5 pt-2">
      <Link href="/balance?segment=finance" className="mb-2 flex items-center gap-2 text-[12.5px] text-text-dim">
        <span className="flex h-7 w-7 items-center justify-center rounded-[9px] border border-border bg-surface">
          ‹
        </span>
        Баланс → Фінанси
      </Link>
      <div className="font-heading text-lg font-semibold text-text">{title}</div>
      <div className="mt-0.5 text-[11.5px] text-text-faint">{subtitle}</div>
    </div>
  );
}
