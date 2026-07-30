import Link from "next/link";
import { ReactNode } from "react";
import { cn } from "@/lib/cn";

function StatCardBody({
  icon,
  label,
  value,
  unit,
  footer,
  valueClassName,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  footer?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-card-sm bg-surface shadow-card p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-medium text-text-dim">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={cn("font-mono text-[17px] font-bold text-text", valueClassName)}>
        {value}
        {unit && <span className="ml-1 text-[10.5px] font-normal text-text-faint">{unit}</span>}
      </div>
      {footer && <div className="mt-0.5 text-[10px] text-text-faint">{footer}</div>}
    </div>
  );
}

export function StatCard(props: {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  footer?: string;
  valueClassName?: string;
  href?: string;
}) {
  const { href, ...rest } = props;
  if (href) {
    return (
      <Link href={href} className="block">
        <StatCardBody {...rest} />
      </Link>
    );
  }
  return <StatCardBody {...rest} />;
}
