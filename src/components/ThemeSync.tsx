"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

export function ThemeSync() {
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-profile", profile);
  }, [theme, profile]);

  return null;
}
