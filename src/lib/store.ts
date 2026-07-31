"use client";

import { useEffect, useState } from "react";
import type { SVGProps } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BriefcaseIcon, TrendingUpIcon } from "@/components/icons";

export type Profile = "trader" | "it";
export type Theme =
  | "soft-blocks"
  | "deep-forest"
  | "obsidian-violet"
  | "midnight-ice"
  | "charcoal-amber"
  | "slate-rose"
  | "ink-indigo"
  | "stone-rust"
  | "plum-noir"
  | "cloud"
  | "cloud-rose"
  | "cloud-sky";

export type ThemeMode = "dark" | "light";
export type DateFormat = "DMY" | "MDY" | "YMD";
export type Currency = "UAH" | "USD" | "EUR";
export type FirstDayOfWeek = "monday" | "sunday";

export const PROFILES: {
  id: Profile;
  name: string;
  Icon: (props: SVGProps<SVGSVGElement>) => React.JSX.Element;
  desc: string;
}[] = [
  { id: "trader", name: "Трейдер", Icon: TrendingUpIcon, desc: "Журнал угод, prop-акаунти" },
  { id: "it", name: "IT / Розробник", Icon: BriefcaseIcon, desc: "Спринти, фокус-час" },
];

export const THEMES: { id: Theme; name: string; mode: ThemeMode; swatches: string[] }[] = [
  { id: "soft-blocks", name: "М'які блоки", mode: "light", swatches: ["#F4F2EE", "#2E7D5B", "#C2553C"] },
  { id: "deep-forest", name: "Deep Forest", mode: "dark", swatches: ["#0E1210", "#8FBF9F", "#D9A867"] },
  { id: "obsidian-violet", name: "Obsidian Violet", mode: "dark", swatches: ["#0D0D10", "#8B7CFF", "#FF8A65"] },
  { id: "midnight-ice", name: "Midnight Ice", mode: "dark", swatches: ["#0A0E14", "#6FC6E0", "#E0A96F"] },
  { id: "charcoal-amber", name: "Charcoal Amber", mode: "dark", swatches: ["#111110", "#E0A959", "#B5654F"] },
  { id: "slate-rose", name: "Slate Rose", mode: "dark", swatches: ["#111318", "#D98FA3", "#7FA8C9"] },
  { id: "ink-indigo", name: "Ink Indigo", mode: "dark", swatches: ["#0B0D16", "#8B93E8", "#E8A96F"] },
  { id: "stone-rust", name: "Stone & Rust", mode: "dark", swatches: ["#15130F", "#C97B4A", "#9CAF88"] },
  { id: "plum-noir", name: "Plum Noir", mode: "dark", swatches: ["#160E14", "#C9A0D9", "#E0B15C"] },
  { id: "cloud", name: "Cloud", mode: "light", swatches: ["#FAFAF8", "#3E7A5C", "#B5694A"] },
  { id: "cloud-rose", name: "Cloud Rose", mode: "light", swatches: ["#FBF8F9", "#B85C79", "#4E7A97"] },
  { id: "cloud-sky", name: "Cloud Sky", mode: "light", swatches: ["#F8FAFB", "#3C7A96", "#C77B4A"] },
];

export const LANGUAGES: { id: "uk"; name: string; flag: string }[] = [
  { id: "uk", name: "Українська", flag: "🇺🇦" },
];

export const TIMEZONES: { id: string; name: string }[] = [
  { id: "GMT+2", name: "GMT+2 (Kyiv, winter)" },
  { id: "GMT+3", name: "GMT+3 (Kyiv)" },
  { id: "GMT+0", name: "GMT+0 (London)" },
  { id: "GMT-5", name: "GMT-5 (New York)" },
];

export const DATE_FORMATS: { id: DateFormat; name: string }[] = [
  { id: "DMY", name: "ДД.ММ.РРРР" },
  { id: "MDY", name: "ММ.ДД.РРРР" },
  { id: "YMD", name: "РРРР-ММ-ДД" },
];

export const CURRENCIES: { id: Currency; name: string; symbol: string }[] = [
  { id: "UAH", name: "Гривня", symbol: "₴" },
  { id: "USD", name: "Долар США", symbol: "$" },
  { id: "EUR", name: "Євро", symbol: "€" },
];

export const FIRST_DAY_OPTIONS: { id: FirstDayOfWeek; name: string }[] = [
  { id: "monday", name: "Понеділок" },
  { id: "sunday", name: "Неділя" },
];

interface GeneralSettings {
  language: "uk";
  timezone: string;
  dateFormat: DateFormat;
  currency: Currency;
  firstDayOfWeek: FirstDayOfWeek;
}

interface AppState {
  onboarded: boolean;
  profile: Profile;
  theme: Theme;
  nickname: string;
  avatarId: string;
  settings: GeneralSettings;
  hasSeenFirstLaunch: boolean;
  setProfile: (p: Profile) => void;
  setTheme: (t: Theme) => void;
  setNickname: (n: string) => void;
  setAvatarId: (id: string) => void;
  updateSettings: (patch: Partial<GeneralSettings>) => void;
  completeOnboarding: (p: Profile) => void;
  markFirstLaunchSeen: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      onboarded: false,
      profile: "trader",
      theme: "soft-blocks",
      nickname: "",
      avatarId: "person",
      settings: {
        language: "uk",
        timezone: "GMT+3",
        dateFormat: "DMY",
        currency: "UAH",
        firstDayOfWeek: "monday",
      },
      hasSeenFirstLaunch: false,
      setProfile: (profile) => set({ profile }),
      setTheme: (theme) => set({ theme }),
      setNickname: (nickname) => set({ nickname }),
      setAvatarId: (avatarId) => set({ avatarId }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      completeOnboarding: (profile) => set({ profile, onboarded: true }),
      markFirstLaunchSeen: () => set({ hasSeenFirstLaunch: true }),
    }),
    { name: "life-os-store" }
  )
);

export function useHasHydrated() {
  // useAppStore.persist is only attached client-side (the persist middleware
  // needs `window` to set up storage), so this must stay undefined-safe for SSR.
  const [hydrated, setHydrated] = useState(() => useAppStore.persist?.hasHydrated() ?? false);

  useEffect(() => {
    const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    // Safety net: if reading localStorage throws (restricted storage access,
    // some private-browsing/PWA configurations), zustand's persist middleware
    // never calls onFinishHydration and the whole app would stay blank forever
    // (AppLayout gates all rendering on `hydrated`). Proceed with in-memory
    // defaults instead of hanging indefinitely.
    const fallback = setTimeout(() => setHydrated(true), 2000);
    return () => {
      unsub();
      clearTimeout(fallback);
    };
  }, []);

  return hydrated;
}
