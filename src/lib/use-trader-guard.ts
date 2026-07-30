"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "./store";

/** Redirects away from Trader-only sub-pages when the active profile isn't Trader. */
export function useTraderOnlyGuard(): boolean {
  const profile = useAppStore((s) => s.profile);
  const router = useRouter();

  useEffect(() => {
    if (profile !== "trader") {
      router.replace("/work");
    }
  }, [profile, router]);

  return profile === "trader";
}
