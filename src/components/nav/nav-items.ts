import {
  BalanceIcon,
  CalendarIcon,
  HomeIcon,
  WorkIcon,
} from "./icons";
import { HeartIcon } from "@/components/icons";

// The Асистент tab is gone — the assistant now lives inside Робота (its own
// inline block + "Повний чат →"), so /assistant is a real page you can still
// reach by link (same as /balance/monobank or /work/calculator), just no
// longer one of the 5 tabs. Баланс split into its own Здоров'я/Фінанси tabs
// instead of one shared segmented-control page.
export const NAV_ITEMS = [
  { href: "/", label: "Головна", icon: HomeIcon },
  { href: "/calendar", label: "Календар", icon: CalendarIcon },
  { href: "/health", label: "Здоров'я", icon: HeartIcon },
  { href: "/balance", label: "Фінанси", icon: BalanceIcon },
  { href: "/work", label: "Робота", icon: WorkIcon },
] as const;

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** True for routes that live outside the 5-tab set (currently only the Profile overlay). */
export function isOverlayRoute(pathname: string): boolean {
  return !NAV_ITEMS.some((item) => isNavItemActive(pathname, item.href));
}
