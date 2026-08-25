import type { Habit } from "@/lib/health-store";
import { cn } from "@/lib/cn";

interface BuildHabitCardProps {
  habit: Habit;
  streak: number;
  longestStreak: number;
  doneToday: boolean;
  weekDone: boolean[];
  onToggleToday: () => void;
  onRemove: () => void;
}

/** Streak-driven habit card — the point is to not break the run, not just
 *  log a fact. `streak >= longestStreak` naturally means "this run IS (or
 *  ties) the record" since longestStreak is derived from history that
 *  already includes the current run — no separate stored flag needed to
 *  know when to show "рекорд!". */
export function BuildHabitCard({ habit, streak, longestStreak, doneToday, weekDone, onToggleToday, onRemove }: BuildHabitCardProps) {
  const isDaily = habit.targetFrequency === "daily";
  const targetCount = isDaily ? 7 : (habit.targetFrequency ?? 1);
  const doneThisWeek = weekDone.filter(Boolean).length;

  return (
    <div className="mb-2 rounded-card-sm bg-surface-2 p-3.5">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-bold text-text">{habit.name}</div>
          <div className="mt-0.5 text-[11px] text-text-faint">{isDaily ? "Щодня" : `${habit.targetFrequency}x на тиждень`}</div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={onToggleToday}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border-2 text-[14px]",
              doneToday ? "border-transparent text-bg" : "border-border text-transparent"
            )}
            style={doneToday ? { background: "var(--health-habit-build)" } : undefined}
          >
            ✓
          </button>
          <span onClick={onRemove} className="px-1 text-[13px] text-text-faint">
            ✕
          </span>
        </div>
      </div>

      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="font-display text-[20px] font-extrabold" style={{ color: "var(--health-habit-build)" }}>
          {isDaily ? streak : doneThisWeek}
        </span>
        <span className="text-[11px] text-text-faint">
          {isDaily ? `днів поспіль${streak > 0 && streak >= longestStreak ? " — рекорд!" : ""}` : `з ${targetCount} цього тижня`}
        </span>
      </div>

      <div className="mt-2 flex gap-1">
        {weekDone.map((done, i) => (
          <span
            key={i}
            className="h-[5px] flex-1 rounded-full"
            style={{ background: done ? "var(--health-habit-build)" : "var(--border)" }}
          />
        ))}
      </div>
    </div>
  );
}
