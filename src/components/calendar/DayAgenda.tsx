"use client";

import { getHoliday } from "@/lib/holidays";
import { formatAgendaDate } from "@/lib/calendar-utils";
import { describeRecurrenceShort } from "@/lib/recurrence";
import type { CalendarItem } from "@/lib/calendar-store";
import type { CalendarEvent } from "@/app/api/calendar/events/route";
import { BellIcon, PinIcon, NoteIcon, RepeatIcon } from "@/components/icons";

const CATEGORY_LABEL: Record<CalendarItem["category"], string> = {
  personal: "Особисте",
  work: "Робота",
};

const CATEGORY_COLOR: Record<CalendarItem["category"], string> = {
  personal: "var(--sky)",
  work: "var(--gold)",
};

function RepeatBadge({ item }: { item: CalendarItem }) {
  if (!item.recurrence) return null;
  return (
    <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-semibold text-sage">
      <RepeatIcon className="h-2.5 w-2.5" />
      {describeRecurrenceShort(item.recurrence)}
    </span>
  );
}

function ReminderChips({ item }: { item: CalendarItem }) {
  const chips: string[] = [];
  if (item.reminder30) chips.push("30хв");
  if (item.reminder5) chips.push("5хв");
  if (item.reminderDayBefore) chips.push("за день");
  if (chips.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {chips.map((c) => (
        <span
          key={c}
          className="flex items-center gap-1 rounded-full border border-sage/25 bg-sage/10 px-1.5 py-0.5 text-[9px] text-sage"
        >
          <BellIcon className="h-2.5 w-2.5" /> {c}
        </span>
      ))}
    </div>
  );
}

export function DayAgenda({
  date,
  events,
  notes,
  googleEvents,
  onEdit,
  onDelete,
  onAdd,
}: {
  date: Date;
  events: CalendarItem[];
  notes: CalendarItem[];
  googleEvents: CalendarEvent[];
  onEdit: (item: CalendarItem) => void;
  onDelete: (item: CalendarItem) => void;
  onAdd: () => void;
}) {
  const holiday = getHoliday(date);
  const isEmpty = events.length === 0 && notes.length === 0 && googleEvents.length === 0;

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <div className="font-heading text-[14px] font-semibold text-text">
          {formatAgendaDate(date)}
        </div>
        <button
          onClick={onAdd}
          className="rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-bg"
        >
          + додати
        </button>
      </div>

      {holiday && (
        <div className="mb-3 rounded-card-sm bg-surface-2 shadow-card px-3 py-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold text-gold">
            <PinIcon className="h-3.5 w-3.5" /> {holiday.name}
          </div>
          <div className="text-[11px] text-text-dim">Державне свято</div>
        </div>
      )}

      {notes.map((note) => (
        <div key={note.id} className="mb-2 rounded-card-sm bg-surface-2 shadow-card px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold text-gold">
              <NoteIcon className="h-3.5 w-3.5" /> {note.title}
              <RepeatBadge item={note} />
            </div>
            <div className="flex flex-shrink-0 gap-2 text-[10px] text-text-faint">
              <button onClick={() => onEdit(note)}>ред.</button>
              <button onClick={() => onDelete(note)}>✕</button>
            </div>
          </div>
          <ReminderChips item={note} />
        </div>
      ))}

      {events.map((event) => (
        <div key={event.id} className="mb-1.5 flex gap-2.5">
          <div className="w-11 flex-shrink-0 pt-2.5 text-right font-mono text-[10.5px] text-text-faint">
            {event.time}
          </div>
          <div className="w-[2px] flex-shrink-0 rounded bg-border" />
          <div className="mb-2.5 flex-1 rounded-card-sm bg-surface shadow-card p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-text">
                {event.title}
                <RepeatBadge item={event} />
              </div>
              <div className="flex flex-shrink-0 gap-2 text-[10px] text-text-faint">
                <button onClick={() => onEdit(event)}>ред.</button>
                <button onClick={() => onDelete(event)}>✕</button>
              </div>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-text-faint">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_COLOR[event.category] }} />
              {CATEGORY_LABEL[event.category]}
              {event.durationMinutes && ` · ${event.durationMinutes} хв`}
            </div>
            <ReminderChips item={event} />
          </div>
        </div>
      ))}

      {googleEvents.map((event) => (
        <a
          key={event.id}
          href={event.htmlLink}
          target="_blank"
          rel="noreferrer"
          className="mb-1.5 flex gap-2.5"
        >
          <div className="w-11 flex-shrink-0 pt-2.5 text-right font-mono text-[10.5px] text-text-faint">
            {event.allDay
              ? "увесь"
              : new Date(event.start).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="w-[2px] flex-shrink-0 rounded bg-sage" />
          <div className="mb-2.5 flex-1 rounded-card-sm bg-surface shadow-card p-2.5">
            <div className="text-[12.5px] font-semibold text-text">{event.title}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-text-faint">
              <span className="h-1.5 w-1.5 rounded-full bg-sage" />
              Google Календар
            </div>
          </div>
        </a>
      ))}

      {isEmpty && (
        <div className="rounded-card-sm bg-surface shadow-card py-8 text-center text-[11.5px] text-text-faint">
          На цей день нічого не заплановано
        </div>
      )}
    </div>
  );
}
