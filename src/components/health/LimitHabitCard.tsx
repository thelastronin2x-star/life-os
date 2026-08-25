import type { Habit } from "@/lib/health-store";

interface LimitHabitCardProps {
  habit: Habit;
  /** "todayCount/cap" for a dailyCap habit, "weekTotal/cap" for a
   *  weeklyCap one — what's actually being capped, not always today's
   *  count (a weekly cap showing only today's count next to it would read
   *  as "you can have {cap} today", which isn't what a weekly limit means). */
  valueLabel: string;
  weekStates: ("empty" | "ok" | "over")[];
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}

/** Capped-counter habit card — the point is to show how much room is left,
 *  not just a running total. */
export function LimitHabitCard({ habit, valueLabel, weekStates, onIncrement, onDecrement, onRemove }: LimitHabitCardProps) {
  const cap = habit.dailyCap ?? habit.weeklyCap ?? 0;
  const capLabel = habit.dailyCap ? "на день" : "на тиждень";

  return (
    <div className="mb-2 rounded-card-sm bg-surface-2 p-3.5">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-bold text-text">{habit.name}</div>
          <div className="mt-0.5 text-[11px] text-text-faint">
            Ліміт: {cap} {capLabel}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={onDecrement}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-surface text-[14px] font-extrabold"
            style={{ color: "var(--health-habit-limit)" }}
          >
            −
          </button>
          <span className="min-w-[38px] text-center text-[15px] font-extrabold text-text">{valueLabel}</span>
          <button
            onClick={onIncrement}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-surface text-[14px] font-extrabold"
            style={{ color: "var(--health-habit-limit)" }}
          >
            +
          </button>
          <span onClick={onRemove} className="px-1 text-[13px] text-text-faint">
            ✕
          </span>
        </div>
      </div>

      <div className="mt-2.5 flex gap-1">
        {weekStates.map((state, i) => (
          <span
            key={i}
            className="h-[5px] flex-1 rounded-full"
            style={{
              background: state === "over" ? "var(--clay)" : state === "ok" ? "var(--health-habit-limit)" : "var(--border)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
