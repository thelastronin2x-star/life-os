import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function IconButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "flex h-[30px] w-[30px] items-center justify-center rounded-icon border border-border bg-surface text-sm text-text-dim",
        className
      )}
      {...props}
    />
  );
}
