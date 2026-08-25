"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HealthSubpageHeader } from "@/components/health/HealthSubpageHeader";
import { WeeklyBars } from "@/components/health/WeeklyBars";
import { DraggableQualitySlider } from "@/components/health/DraggableQualitySlider";
import { useHealthStore, DEFAULT_SLEEP_FACTORS, type QualityLevel } from "@/lib/health-store";
import { formatClock, formatDuration, lastDays, minutesBetween, WEEKDAY_SHORT } from "@/lib/health-utils";
import { sendSelfPush } from "@/lib/push-confirm";
import { cn } from "@/lib/cn";

const QUALITY_LEVELS: { value: QualityLevel; label: string }[] = [
  { value: "very_bad", label: "Дуже погана" },
  { value: "bad", label: "Погана" },
  { value: "ok", label: "Нормальна" },
  { value: "good", label: "Добра" },
  { value: "great", label: "Чудова" },
];

export default function SleepDetailPage() {
  const store = useHealthStore();
  const searchParams = useSearchParams();
  const activeSleep = store.sleepSessions.find((s) => s.wakeAt === null);
  const lastSleep = [...store.sleepSessions]
    .filter((s) => s.wakeAt)
    .sort((a, b) => new Date(b.wakeAt!).getTime() - new Date(a.wakeAt!).getTime())[0];

  // Gates the deep-link effect below on this store actually having loaded
  // its persisted data — without it, the effect can run against the
  // pre-hydration default (sleepSessions: []) and call startSleep() based
  // on stale state, which zustand-persist's real hydration then either
  // clobbers or duplicates moments later. AppLayout only waits for the
  // *app* store to hydrate before rendering children at all; this store
  // hydrates independently and isn't covered by that gate.
  const [healthHydrated, setHealthHydrated] = useState(() => useHealthStore.persist?.hasHydrated() ?? true);
  useEffect(() => {
    if (healthHydrated) return;
    return useHealthStore.persist?.onFinishHydration(() => setHealthHydrated(true));
  }, [healthHydrated]);

  // Deep-link from the bedtime/wake pushes (see /api/push/send-reminders) —
  // tapping either notification lands here with ?action=start or
  // ?action=stop. iOS Safari ignores custom notification action buttons
  // entirely, so "open the app and just do the thing" via this query param
  // is the only reliable way a tap can trigger anything more specific than
  // "open the app" — no confirmation push on either branch, unlike the
  // manual buttons below: the user already just tapped a notification about
  // this, a second one would be redundant. Both branches re-check the
  // guard condition themselves (idle/sleeping) rather than trusting the
  // server's own gate blindly — cheap, local, and correct even if the
  // server-side state the cron read was a few minutes stale.
  useEffect(() => {
    if (!healthHydrated) return;
    const action = searchParams.get("action");
    const active = store.sleepSessions.some((s) => s.wakeAt === null);

    if (action === "start" && !active) {
      store.startSleep();
      window.history.replaceState(null, "", "/health/sleep");
    } else if (action === "stop" && active) {
      store.endSleep();
      window.history.replaceState(null, "", "/health/sleep");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, healthHydrated]);

  const chartData = useMemo(() => {
    const days = lastDays(7);
    const byDay = new Map<string, number>();
    for (const s of store.sleepSessions) {
      if (!s.wakeAt) continue;
      const day = s.wakeAt.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + minutesBetween(s.sleepAt, s.wakeAt));
    }
    return days.map((d, i) => ({ label: WEEKDAY_SHORT[new Date(d).getDay() === 0 ? 6 : new Date(d).getDay() - 1], value: byDay.get(d) ?? 0, key: d, idx: i }));
  }, [store.sleepSessions]);

  function handleStartSleep() {
    const now = new Date();
    store.startSleep();
    sendSelfPush("Сон розпочато", `Заснув(ла) о ${formatClock(now.toISOString())}`);
  }

  function handleEndSleep() {
    if (!activeSleep) return;
    const wakeAt = new Date();
    store.endSleep(wakeAt.toISOString());
    sendSelfPush("Сон завершено", `Тривалість: ${formatDuration(minutesBetween(activeSleep.sleepAt, wakeAt.toISOString()))}`);
  }

  return (
    <div>
      <HealthSubpageHeader title="Сон" subtitle="Старт/стоп, а не форма" />

      {activeSleep ? (
        <div className="mb-3.5 rounded-card border border-border bg-surface p-4 text-center shadow-card">
          <div className="mb-1 text-[11.5px] text-text-faint">Заснув(ла) о {formatClock(activeSleep.sleepAt)}</div>
          <div className="mb-3 font-display text-[28px] text-text">Триває</div>
          <button onClick={handleEndSleep} className="w-full rounded-btn bg-sky py-2.5 text-[13px] font-semibold text-bg">
            Прокинувся(лась)
          </button>
        </div>
      ) : (
        <div className="mb-3.5 rounded-card border border-border bg-surface p-4 shadow-card">
          {lastSleep && lastSleep.wakeAt ? (
            <>
              <div className="text-center">
                <div className="font-display text-[30px] text-text">
                  {formatDuration(minutesBetween(lastSleep.sleepAt, lastSleep.wakeAt))}
                </div>
                <div className="mt-0.5 text-[11.5px] text-text-faint">
                  {formatClock(lastSleep.sleepAt)} – {formatClock(lastSleep.wakeAt)}
                </div>
              </div>

              <div className="mt-3.5">
                <div className="mb-1 text-[11.5px] font-semibold text-text">Якість сну</div>
                <DraggableQualitySlider
                  levels={QUALITY_LEVELS}
                  value={lastSleep.quality}
                  onChange={(q) => store.setSleepQuality(lastSleep.id, q)}
                  accentColor="var(--health-sleep)"
                  ariaLabel="Якість сну"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {DEFAULT_SLEEP_FACTORS.map((f) => (
                  <button
                    key={f}
                    onClick={() => store.toggleSleepFactor(lastSleep.id, f)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[10.5px]",
                      lastSleep.factors.includes(f)
                        ? "border-sky bg-sky-soft text-sky"
                        : "border-border bg-surface-2 text-text-dim"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center text-[12px] text-text-faint">Ще немає завершених сесій сну</div>
          )}

          <div className="mt-3.5 flex items-center justify-between rounded-icon bg-surface-2 px-3 py-2.5">
            <span className="text-[11.5px] text-text-dim">Нагадати лягти о</span>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={store.targetBedtime ?? ""}
                onChange={(e) => store.setTargetBedtime(e.target.value || null)}
                className="rounded-input border border-border bg-surface px-2 py-1 text-[12px] text-text outline-none"
              />
              {store.targetBedtime && (
                <button onClick={() => store.setTargetBedtime(null)} className="text-[10.5px] text-text-faint">
                  Вимкнути
                </button>
              )}
            </div>
          </div>

          <div className="mt-1.5 flex items-center justify-between rounded-icon bg-surface-2 px-3 py-2.5">
            <span className="text-[11.5px] text-text-dim">Розбудити о</span>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={store.targetWakeTime ?? ""}
                onChange={(e) => store.setTargetWakeTime(e.target.value || null)}
                className="rounded-input border border-border bg-surface px-2 py-1 text-[12px] text-text outline-none"
              />
              {store.targetWakeTime && (
                <button onClick={() => store.setTargetWakeTime(null)} className="text-[10.5px] text-text-faint">
                  Вимкнути
                </button>
              )}
            </div>
          </div>

          <button onClick={handleStartSleep} className="mt-3.5 w-full rounded-btn bg-text py-2.5 text-[13px] font-semibold text-bg">
            Лягти спати
          </button>
        </div>
      )}

      <div className="rounded-card-sm border border-border bg-surface p-3.5">
        <div className="mb-1 text-[11.5px] font-semibold text-text">Тривалість за тиждень</div>
        <WeeklyBars data={chartData} color="var(--sky)" formatValue={formatDuration} />
      </div>
    </div>
  );
}
