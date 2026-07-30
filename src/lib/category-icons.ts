import type { SVGProps } from "react";
import {
  UtensilsIcon,
  CarIcon,
  ClapperboardIcon,
  SmartphoneIcon,
  HouseIcon,
  ShoppingBagIcon,
  PillIcon,
  BookIcon,
  TransferIcon,
} from "@/components/icons";

export interface CategoryIconOption {
  id: string;
  label: string;
  Icon: (props: SVGProps<SVGSVGElement>) => React.JSX.Element;
}

export const CATEGORY_ICON_OPTIONS: CategoryIconOption[] = [
  { id: "utensils", label: "Їжа", Icon: UtensilsIcon },
  { id: "car", label: "Транспорт", Icon: CarIcon },
  { id: "clapperboard", label: "Розваги", Icon: ClapperboardIcon },
  { id: "smartphone", label: "Підписки", Icon: SmartphoneIcon },
  { id: "house", label: "Дім", Icon: HouseIcon },
  { id: "shopping-bag", label: "Покупки", Icon: ShoppingBagIcon },
  { id: "pill", label: "Здоров'я", Icon: PillIcon },
  { id: "book", label: "Освіта", Icon: BookIcon },
  { id: "transfer", label: "Перекази на картку", Icon: TransferIcon },
];

export function getCategoryIcon(id: string) {
  return CATEGORY_ICON_OPTIONS.find((o) => o.id === id)?.Icon ?? ShoppingBagIcon;
}
