import { ReactNode } from "react";

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mt-4 mb-2 flex items-center justify-between px-0.5">
      <span className="text-[11.5px] font-semibold uppercase tracking-wide text-text-dim">
        {children}
      </span>
      {action && (
        <span className="text-[11.5px] font-medium text-text-faint">{action}</span>
      )}
    </div>
  );
}
