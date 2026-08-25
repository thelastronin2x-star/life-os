"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDateKey } from "@/lib/calendar-utils";
import { useHealthStore, DEFAULT_ACTIVITY_TYPES, FEELING_LEVELS, BODY_ZONES } from "@/lib/health-store";
import { computeHealthInsights } from "@/lib/health-insights";
import { computeCycleStatus, formatClock, formatDuration, formatLiters, minutesBetween, CYCLE_PHASE_LABEL } from "@/lib/health-utils";
import { computeCurrentStreak, computeWeekDone } from "@/lib/habit-utils";
import { useAppStore } from "@/lib/store";
import { HEALTH_WIDGET_CONFIG, type HealthWidgetId } from "@/lib/health-widget-config";
import { AIInsightCard } from "@/components/ui/AIInsightCard";
import { HealthWidgetCard } from "@/components/health/HealthWidgetCard";
import { CustomWaterAmountSheet } from "@/components/health/CustomWaterAmountSheet";
import { DraggableQualitySlider } from "@/components/health/DraggableQualitySlider";
import { sendSelfPush } from "@/lib/push-confirm";
import { MoonIcon, DropletIcon, PulseIcon, PillIcon, DumbbellIcon, FireIcon, RepeatIcon, GearIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

const FEELING_OPTIONS = FEELING_LEVELS.map((label) => ({ value: label, label }));

export default function HealthPage() {
  const router = useRouter();
  const today = formatDateKey(new Date());
  const store = useHealthStore();
  const enabledHealthWidgets = useAppStore((s) => s.settings.enabledHealthWidgets) as HealthWidgetId[];
  const firstDayOfWeek = useAppStore((s) => s.settings.firstDayOfWeek);

  const insights = useMemo(
    () =>
      computeHealthInsights({
        sleepSessions: store.sleepSessions,
        wellbeingEntries: store.wellbeingEntries,
        waterEntries: store.waterEntries,
        activityEntries: store.activityEntries,
        waterGoalMl: store.waterGoalMl,
        habits: store.habits,
        habitLogs: store.habitLogs,
      }),
    [
      store.sleepSessions,
      store.wellbeingEntries,
      store.waterEntries,
      store.activityEntries,
      store.waterGoalMl,
      store.habits,
      store.habitLogs,
    ]
  );

  // Сон — `now` is read inside an effect, not during render, so the
  // component stays pure (react-hooks/purity); it's null on the very first
  // render, so the recovery banner just doesn't flash in before mount.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the wall clock is inherently impure and can't happen during render; this is the one-time post-mount read, not a derived value
    setNow(Date.now());
  }, []);
  const activeSleep = store.sleepSessions.find((s) => s.wakeAt === null);
  const isStaleSleep =
    now !== null && activeSleep && now - new Date(activeSleep.sleepAt).getTime() > 13 * 3600 * 1000;
  const lastSleep = [...store.sleepSessions]
    .filter((s) => s.wakeAt)
    .sort((a, b) => new Date(b.wakeAt!).getTime() - new Date(a.wakeAt!).getTime())[0];
  const [recoveryTime, setRecoveryTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [customWaterOpen, setCustomWaterOpen] = useState(false);

  function confirmRecovery() {
    if (!activeSleep) return;
    const [h, m] = recoveryTime.split(":").map(Number);
    const wake = new Date();
    wake.setHours(h, m, 0, 0);
    store.endSleep(wake.toISOString());
  }

  // Вода
  const todayWaterMl = store.waterEntries.filter((e) => e.date === today).reduce((sum, e) => sum + e.ml, 0);
  const waterPct = Math.min(100, Math.round((todayWaterMl / store.waterGoalMl) * 100));

  // Самопочуття
  const todayWellbeing = store.wellbeingEntries.find((e) => e.date === today);
  const activeZoneLabels = BODY_ZONES.filter((z) => todayWellbeing?.bodyZones.includes(z.id));

  // Ліки
  const doneMedIds = store.medIntakes[today] ?? [];
  const doneMedCount = store.medications.filter((m) => doneMedIds.includes(m.id)).length;
  const medsPct = store.medications.length === 0 ? 0 : Math.round((doneMedCount / store.medications.length) * 100);

  // Активність
  const todayActivity = store.activityEntries.filter((e) => e.date === today);
  const activityTypes = [...DEFAULT_ACTIVITY_TYPES, ...store.customActivityTypes];

  // Звички
  const todayHabits = store.habitLogs[today] ?? {};

  // Цикл
  const cycle = computeCycleStatus(store.periodStarts, store.cycleSettings);

  // One entry per bento cell — looked up by id and rendered in
  // enabledHealthWidgets' order below, rather than a fixed top-to-bottom
  // sequence, so the widget picker (health/widgets/page.tsx) can actually
  // control both which of these show and in what order.
  const widgetElements: Record<HealthWidgetId, React.ReactNode> = {
    sleep: (
      <HealthWidgetCard href="/health/sleep" icon={<MoonIcon />} iconAccent="var(--health-sleep)" title="Сон">
        {activeSleep ? (
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] text-text-dim">Заснув(ла) о {formatClock(activeSleep.sleepAt)}</span>
            <button
              onClick={(e) => {
                e.preventDefault();
                const wakeAt = new Date();
                store.endSleep(wakeAt.toISOString());
                sendSelfPush("Сон завершено", `Тривалість: ${formatDuration(minutesBetween(activeSleep.sleepAt, wakeAt.toISOString()))}`);
                router.push("/health/sleep");
              }}
              className="pointer-events-auto relative z-10 rounded-full bg-sky px-3 py-1.5 text-[11px] font-semibold text-bg"
            >
              Прокинувся(лась)
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] text-text-dim">
              {lastSleep && lastSleep.wakeAt
                ? `${formatDuration(minutesBetween(lastSleep.sleepAt, lastSleep.wakeAt))} · ${formatClock(lastSleep.sleepAt)}–${formatClock(lastSleep.wakeAt)}`
                : "Ще немає записів"}
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                store.startSleep();
                sendSelfPush("Сон розпочато", `Заснув(ла) о ${formatClock(new Date().toISOString())}`);
              }}
              className="pointer-events-auto relative z-10 rounded-full bg-sky px-3 py-1.5 text-[11px] font-semibold text-bg"
            >
              Лягти спати
            </button>
          </div>
        )}
      </HealthWidgetCard>
    ),

    water: (
      <HealthWidgetCard
        href="/health/water"
        icon={<DropletIcon />}
        iconAccent="var(--health-water)"
        title="Вода"
        meta={
          <span className="text-[10.5px] text-text-faint">
            {formatLiters(todayWaterMl)} з {formatLiters(store.waterGoalMl)} л
          </span>
        }
      >
        <div className="mb-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-gold" style={{ width: `${waterPct}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[150, 250, 500].map((ml) => (
            <button
              key={ml}
              onClick={(e) => {
                e.preventDefault();
                store.addWater(ml);
              }}
              className="pointer-events-auto relative z-10 rounded-icon bg-surface-2 py-2 text-center text-[12px] font-bold"
              style={{ color: "var(--health-water)" }}
            >
              +{ml}
            </button>
          ))}
          <button
            onClick={(e) => {
              e.preventDefault();
              setCustomWaterOpen(true);
            }}
            aria-label="Свій обсяг"
            className="pointer-events-auto relative z-10 rounded-icon border border-dashed border-border py-2 text-center text-[12px] font-bold text-text-faint"
          >
            ✎
          </button>
        </div>
      </HealthWidgetCard>
    ),

    wellbeing: (
      <HealthWidgetCard
        href="/health/wellbeing"
        icon={<PulseIcon />}
        iconAccent="var(--health-well)"
        title="Самопочуття"
        meta={<span className="text-[10.5px] text-text-faint">Сьогодні</span>}
      >
        <div className="pointer-events-auto relative z-10">
          <DraggableQualitySlider
            levels={FEELING_OPTIONS}
            value={todayWellbeing?.overallFeeling ?? null}
            onChange={(feeling) => store.setOverallFeeling(feeling)}
            accentColor="var(--health-well)"
            ariaLabel="Загальне відчуття"
            compact
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {activeZoneLabels.map((zone) => (
            <span
              key={zone.id}
              className="rounded-full bg-surface-2 px-2.5 py-1 text-[10.5px] font-semibold"
              style={{ color: "var(--health-well)" }}
            >
              {zone.label}
            </span>
          ))}
          <span className="rounded-full border border-dashed border-border px-2.5 py-1 text-[10.5px] text-text-faint">
            + Де ще
          </span>
        </div>
      </HealthWidgetCard>
    ),

    meds: (
      <HealthWidgetCard
        href="/health/medications"
        icon={<PillIcon />}
        iconAccent="var(--health-meds)"
        title="Ліки та добавки"
        meta={
          store.medications.length > 0 ? (
            <span className="text-[10.5px] text-text-faint">
              {doneMedCount} з {store.medications.length}
            </span>
          ) : undefined
        }
      >
        {store.medications.length === 0 ? (
          <div className="text-[11.5px] text-text-faint">Ще немає доданих ліків</div>
        ) : (
          <>
            <div className="mb-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full" style={{ width: `${medsPct}%`, background: "var(--health-meds)" }} />
            </div>
            <div className="space-y-1.5">
              {store.medications.map((med) => {
                const done = doneMedIds.includes(med.id);
                return (
                  <button
                    key={med.id}
                    onClick={(e) => {
                      e.preventDefault();
                      store.toggleMedDone(today, med.id);
                    }}
                    className="pointer-events-auto relative z-10 flex w-full items-center gap-2 text-left"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border text-[9px]",
                        done ? "border-transparent text-bg" : "border-border bg-surface-2"
                      )}
                      style={done ? { background: "var(--health-meds)" } : undefined}
                    >
                      {done ? "✓" : ""}
                    </span>
                    <span className={cn("flex-1 text-[11.5px]", done ? "text-text-faint line-through" : "text-text")}>
                      {med.name}
                    </span>
                    <span className="font-mono text-[10px] text-text-faint">{med.time}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </HealthWidgetCard>
    ),

    activity: (
      <HealthWidgetCard
        href="/health/activity"
        icon={<DumbbellIcon />}
        iconAccent="var(--health-activity)"
        title="Активність"
        meta={
          todayActivity.length > 0 ? (
            <span className="text-[10.5px] text-text-faint">
              {todayActivity.reduce((s, a) => s + a.minutes, 0)} хв сьогодні
            </span>
          ) : undefined
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {activityTypes.map((type) => (
            <button
              key={type}
              onClick={(e) => {
                e.preventDefault();
                store.addActivity(type, 30);
              }}
              className="pointer-events-auto relative z-10 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[10.5px] text-text-dim"
            >
              {type}
            </button>
          ))}
        </div>
      </HealthWidgetCard>
    ),

    // A mixed compact list: build habits show a checkbox+streak, limit
    // habits show a count/cap fraction, so the two mechanics read
    // differently even at a glance, without opening the detail screen.
    habits: (
      <HealthWidgetCard href="/health/habits" icon={<FireIcon />} iconAccent="var(--health-habits)" title="Звички">
        <div className="space-y-1.5">
          {store.habits.slice(0, 3).map((habit) => {
            if (habit.kind === "build") {
              const isDaily = habit.targetFrequency === "daily";
              const doneToday = (todayHabits[habit.id] ?? 0) >= 1;
              const streak = computeCurrentStreak(habit.id, store.habitLogs);
              const doneThisWeek = computeWeekDone(habit.id, store.habitLogs, firstDayOfWeek).filter(Boolean).length;
              return (
                <button
                  key={habit.id}
                  onClick={(e) => {
                    e.preventDefault();
                    store.toggleHabitDone(today, habit.id);
                  }}
                  className="pointer-events-auto relative z-10 flex w-full items-center gap-2 text-left"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border text-[9px]",
                      doneToday ? "border-transparent text-bg" : "border-border bg-surface-2"
                    )}
                    style={doneToday ? { background: "var(--health-habit-build)" } : undefined}
                  >
                    {doneToday ? "✓" : ""}
                  </span>
                  <span className="flex-1 text-[11.5px] text-text">{habit.name}</span>
                  <span className="text-[10.5px] font-semibold" style={{ color: "var(--health-habit-build)" }}>
                    {isDaily ? `${streak} дн.` : `${doneThisWeek}/${habit.targetFrequency}`}
                  </span>
                </button>
              );
            }

            const todayCount = todayHabits[habit.id] ?? 0;
            const cap = habit.dailyCap ?? habit.weeklyCap ?? 0;
            return (
              <div key={habit.id} className="flex items-center gap-2">
                <span className="flex-1 text-[11.5px] text-text-dim">{habit.name}</span>
                <span className="text-[11.5px] font-bold" style={{ color: "var(--health-habit-limit)" }}>
                  {todayCount}
                </span>
                <span className="text-[10.5px] text-text-faint">/ {cap}</span>
              </div>
            );
          })}
        </div>
      </HealthWidgetCard>
    ),

    cycle: (
      <HealthWidgetCard href="/health/cycle" icon={<RepeatIcon />} iconAccent="var(--health-cycle)" title="Цикл">
        {cycle ? (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
              <span className="text-text-dim">
                День {cycle.day} · {CYCLE_PHASE_LABEL[cycle.phase]}
              </span>
              <span className="text-text-faint">через {cycle.nextPeriodInDays} дн.</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-rose" style={{ width: `${Math.round(cycle.progress * 100)}%` }} />
            </div>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.preventDefault();
              store.markPeriodStart();
            }}
            className="pointer-events-auto relative z-10 w-full rounded-btn border border-border bg-surface-2 py-2 text-[11.5px] font-semibold text-text-dim"
          >
            Позначити початок місячних
          </button>
        )}
      </HealthWidgetCard>
    ),
  };

  return (
    <>
    <div>
      <div className="mb-0.5 flex items-center justify-between pb-3.5 pt-2">
        <div>
          <div className="font-heading text-lg font-semibold text-text">Здоров&apos;я</div>
          <div className="mt-0.5 text-[11.5px] text-text-faint">самостійний трекінг · без сторонніх сервісів</div>
        </div>
        <Link
          href="/health/widgets"
          aria-label="Налаштувати віджети"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-icon border border-border bg-surface text-text-dim"
        >
          <GearIcon className="h-4 w-4" />
        </Link>
      </div>

      <AIInsightCard insights={insights} />

      {isStaleSleep && (
        <div className="mb-3.5 rounded-card-sm border border-border bg-surface-2 p-3.5">
          <div className="mb-2 text-[12.5px] font-semibold text-text">Здається, ти забув відмітити пробудження</div>
          <div className="mb-2.5 flex items-center gap-2">
            <input
              type="time"
              value={recoveryTime}
              onChange={(e) => setRecoveryTime(e.target.value)}
              className="rounded-input border border-border bg-surface px-2.5 py-1.5 text-[12.5px] text-text outline-none"
            />
            <span className="text-[11px] text-text-faint">орієнтовний час пробудження</span>
          </div>
          <button
            onClick={confirmRecovery}
            className="w-full rounded-btn bg-text py-2 text-[12px] font-semibold text-bg"
          >
            Підтвердити
          </button>
        </div>
      )}

      {enabledHealthWidgets.length === 0 ? (
        <div className="rounded-card-sm border border-dashed border-border p-5 text-center">
          <div className="mb-3 text-[12.5px] text-text-faint">Жоден віджет не увімкнено</div>
          <Link
            href="/health/widgets"
            className="inline-block rounded-btn bg-text px-4 py-2 text-[12.5px] font-semibold text-bg"
          >
            Обрати віджети
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {enabledHealthWidgets.map((id) => (
            <div key={id} className={HEALTH_WIDGET_CONFIG[id]?.size === "full" ? "col-span-2" : undefined}>
              {widgetElements[id]}
            </div>
          ))}
        </div>
      )}
    </div>
    {customWaterOpen && (
      <CustomWaterAmountSheet onClose={() => setCustomWaterOpen(false)} onConfirm={(ml) => store.addWater(ml)} />
    )}
    </>
  );
}
