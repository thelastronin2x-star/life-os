import type { ReactNode } from "react";
import type { FieldType } from "./schema-store";
import {
  TextFieldIcon,
  LongTextFieldIcon,
  NumberFieldIcon,
  ChevronDownIcon,
  ToggleFieldIcon,
  StarScaleIcon,
  CalendarDateIcon,
  ChecklistFieldIcon,
  BookIcon,
  HeartIcon,
  TargetIcon,
  PulseIcon,
  NotebookIcon,
  ChatBubbleIcon,
  TrendingUpIcon,
  GraduationCapIcon,
  CoffeeCupIcon,
  MoonIcon,
  DumbbellIcon,
  SparkleIcon,
} from "@/components/icons";

export const FIELD_TYPES: { id: FieldType; label: string; icon: (props: { className?: string }) => ReactNode }[] = [
  { id: "text", label: "Текст", icon: TextFieldIcon },
  { id: "longtext", label: "Довгий текст", icon: LongTextFieldIcon },
  { id: "number", label: "Число", icon: NumberFieldIcon },
  { id: "select", label: "Список вибору", icon: ChevronDownIcon },
  { id: "boolean", label: "Так/Ні", icon: ToggleFieldIcon },
  { id: "scale10", label: "Шкала 1-10", icon: StarScaleIcon },
  { id: "date", label: "Дата", icon: CalendarDateIcon },
  { id: "checklist", label: "Чеклист", icon: ChecklistFieldIcon },
];

export const FIELD_TYPE_META: Record<FieldType, { label: string; icon: (props: { className?: string }) => ReactNode; typeHint: string }> = {
  text: { label: "Текст", icon: TextFieldIcon, typeHint: "Текст" },
  longtext: { label: "Довгий текст", icon: LongTextFieldIcon, typeHint: "Текст (довгий)" },
  number: { label: "Число", icon: NumberFieldIcon, typeHint: "Число" },
  select: { label: "Список вибору", icon: ChevronDownIcon, typeHint: "Список вибору" },
  boolean: { label: "Так/Ні", icon: ToggleFieldIcon, typeHint: "Так/Ні" },
  scale10: { label: "Шкала 1-10", icon: StarScaleIcon, typeHint: "Шкала 1-10" },
  date: { label: "Дата", icon: CalendarDateIcon, typeHint: "Дата" },
  checklist: { label: "Чеклист", icon: ChecklistFieldIcon, typeHint: "Чеклист" },
};

/** Fixed icon-choice set for a schema's own identity — a curated subset of
 *  the app's existing icon library rather than a new upload/search picker. */
export const SCHEMA_ICONS: Record<string, (props: { className?: string }) => ReactNode> = {
  book: BookIcon,
  heart: HeartIcon,
  target: TargetIcon,
  pulse: PulseIcon,
  notebook: NotebookIcon,
  chat: ChatBubbleIcon,
  trending: TrendingUpIcon,
  graduation: GraduationCapIcon,
  coffee: CoffeeCupIcon,
  moon: MoonIcon,
  dumbbell: DumbbellIcon,
  sparkle: SparkleIcon,
};

export const DEFAULT_SCHEMA_ICON = "book";

export const ATTACH_TAB_LABELS: Record<import("./schema-store").AttachTab, string> = {
  work: "Робота",
  finance: "Фінанси",
  calendar: "Календар",
  health: "Здоров'я",
  home: "Головна",
};
