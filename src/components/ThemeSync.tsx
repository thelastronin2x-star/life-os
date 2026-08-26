"use client";

import { useEffect } from "react";
import { useAppStore, THEMES } from "@/lib/store";

export function ThemeSync() {
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-profile", profile);
    const mode = THEMES.find((t) => t.id === theme)?.mode ?? "dark";
    document.documentElement.setAttribute("data-theme-mode", mode);
  }, [theme, profile]);

  return null;
}
