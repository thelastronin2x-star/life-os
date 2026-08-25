"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, type Profile } from "./store";

/** Redirects away from a profile-only sub-page when the active profile
 *  doesn't match. Shared by every profile's own sub-pages (Journal/library
 *  for Trader, the flashcard library for Student, ...) rather than each
 *  hand-rolling the same effect. */
function useProfileOnlyGuard(required: Profile): boolean {
  const profile = useAppStore((s) => s.profile);
  const router = useRouter();

  useEffect(() => {
    if (profile !== required) {
      router.replace("/work");
    }
  }, [profile, required, router]);

  return profile === required;
}

export function useTraderOnlyGuard(): boolean {
  return useProfileOnlyGuard("trader");
}

export function useStudentOnlyGuard(): boolean {
  return useProfileOnlyGuard("student");
}
