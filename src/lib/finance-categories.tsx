import type { ComponentType, SVGProps } from "react";
import type { GoalColor } from "./finance-store";
import {
  ShoppingCartIcon,
  UtensilsIcon,
  CoffeeCupIcon,
  CarIcon,
  ShoppingBagIcon,
  RefreshIcon,
  HouseIcon,
  ClapperboardIcon,
  PawIcon,
  BookIcon,
  HeartIcon,
  GlobeIcon,
  LaptopIcon,
  PlugIcon,
  SmartphoneIcon,
  DumbbellIcon,
  CoinsIcon,
  TransferIcon,
} from "@/components/icons";
import { cn } from "./cn";

export interface FinanceCategoryMeta {
  name: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Default icon-square color for a newly-created category — still just a
   *  starting point, not a fixed rule: BudgetCategoryForm's color picker can
   *  override it per category same as before. */
  color: GoalColor;
}

/** The app's fixed category set — replaces the old free-text "Своя категорія"
 *  flow (see claude_code_prompt finance redesign spec). Every budget category
 *  a user adds now picks one of these keys rather than typing a name, so a
 *  category's identity, icon and default color are all one lookup instead of
 *  three independently-editable fields.
 *
 *  "transfers" isn't in the original 18-item spec — it's kept from the old
 *  9-icon set because mcc-categories.ts genuinely needs somewhere to bucket
 *  P2P card-to-card sends (a real, already-solved classification problem),
 *  and none of the 18 spending categories fit money moving to another
 *  person rather than being spent. */
export const FINANCE_CATEGORIES = {
  groceries: { name: "Продукти", Icon: ShoppingCartIcon, color: "gold" },
  restaurant: { name: "Ресторан", Icon: UtensilsIcon, color: "gold" },
  coffee: { name: "Кав'ярні", Icon: CoffeeCupIcon, color: "gold" },
  car: { name: "Автомобіль", Icon: CarIcon, color: "sky" },
  taxi: { name: "Таксі", Icon: CarIcon, color: "sky" },
  clothes: { name: "Одяг", Icon: ShoppingBagIcon, color: "rose" },
  subscriptions: { name: "Підписки", Icon: RefreshIcon, color: "sky" },
  home: { name: "Дім", Icon: HouseIcon, color: "rose" },
  entertainment: { name: "Розваги", Icon: ClapperboardIcon, color: "clay" },
  pets: { name: "Улюбленці", Icon: PawIcon, color: "gold" },
  education: { name: "Освіта", Icon: BookIcon, color: "rose" },
  health: { name: "Здоров'я", Icon: HeartIcon, color: "sage" },
  travel: { name: "Подорожі", Icon: GlobeIcon, color: "sky" },
  tech: { name: "Техніка", Icon: LaptopIcon, color: "sky" },
  utilities: { name: "Комунальні", Icon: PlugIcon, color: "gold" },
  telecom: { name: "Телефон і інтернет", Icon: SmartphoneIcon, color: "sky" },
  sport: { name: "Спорт", Icon: DumbbellIcon, color: "sage" },
  salary: { name: "Зарплата", Icon: CoinsIcon, color: "sage" },
  transfers: { name: "Перекази на картку", Icon: TransferIcon, color: "clay" },
} as const satisfies Record<string, FinanceCategoryMeta>;

export type FinanceCategoryKey = keyof typeof FINANCE_CATEGORIES;

export const FINANCE_CATEGORY_KEYS = Object.keys(FINANCE_CATEGORIES) as FinanceCategoryKey[];

export function isFinanceCategoryKey(id: string): id is FinanceCategoryKey {
  return id in FINANCE_CATEGORIES;
}

/** Looks up a category by its stored key, falling back to "home" for any
 *  legacy or unrecognised value rather than throwing — old data (or a
 *  category key from a future app version) must still render *something*. */
export function categoryMeta(key: string): FinanceCategoryMeta {
  return isFinanceCategoryKey(key) ? FINANCE_CATEGORIES[key] : FINANCE_CATEGORIES.home;
}

/** A category's icon on its own tinted square/circle — thin-line SVG on a
 *  muted color-mixed background, matching finance_redesign.html exactly
 *  (replaces the earlier hotlinked 3D-PNG icon set). `color` is the
 *  category's own stored color (user-editable via BudgetCategoryForm), not
 *  necessarily its meta default, so two categories that share an Icon can
 *  still look different. */
export function CategoryIcon({
  categoryKey,
  color,
  className,
  iconClassName,
}: {
  categoryKey: string;
  color: GoalColor;
  className?: string;
  iconClassName?: string;
}) {
  const meta = categoryMeta(categoryKey);
  return (
    <div
      className={cn("flex flex-shrink-0 items-center justify-center", className)}
      style={{ background: `var(--${color}-soft)`, color: `var(--${color})` }}
    >
      <meta.Icon className={iconClassName ?? "h-1/2 w-1/2"} />
    </div>
  );
}
