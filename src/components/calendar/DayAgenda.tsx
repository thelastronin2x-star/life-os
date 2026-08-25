"use client";

import { useState } from "react";
import { getHoliday } from "@/lib/holidays";
import { formatAgendaDate, formatDateKey, DAY_PERIODS, periodForHour, pluralizeUk } from "@/lib/calendar-utils";
import { describeRecurrenceShort } from "@/lib/recurrence";
import type { CalendarItem } from "@/lib/calendar-store";
import type { CalendarEvent } from "@/app/api/calendar/events/route";
import { MedsQuickView } from "./MedsQuickView";
import { useHealthStore } from "@/lib/health-store";
import { isMedicationReminderItem } from "@/lib/meds-calendar-link";
import { cn } from "@/lib/cn";

const CATEGORY_LABEL: Record<CalendarItem["category"], string> = {
  personal: "Особисте",
  work: "Робота",
};

const CATEGORY_COLOR: Record<CalendarItem["category"], string> = {
  personal: "var(--sky)",
  work: "var(--gold)",
};

const REMINDER_LABEL: Record<CalendarItem["reminder"], string | null> = {
  none: null,
  "10min": "нагад. 10хв",
  "1hour": "нагад. 1год",
  day: "нагад. за день",
};

function EventMeta({ item }: { item: CalendarItem }) {
  const bits: string[] = [];
  if (item.durationMinutes) bits.push(`${item.durationMinutes} хв`);
  const reminderText = REMINDER_LABEL[item.reminder];
  if (reminderText) bits.push(reminderText);
  const repeatText = item.recurrence ? describeRecurrenceShort(item.recurrence) : null;
  if (repeatText) bits.push(repeatText);

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-text-faint">
      <span style={{ color: CATEGORY_COLOR[item.category] }} className="font-semibold">
        {CATEGORY_LABEL[item.category]}
      </span>
      {bits.map((b) => (
        <span key={b}>· {b}</span>
      ))}
    </div>
  );
}

/** Manual "виконано" toggle for isWorkout events — the checked state IS the
 *  derived boolean "does an Активність entry with this calendarEventId+date
 *  already exist", not a separate stored flag (see use-workout-activity-
 *  sync.ts and the store's upsert/removeCalendarActivity). Tapping again
 *  undoes it, in case of a mistap or a plan that changed. */
function WorkoutDoneToggle({ item }: { item: CalendarItem }) {
  const synced = useHealthStore((s) =>
    s.activityEntries.some((a) => a.calendarEventId === item.id && a.date === item.date)
  );
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        const health = useHealthStore.getState();
        if (synced) {
          health.removeCalendarActivity(item.id, item.date);
        } else {
          health.upsertCalendarActivity({
            calendarEventId: item.id,
            date: item.date,
            type: item.title,
            minutes: item.durationMinutes ?? 0,
          });
        }
      }}
      className={cn("flex-shrink-0 px-1 text-[15px]", synced ? "text-sage" : "text-text-faint")}
    >
      ✓
    </span>
  );
}

