import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** The shared card body: surface fill, neumorphic raised depth (see
 *  .card-raised in globals.css — mode-relative highlight/shadow pair, no
 *  border, matching every card-type element across the app). */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("card-raised rounded-card bg-surface p-4", className)}
      {...props}
    />
  );
}
