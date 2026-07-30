"use client";

import { useMemo, useState } from "react";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { DayAgenda } from "@/components/calendar/DayAgenda";
import { EventForm } from "@/components/calendar/EventForm";
import { FloatingAssistant } from "@/components/assistant/FloatingAssistant";
import { useCalendarStore, type CalendarCategory, type CalendarItem } from "@/lib/calendar-store";
import { expandItemsForRange } from "@/lib/recurrence";
import { formatDateKey, parseDateKey } from "@/lib/calendar-utils";
import { useAppStore } from "@/lib/store";
import {
  getNotificationPermission,
  requestNotificationPermission,
  useReminderNotifications,
} from "@/lib/use-reminder-notifications";
import { BellIcon } from "@/components/icons";

type EditContext = "all" | "occurrence" | null;
type PendingChoice = { action: "edit" | "delete"; item: CalendarItem } | null;

export default function CalendarPage() {
  const firstDayOfWeek = useAppStore((s) => s.settings.firstDayOfWeek);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState(formatDateKey(today));
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null);
  const [editContext, setEditContext] = useState<EditContext>(null);
  const [pendingChoice, setPendingChoice] = useState<PendingChoice>(null);

  const { items, addItem, updateItem, removeItem } = useCalendarStore();
  useReminderNotifications();

  const [notifPermission, setNotifPermission] = useState(() => getNotificationPermission());

  // Expand recurring events across a buffer of ±1 month around the visible
  // month — comfortably covers MonthGrid's overflow days from adjacent months.
  const expandedItems = useMemo(() => {
    const rangeStart = new Date(viewYear, viewMonth - 1, 1);
    const rangeEnd = new Date(viewYear, viewMonth + 2, 0);
    return expandItemsForRange(items, rangeStart, rangeEnd);
  }, [items, viewYear, viewMonth]);

  const categoriesByDate = useMemo(() => {
    const map: Record<string, Set<CalendarCategory>> = {};
    for (const item of expandedItems) {
      if (!map[item.date]) map[item.date] = new Set();
      map[item.date].add(item.category);
    }
    return map;
  }, [expandedItems]);

  const selectedDate = parseDateKey(selectedKey);

  const dayEvents = expandedItems
    .filter((i) => i.date === selectedKey && i.kind === "event")
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  const dayNotes = expandedItems.filter((i) => i.date === selectedKey && i.kind === "note");

  function handleNavigate(direction: -1 | 1) {
    let newMonth = viewMonth + direction;
    let newYear = viewYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setViewMonth(newMonth);
    setViewYear(newYear);
  }

  function handleSelectDay(key: string) {
    setSelectedKey(key);
    const d = parseDateKey(key);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function openAddForm() {
    setEditingItem(null);
    setEditContext(null);
    setFormOpen(true);
  }

  function requestEdit(item: CalendarItem) {
    if (item.recurrence) {
      setPendingChoice({ action: "edit", item });
      return;
    }
    setEditingItem(item);
    setEditContext(null);
    setFormOpen(true);
  }

  function requestDelete(item: CalendarItem) {
    if (item.recurrence) {
      setPendingChoice({ action: "delete", item });
      return;
    }
    removeItem(item.id);
  }

  function resolvePendingChoice(scope: "all" | "occurrence") {
    if (!pendingChoice) return;
    const { action, item } = pendingChoice;
    setPendingChoice(null);

    if (action === "delete") {
      if (scope === "all") {
        removeItem(item.id);
        return;
      }
      const original = items.find((i) => i.id === item.id);
      if (original?.recurrence) {
        updateItem(item.id, {
          recurrence: { ...original.recurrence, excludedDates: [...original.recurrence.excludedDates, item.date] },
        });
      }
      return;
    }

    // action === "edit"
    if (scope === "all") {
      const original = items.find((i) => i.id === item.id) ?? item;
      setEditingItem(original);
      setEditContext("all");
    } else {
      setEditingItem({ ...item, recurrence: null });
      setEditContext("occurrence");
    }
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingItem(null);
    setEditContext(null);
  }

  function handleSave(data: Omit<CalendarItem, "id">) {
    if (editContext === "occurrence" && editingItem) {
      const original = items.find((i) => i.id === editingItem.id);
      if (original?.recurrence) {
        updateItem(original.id, {
          recurrence: { ...original.recurrence, excludedDates: [...original.recurrence.excludedDates, editingItem.date] },
        });
      }
      addItem(data);
    } else if (editingItem) {
      updateItem(editingItem.id, data);
    } else {
      addItem(data);
    }
    closeForm();
  }

  function handleDelete(id: string) {
    if (editContext === "occurrence" && editingItem) {
      const original = items.find((i) => i.id === id);
      if (original?.recurrence) {
        updateItem(id, {
          recurrence: { ...original.recurrence, excludedDates: [...original.recurrence.excludedDates, editingItem.date] },
        });
      }
    } else {
      removeItem(id);
    }
    closeForm();
  }

  return (
    <div>
      <div className="pb-3.5 pt-2">
        <div className="font-heading text-lg font-semibold text-text">Календар</div>
        <div className="mt-0.5 text-[11.5px] text-text-faint">особисте · свята</div>
      </div>

      {notifPermission === "default" && (
        <button
          onClick={() => requestNotificationPermission().then(setNotifPermission)}
          className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-card-sm bg-surface shadow-card px-3 py-2.5 text-center text-[11.5px] font-medium text-text-dim"
        >
          <BellIcon className="h-3.5 w-3.5" /> Увімкнути нагадування у браузері (поки вкладка відкрита)
        </button>
      )}

      <MonthGrid
        year={viewYear}
        month={viewMonth}
        selectedKey={selectedKey}
        categoriesByDate={categoriesByDate}
        firstDayOfWeek={firstDayOfWeek}
        onSelectDay={handleSelectDay}
        onNavigate={handleNavigate}
      />

      <DayAgenda
        date={selectedDate}
        events={dayEvents}
        notes={dayNotes}
        googleEvents={[]}
        onEdit={requestEdit}
        onDelete={requestDelete}
        onAdd={openAddForm}
      />

      {formOpen && (
        <EventForm
          initialDateKey={selectedKey}
          editingItem={editingItem}
          onSave={handleSave}
          onClose={closeForm}
          onDelete={editingItem ? handleDelete : undefined}
        />
      )}

      {pendingChoice && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 md:items-center">
          <div className="w-full max-w-md rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
            <div className="mb-4 text-center text-[13.5px] text-text-dim">
              Ця подія повторюється. Що {pendingChoice.action === "edit" ? "редагувати" : "видалити"}?
            </div>
            <button
              onClick={() => resolvePendingChoice("occurrence")}
              className="mb-2 w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg"
            >
              Тільки цю подію
            </button>
            <button
              onClick={() => resolvePendingChoice("all")}
              className="mb-2 w-full rounded-btn border border-border py-2.5 text-center text-[12.5px] font-semibold text-text"
            >
              Усі повторення
            </button>
            <button
              onClick={() => setPendingChoice(null)}
              className="w-full py-2 text-center text-[12px] text-text-faint"
            >
              Скасувати
            </button>
          </div>
        </div>
      )}

      <FloatingAssistant context="calendar" />
    </div>
  );
}
