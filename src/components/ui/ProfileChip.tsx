import Link from "next/link";

export function ProfileChip({ name }: { name: string }) {
  return (
    <Link
      href="/profile"
      className="relative flex items-center gap-1.5 rounded-full border border-border bg-surface-2 py-1.5 pl-3 pr-1.5 text-[10.5px] text-text-dim"
    >
      <span className="absolute -right-1.5 -top-2 rounded-full bg-accent px-1.5 py-0.5 text-[7.5px] font-bold text-bg shadow-lg">
        тап →
      </span>
      <span className="h-[5px] w-[5px] rounded-full bg-accent" />
      {name}
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-border text-[9px] text-text-faint">
        ›
      </span>
    </Link>
  );
}
