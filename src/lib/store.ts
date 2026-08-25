"use client";

import { useEffect, useState } from "react";
import type { SVGProps } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BriefcaseIcon, TrendingUpIcon, GraduationCapIcon } from "@/components/icons";
import { DEFAULT_ENABLED_HEALTH_WIDGETS } from "@/lib/health-widget-config";

export type Profile = "trader" | "it" | "student";
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
  { id: "student", name: "Студент", Icon: GraduationCapIcon, desc: "Флеш-картки, курси, дедлайни" },
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
  /** Which Здоров'я dashboard widgets show, and in what order — see
   *  health-widget-config.ts. Replaces the old standalone `cycleEnabled`
   *  boolean: Цикл is just one more entry in this same list now, not a
   *  special case, extending the same "off until you opt in" principle to
   *  every widget instead of only Цикл. */
  enabledHealthWidgets: string[];
}

/** Every block the Home screen can render. "equity-curve"/"journal-link" only
 *  ever render for the trader profile and "it-work" only for the IT profile —
 *  see HomePage — so toggling one that doesn't apply to the current profile
 *  has no visible effect rather than being hidden from the settings list,
 *  which would make switching profiles silently lose the user's choice. */
export type HomeWidgetId =
  | "ai-card"
  | "today"
  | "week-balance"
  | "weather"
  | "equity-curve"
  | "journal-link"
  | "it-work";

export interface HomeWidgetConfig {
  id: HomeWidgetId;
  visible: boolean;
  order: number;
}

const DEFAULT_HOME_WIDGETS: HomeWidgetConfig[] = [
  { id: "ai-card", visible: true, order: 0 },
  { id: "today", visible: true, order: 1 },
  { id: "week-balance", visible: true, order: 2 },
  // Off by default, unlike every other widget: it's the only one that can ask
  // for a device permission, and an unprompted location dialog on first open
  // is the fastest way to get it denied for good. Added deliberately from the
  // gallery instead.
  { id: "weather", visible: false, order: 5 },
  { id: "equity-curve", visible: true, order: 3 },
  { id: "journal-link", visible: true, order: 4 },
  { id: "it-work", visible: true, order: 3 },
];

interface AppState {
  onboarded: boolean;
  profile: Profile;
  theme: Theme;
  nickname: string;
  avatarId: string;
  settings: GeneralSettings;
  hasSeenFirstLaunch: boolean;
  homeWidgets: HomeWidgetConfig[];
  setProfile: (p: Profile) => void;
  setTheme: (t: Theme) => void;
  setNickname: (n: string) => void;
  setAvatarId: (id: string) => void;
  updateSettings: (patch: Partial<GeneralSettings>) => void;
  completeOnboarding: (p: Profile) => void;
  markFirstLaunchSeen: () => void;
  toggleHomeWidget: (id: HomeWidgetId) => void;
  addHomeWidget: (id: HomeWidgetId) => void;
  /** Adds `id` to enabledHealthWidgets (appended at the end, so a
   *  just-re-enabled widget shows up last) if absent, removes it if
   *  present. */
  toggleHealthWidget: (id: string) => void;
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
        enabledHealthWidgets: DEFAULT_ENABLED_HEALTH_WIDGETS,
      },
      hasSeenFirstLaunch: false,
      homeWidgets: DEFAULT_HOME_WIDGETS,
      setProfile: (profile) => set({ profile }),
      setTheme: (theme) => set({ theme }),
      setNickname: (nickname) => set({ nickname }),
      setAvatarId: (avatarId) => set({ avatarId }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      completeOnboarding: (profile) => set({ profile, onboarded: true }),
      markFirstLaunchSeen: () => set({ hasSeenFirstLaunch: true }),
      toggleHomeWidget: (id) =>
        set((s) => ({
          homeWidgets: s.homeWidgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)),
        })),
      // Always appends to the end (max order + 1) rather than restoring
      // whatever order it had before it was hidden — matches picking it from
      // the gallery, where "added just now" should mean "shows up last".
      addHomeWidget: (id) =>
        set((s) => {
          const maxOrder = Math.max(0, ...s.homeWidgets.map((w) => w.order));
          return {
            homeWidgets: s.homeWidgets.map((w) => (w.id === id ? { ...w, visible: true, order: maxOrder + 1 } : w)),
          };
        }),
      toggleHealthWidget: (id) =>
        set((s) => {
          const enabled = s.settings.enabledHealthWidgets;
          const next = enabled.includes(id) ? enabled.filter((w) => w !== id) : [...enabled, id];
          return { settings: { ...s.settings, enabledHealthWidgets: next } };
        }),
    }),
    {
      name: "life-os-store",
      version: 2,
      migrate: (persisted, version) => {
        let state = persisted as AppState;

        // Shipping a NEW widget has to reach people who already have a saved
        // homeWidgets array — persisted state replaces the defaults wholesale,
        // so without this the weather widget would exist in code and be
        // invisible (and un-addable, since the gallery lists entries from this
        // same array) for every existing install.
        if (version < 1) {
          const known = new Set(state.homeWidgets?.map((w) => w.id) ?? []);
          const missing = DEFAULT_HOME_WIDGETS.filter((w) => !known.has(w.id));
          state = { ...state, homeWidgets: [...(state.homeWidgets ?? []), ...missing] };
        }

        // v1 -> v2: the standalone cycleEnabled boolean becomes membership in
        // enabledHealthWidgets (see "Здоров'я — bento-сітка + вибір
        // віджетів" prompt) — anyone who'd already turned Цикл on keeps it
        // on, folded into the same list as every other widget.
        if (version < 2) {
          const legacySettings = state.settings as (GeneralSettings & { cycleEnabled?: boolean }) | undefined;
          const cycleWasOn = legacySettings?.cycleEnabled === true;
          state = {
            ...state,
            settings: {
              ...state.settings,
              enabledHealthWidgets: [...DEFAULT_ENABLED_HEALTH_WIDGETS, ...(cycleWasOn ? ["cycle"] : [])],
            },
          };
        }

        return state;
      },
    }
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
