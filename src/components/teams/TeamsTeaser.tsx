"use client";

import Link from "next/link";
import { UsersIcon } from "@/components/icons";

/** Compact entry point into /work/teams from the Робота tab — same
 *  teaser-card pattern as NewsTeaser, reused across profiles since the
 *  underlying team feature is profile-agnostic (see teams/copy.ts for the
 *  per-profile wording differences on the actual team screen). */
export function TeamsTeaser() {
  return (
    <Link href="/work/teams" className="card-raised mb-4 flex items-center gap-3 rounded-card bg-surface p-3.5">
      <span className="well-pressed flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface-2 text-sage">
        <UsersIcon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-bold text-text">Команда</span>
        <span className="mt-0.5 block text-[10.5px] text-text-faint">Чат, спільні проєкти та рейтинг з друзями</span>
      </span>
      <span className="flex-shrink-0 text-[13px] text-text-faint">›</span>
    </Link>
  );
}
