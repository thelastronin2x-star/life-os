import { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export type ModuleTone = "sage" | "clay" | "gold" | "sky" | "rose";

const TONE_BG: Record<ModuleTone, string> = {
  sage: "bg-sage-deep",
  clay: "bg-clay-deep",
  gold: "bg-gold-deep",
  sky: "bg-sky-deep",
  rose: "bg-rose-deep",
};

const TONE_TEXT: Record<ModuleTone, string> = {
  sage: "text-sage",
  clay: "text-clay",
  gold: "text-gold",
  sky: "text-sky",
  rose: "text-rose",
};

/** A link into another module: one compact row on the shared white card.
 *
 *  It used to be a fully tinted block with the module's glyph watermarked into
 *  the corner — the same weight as a widget that actually shows something. A
 *  row that only says "there is more over here" doesn't deserve the height of
 *  one that carries a number, so the tint is now a 24px chip and the card is
 *  a single line tall. */
function ModuleCardBody({
  icon,
  title,
  subtitle,
  tone = "sage",
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  tone?: ModuleTone;
}) {
  return (
    <div className="card-raised mb-1.5 flex items-center gap-2.5 rounded-card bg-surface px-3.5 py-2.5">
      <div
        aria-hidden
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-icon [&_svg]:h-4 [&_svg]:w-4",
          TONE_BG[tone],
          TONE_TEXT[tone]
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-bold tracking-[-0.015em] text-text">{title}</div>
        <div className="mt-0.5 truncate text-[11.5px] font-semibold text-text-faint">{subtitle}</div>
      </div>
      <div className="text-[15px] font-bold text-text-faint">›</div>
    </div>
  );
}

export function ModuleCard(props: {
  /** Drawn inside a 32px chip. Any size class on the icon is overridden to
   *  16px by the chip, so callers don't have to agree on one. */
  icon: ReactNode;
  title: string;
  subtitle: string;
  tone?: ModuleTone;
  href?: string;
}) {
  const { href, ...rest } = props;
  if (href) {
    return (
      <Link href={href} className="block">
        <ModuleCardBody {...rest} />
      </Link>
    );
  }
  return <ModuleCardBody {...rest} />;
}
