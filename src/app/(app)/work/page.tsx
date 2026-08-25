"use client";

import { useAppStore } from "@/lib/store";
import { TraderWork } from "@/components/work/TraderWork";
import { StudentWork } from "@/components/student/StudentWork";
import { ITWork } from "@/components/work/ITWork";

/** Branches by profile — each profile's Робота tab is its own component
 *  tree (TraderWork/StudentWork/ITWork), never sharing layout beyond this
 *  switch. ITWork is still the "in development" placeholder (see its own
 *  file) — only Trader and Student have a real screen behind this tab so
 *  far. */
export default function WorkPage() {
  const profile = useAppStore((s) => s.profile);

  return (
    <div>
      {profile === "trader" && <TraderWork />}
      {profile === "student" && <StudentWork />}
      {profile === "it" && <ITWork />}
    </div>
  );
}
