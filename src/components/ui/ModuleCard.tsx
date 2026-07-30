import { ReactNode } from "react";
import Link from "next/link";

function ModuleCardBody({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
}: {
  icon: ReactNode;
  iconBg?: string;
  iconColor?: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-2.5 rounded-card-sm bg-surface shadow-card p-3">
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px] text-sm"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-text">{title}</div>
        <div className="mt-0.5 text-[10.5px] text-text-faint">{subtitle}</div>
      </div>
      <div className="text-[13px] text-text-faint">›</div>
    </div>
  );
}

export function ModuleCard(props: {
  icon: ReactNode;
  iconBg?: string;
  iconColor?: string;
  title: string;
  subtitle: string;
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
