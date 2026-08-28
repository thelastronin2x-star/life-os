"use client";

import { useState } from "react";
import { HealthSubpageHeader } from "@/components/health/HealthSubpageHeader";
import { BuildHabitCard } from "@/components/health/BuildHabitCard";
import { LimitHabitCard } from "@/components/health/LimitHabitCard";
import { AddBuildHabitSheet } from "@/components/health/AddBuildHabitSheet";
import { AddLimitHabitSheet } from "@/components/health/AddLimitHabitSheet";
import { useHealthStore } from "@/lib/health-store";
import { useAppStore } from "@/lib/store";
import { formatDateKey } from "@/lib/calendar-utils";
import { computeCurrentStreak, computeLongestStreak, computeWeekDone, computeWeekCounts } from "@/lib/habit-utils";

export default function HabitsDetailPage() {
  const store = useHealthStore();
  const firstDayOfWeek = useAppStore((s) => s.settings.firstDayOfWeek);
  const today = formatDateKey(new Date());
  const [addBuildOpen, setAddBuildOpen] = useState(false);
  const [addLimitOpen, setAddLimitOpen] = useState(false);

  const buildHabits = store.habits.filter((h) => h.kind === "build");
  const limitHabits = store.habits.filter((h) => h.kind === "limit");

  return (
    <div>
      <HealthSubpageHeader title="Звички" subtitle="Розвиваю й обмежую — різна механіка" />

      <div className="card-raised rounded-card bg-surface p-5">
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className="text-[11.5px] font-bold text-text-faint">Розвиваю (стрік)</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        {buildHabits.length === 0 ? (
          <div className="mb-2 text-[11.5px] text-text-faint">Ще немає звичок цього типу</div>
        ) : (
          buildHabits.map((habit) => {
            const weekDone = computeWeekDone(habit.id, store.habitLogs, firstDayOfWeek);
            return (
              <BuildHabitCard
                key={habit.id}
                habit={habit}
                streak={computeCurrentStreak(habit.id, store.habitLogs)}
                longestStreak={computeLongestStreak(habit.id, store.habitLogs)}
                doneToday={(store.habitLogs[today]?.[habit.id] ?? 0) >= 1}
                weekDone={weekDone}
                onToggleToday={() => store.toggleHabitDone(today, habit.id)}
                onRemove={() => store.removeHabit(habit.id)}
              />
            );
          })
        )}

        <button
          onClick={() => setAddBuildOpen(true)}
          className="mt-1 w-full rounded-card-sm border border-dashed border-border py-3 text-center text-[13px] font-semibold text-text-faint"
        >
          + Нова звичка «розвиваю»
        </button>

        <div className="my-4.5 h-px bg-border" />

        <div className="mb-2.5 flex items-center gap-2.5">
          <span className="text-[11.5px] font-bold text-text-faint">Обмежую (лічильник)</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        {limitHabits.length === 0 ? (
          <div className="mb-2 text-[11.5px] text-text-faint">Ще немає звичок цього типу</div>
        ) : (
          limitHabits.map((habit) => {
            const todayCount = store.habitLogs[today]?.[habit.id] ?? 0;
            const weekCounts = computeWeekCounts(habit.id, store.habitLogs, firstDayOfWeek);
            const cap = habit.dailyCap ?? habit.weeklyCap ?? 0;

            let weekStates: ("empty" | "ok" | "over")[];
            let valueLabel: string;
            if (habit.dailyCap) {
              weekStates = weekCounts.map((c) => (c === 0 ? "empty" : c > cap ? "over" : "ok"));
              valueLabel = `${todayCount}/${cap}`;
            } else {
              // Weekly cap — a single day's count alone can't say "over",
              // only the running total through that day can, so a day is
              // flagged only once the cumulative total crosses the cap.
              let running = 0;
              weekStates = weekCounts.map((c) => {
                running += c;
                return c === 0 ? "empty" : running > cap ? "over" : "ok";
              });
              const weekTotal = weekCounts.reduce((sum, c) => sum + c, 0);
              valueLabel = `${weekTotal}/${cap}`;
            }

            return (
              <LimitHabitCard
                key={habit.id}
                habit={habit}
                valueLabel={valueLabel}
                weekStates={weekStates}
                onIncrement={() => store.incrementHabit(today, habit.id)}
                onDecrement={() => store.decrementHabit(today, habit.id)}
                onRemove={() => store.removeHabit(habit.id)}
              />
            );
          })
        )}

        <button
          onClick={() => setAddLimitOpen(true)}
          className="mt-1 w-full rounded-card-sm border border-dashed border-border py-3 text-center text-[13px] font-semibold text-text-faint"
        >
          + Нова звичка «обмежую»
        </button>
      </div>

      {addBuildOpen && (
        <AddBuildHabitSheet
          onClose={() => setAddBuildOpen(false)}
          onSubmit={({ name, targetFrequency }) => store.addBuildHabit(name, targetFrequency)}
        />
      )}
      {addLimitOpen && (
        <AddLimitHabitSheet
          onClose={() => setAddLimitOpen(false)}
          onSubmit={({ name, cap, capPeriod }) => store.addLimitHabit(name, cap, capPeriod)}
        />
      )}
    </div>
  );
}
