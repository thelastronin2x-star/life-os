import {
  AssistantIcon,
  BalanceIcon,
  CalendarIcon,
  HomeIcon,
  WorkIcon,
} from "./icons";

export const NAV_ITEMS = [
  { href: "/", label: "Головна", icon: HomeIcon },
  { href: "/calendar", label: "Календар", icon: CalendarIcon },
  { href: "/balance", label: "Баланс", icon: BalanceIcon },
  { href: "/assistant", label: "Асистент", icon: AssistantIcon },
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
