"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CURRENCIES,
  DATE_FORMATS,
  FIRST_DAY_OPTIONS,
  LANGUAGES,
  TIMEZONES,
  useAppStore,
} from "@/lib/store";
import { PickerSheet } from "@/components/ui/PickerSheet";
import { BuildInfo } from "@/components/BuildInfo";
import { useGoogleCalendar } from "@/lib/use-google-calendar";
import { deleteAllUserData } from "@/lib/delete-data";
import {
  GlobeIcon,
  ClockIcon,
  BanknoteIcon,
  CalendarDateIcon,
  HeartIcon,
  SmartphoneIcon,
  BellIcon,
  DocumentIcon,
  TrashIcon,
} from "@/components/icons";

const SETTINGS_ITEMS = [{ label: "Сповіщення асистента", value: "Увімкнено" }];

type ActivePicker = "language" | "timezone" | "currency" | "dateFormat" | "firstDayOfWeek" | null;

function MenuRow({
  icon,
  title,
  sub,
  right,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3.5 border-b border-border py-3.5 text-left last:border-b-0 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-dim">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-text">{title}</span>
        {sub && <span className="mt-0.5 block text-[10.5px] text-text-faint">{sub}</span>}
      </span>
      {right}
    </Comp>
  );
}

export default function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const { status: gcalStatus, email: gcalEmail, disconnect: gcalDisconnect } = useGoogleCalendar();

  const languageName = LANGUAGES.find((l) => l.id === settings.language)!.name;
  const timezoneName = TIMEZONES.find((t) => t.id === settings.timezone)?.name ?? settings.timezone;
  const dateFormatName = DATE_FORMATS.find((d) => d.id === settings.dateFormat)!.name;
  const firstDayName = FIRST_DAY_OPTIONS.find((f) => f.id === settings.firstDayOfWeek)!.name;

  function handleConfirmDelete() {
    deleteAllUserData();
    setConfirmDelete(false);
    setDeleted(true);
  }

  return (
    <div>
      <Link href="/profile" className="mb-2 flex items-center gap-2 pt-2 text-[12.5px] text-text-dim">
        <span className="flex h-7 w-7 items-center justify-center rounded-[9px] border border-border bg-surface">
          ‹
        </span>
        Профіль
      </Link>
      <div className="mb-4 pt-2 font-heading text-lg font-semibold text-text">Налаштування</div>

      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-faint">
        Загальні
      </div>
      <div className="mb-4">
        <MenuRow
          icon={<GlobeIcon className="h-4 w-4" />}
          title="Мова"
          onClick={() => setActivePicker("language")}
          right={<span className="text-[11px] text-text-faint">{languageName} ›</span>}
        />
        <MenuRow
          icon={<ClockIcon className="h-4 w-4" />}
          title="Часовий пояс"
          onClick={() => setActivePicker("timezone")}
          right={<span className="text-[11px] text-text-faint">{timezoneName} ›</span>}
        />
        <MenuRow
          icon={<BanknoteIcon className="h-4 w-4" />}
          title="Валюта"
          onClick={() => setActivePicker("currency")}
          right={
            <span className="text-[11px] text-text-faint">
              {CURRENCIES.find((c) => c.id === settings.currency)!.symbol} {settings.currency} ›
            </span>
          }
        />
        <MenuRow
          icon={<CalendarDateIcon className="h-4 w-4" />}
          title="Формат дати"
          onClick={() => setActivePicker("dateFormat")}
          right={<span className="text-[11px] text-text-faint">{dateFormatName} ›</span>}
        />
        <MenuRow
          icon={<CalendarDateIcon className="h-4 w-4" />}
          title="Перший день тижня"
          onClick={() => setActivePicker("firstDayOfWeek")}
          right={<span className="text-[11px] text-text-faint">{firstDayName} ›</span>}
        />
      </div>

      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-faint">
        Підключення
      </div>
      <div className="mb-4">
        <MenuRow
          icon={<HeartIcon className="h-4 w-4" />}
          title="Apple Health"
          sub="Недоступно у веб-версії"
          disabled
        />
        <MenuRow
          icon={<SmartphoneIcon className="h-4 w-4" />}
          title="Screen Time"
          sub="Недоступно у веб-версії"
          disabled
        />
        <MenuRow
          icon={<CalendarDateIcon className="h-4 w-4" />}
          title="Google Calendar"
          sub={
            gcalStatus === "loading"
              ? "Перевірка…"
              : gcalStatus === "connected"
                ? (gcalEmail ?? "Підключено")
                : "Не підключено"
          }
          right={
            gcalStatus === "connected" ? (
              <button
                onClick={gcalDisconnect}
                className="flex-shrink-0 rounded-full border border-border px-2.5 py-1 text-[10px] text-text-faint"
              >
                Відключити
              </button>
            ) : gcalStatus === "disconnected" ? (
              <a
                href="/api/auth/google"
                className="flex-shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-semibold text-accent"
              >
                Підключити
              </a>
            ) : null
          }
        />
      </div>

      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-faint">
        Асистент
      </div>
      <div className="mb-4">
        {SETTINGS_ITEMS.map((item) => (
          <MenuRow
            key={item.label}
            icon={<BellIcon className="h-4 w-4" />}
            title={item.label}
            right={<span className="text-[11px] text-text-faint">{item.value} ›</span>}
          />
        ))}
      </div>

      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-faint">
        Дані та приватність
      </div>
      <div className="mb-4">
        <MenuRow
          icon={<DocumentIcon className="h-4 w-4" />}
          title="Експорт даних"
          sub="Незабаром"
          disabled
        />
        <MenuRow
          icon={<TrashIcon className="h-4 w-4 text-rose" />}
          title="Видалити всі локальні дані"
          sub="Угоди, транзакції, події календаря"
          onClick={() => setConfirmDelete(true)}
        />
      </div>

      <BuildInfo />

      {activePicker === "language" && (
        <PickerSheet
          title="Мова застосунку"
          options={LANGUAGES.map((l) => ({ id: l.id, name: `${l.flag} ${l.name}` }))}
          value={settings.language}
          onSelect={(language) => updateSettings({ language })}
          onClose={() => setActivePicker(null)}
        />
      )}
      {activePicker === "timezone" && (
        <PickerSheet
          title="Часовий пояс"
          options={TIMEZONES}
          value={settings.timezone}
          onSelect={(timezone) => updateSettings({ timezone })}
          onClose={() => setActivePicker(null)}
        />
      )}
      {activePicker === "currency" && (
        <PickerSheet
          title="Валюта за замовчуванням"
          options={CURRENCIES.map((c) => ({ id: c.id, name: `${c.symbol} ${c.name}` }))}
          value={settings.currency}
          onSelect={(currency) => updateSettings({ currency })}
          onClose={() => setActivePicker(null)}
        />
      )}
      {activePicker === "dateFormat" && (
        <PickerSheet
          title="Формат дати"
          options={DATE_FORMATS}
          value={settings.dateFormat}
          onSelect={(dateFormat) => updateSettings({ dateFormat })}
          onClose={() => setActivePicker(null)}
        />
      )}
      {activePicker === "firstDayOfWeek" && (
        <PickerSheet
          title="Перший день тижня"
          options={FIRST_DAY_OPTIONS}
          value={settings.firstDayOfWeek}
          onSelect={(firstDayOfWeek) => updateSettings({ firstDayOfWeek })}
          onClose={() => setActivePicker(null)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5">
          <div className="w-full max-w-sm rounded-card bg-bg shadow-card p-5">
            <div className="mb-2 font-heading text-[15px] font-semibold text-text">
              Видалити всі дані?
            </div>
            <div className="mb-4 text-[12.5px] leading-relaxed text-text-dim">
              Це назавжди видалить усі угоди, транзакції, події календаря, prop-акаунти та
              історію асистента з цього пристрою. Це неможливо скасувати.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-btn border border-border py-2.5 text-center text-[12.5px] font-semibold text-text-dim"
              >
                Скасувати
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 rounded-btn bg-rose py-2.5 text-center text-[12.5px] font-semibold text-bg"
              >
                Так, видалити
              </button>
            </div>
          </div>
        </div>
      )}

      {deleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5">
          <div className="w-full max-w-sm rounded-card bg-bg shadow-card p-5 text-center">
            <div className="mb-2 font-heading text-[15px] font-semibold text-text">Готово</div>
            <div className="mb-4 text-[12.5px] leading-relaxed text-text-dim">
              Усі локальні дані видалено.
            </div>
            <button
              onClick={() => setDeleted(false)}
              className="w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg"
            >
              Ок
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