function TimelineCard({
  item,
  onEdit,
  onDelete,
}: {
  item: CalendarItem;
  onEdit: (item: CalendarItem) => void;
  onDelete: (item: CalendarItem) => void;
}) {
  return (
    <button onClick={() => onEdit(item)} className="mb-2 flex w-full items-start gap-3 rounded-card-sm bg-surface p-3 text-left">
      {item.kind === "event" && item.time && (
        <span className="flex-shrink-0 rounded-btn bg-surface-2 px-2 py-1 font-mono text-[11px] font-bold text-text-dim">
          {item.time}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-text">{item.title}</div>
        <EventMeta item={item} />
      </div>
      {item.isWorkout && <WorkoutDoneToggle item={item} />}
      <span
        onClick={(e) => {
          e.stopPropagation();
          onDelete(item);
        }}
        className="flex-shrink-0 px-1 text-[13px] text-text-faint"
      >
        ✕
      </span>
    </button>
  );
}

export function DayAgenda({
  date,
  events,
  notes,
  googleEvents,
  onEdit,
  onDelete,
  onNavigate,
}: {
  date: Date;
  events: CalendarItem[];
  notes: CalendarItem[];
  googleEvents: CalendarEvent[];
  onEdit: (item: CalendarItem) => void;
  onDelete: (item: CalendarItem) => void;
  onNavigate: (direction: -1 | 1) => void;
}) {
  const [medsPopoverItems, setMedsPopoverItems] = useState<CalendarItem[] | null>(null);

  const holiday = getHoliday(date);
  const dateKey = formatDateKey(date);

  // Medication-reminder events (medicationId set) get a compact count marker
  // on the period header instead of a full TimelineCard — see the "Ліки в
  // Календарі" prompt. Kept out of `nonMedEvents` entirely so they never
  // show up as cards below.
  const nonMedEvents = events.filter((e) => !isMedicationReminderItem(e));
  const medEvents = events.filter((e) => isMedicationReminderItem(e));

  const groups = DAY_PERIODS.map((period) => ({
    period,
    items: nonMedEvents.filter((e) => periodForHour(e.time ? parseInt(e.time.split(":")[0], 10) : 12) === period),
    meds: medEvents.filter((e) => periodForHour(e.time ? parseInt(e.time.split(":")[0], 10) : 12) === period),
  }));
  const looseEvents = nonMedEvents.filter((e) => !e.time); // scheduled without a time — shown with the notes, not lost

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <div className="font-heading text-[15px] font-semibold text-text">{formatAgendaDate(date)}</div>
        <div className="flex gap-1.5">
          <button
            onClick={() => onNavigate(-1)}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-icon border border-border bg-surface text-text-dim"
          >
            ‹
          </button>
          <button
            onClick={() => onNavigate(1)}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-icon border border-border bg-surface text-text-dim"
          >
            ›
          </button>
        </div>
      </div>

      {holiday && (
        <div className="mb-3 rounded-card-sm bg-surface-2 px-3 py-2.5 text-[11.5px] font-medium text-text">
          {holiday.name} · державне свято
        </div>
      )}

      {(notes.length > 0 || looseEvents.length > 0) && (
        <div className="mb-3">
          {notes.map((note) => (
            <TimelineCard key={note.id} item={note} onEdit={onEdit} onDelete={onDelete} />
          ))}
          {looseEvents.map((event) => (
            <TimelineCard key={event.id} item={event} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}

      {groups.map(({ period, items, meds }) => (
        <div key={period.key} className="mb-3.5">
          <div className="mb-1.5 flex items-center gap-2.5">
            <span className="text-[11px] font-bold text-text-dim">{period.label}</span>
            {meds.length > 0 && (
              <span onClick={() => setMedsPopoverItems(meds)} className="meds-marker">
                {meds.length} {pluralizeUk(meds.length, ["прийом", "прийоми", "прийомів"])}
              </span>
            )}
            <span className="h-px flex-1 bg-border" />
          </div>
          {items.length === 0 ? (
            <div className="py-2 text-[11.5px] text-text-faint">Нічого не заплановано</div>
          ) : (
            items
              .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
              .map((event) => <TimelineCard key={event.id} item={event} onEdit={onEdit} onDelete={onDelete} />)
          )}
        </div>
      ))}

      {medsPopoverItems && (
        <MedsQuickView date={dateKey} items={medsPopoverItems} onClose={() => setMedsPopoverItems(null)} />
      )}

      {googleEvents.map((event) => (
        <a
          key={event.id}
          href={event.htmlLink}
          target="_blank"
          rel="noreferrer"
          className={cn("mb-2 flex w-full items-start gap-3 rounded-card-sm bg-surface p-3 text-left")}
        >
          <span className="flex-shrink-0 rounded-btn bg-surface-2 px-2 py-1 font-mono text-[11px] font-bold text-text-dim">
            {event.allDay ? "увесь" : new Date(event.start).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-text">{event.title}</div>
            <div className="mt-1 text-[10px] text-text-faint">Google Календар</div>
          </div>
        </a>
      ))}
    </div>
  );
}
