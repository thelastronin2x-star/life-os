import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** The shared card body: surface fill, hairline border, soft shadow.
 *
 *  The border does the work the shadow can't. A shadow alone leaves the top
 *  edge of a white card undefined against a light canvas — there's nothing
 *  above it to cast onto — so the card appears to start somewhere in the
 *  middle of its own header. One hairline closes the shape. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-card border border-border bg-surface shadow-card p-4", className)}
      {...props}
    />
  );
}
