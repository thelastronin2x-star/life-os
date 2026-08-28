"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HealthSubpageHeader } from "@/components/health/HealthSubpageHeader";
import { CustomWaterAmountSheet } from "@/components/health/CustomWaterAmountSheet";
import { useHealthStore } from "@/lib/health-store";
import { formatDateKey } from "@/lib/calendar-utils";
import { formatLiters } from "@/lib/health-utils";

const QUICK_VOLUMES = [
  { ml: 100, label: "мл" },
  { ml: 150, label: "мл" },
  { ml: 250, label: "склянка" },
  { ml: 300, label: "мл" },
  { ml: 500, label: "пляшка" },
  { ml: 750, label: "мл" },
  { ml: 1000, label: "мл" },
];

function WaterDetailInner() {
  const searchParams = useSearchParams();
  const store = useHealthStore();
  const today = formatDateKey(new Date());
  const [customSheetOpen, setCustomSheetOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(store.waterGoalMl));
  const [remindersInput, setRemindersInput] = useState(String(store.waterRemindersPerDay));
  const [toast, setToast] = useState<string | null>(null);
  const handledDeepLinkRef = useRef(false);

  const todayMl = store.waterEntries.filter((e) => e.date === today).reduce((s, e) => s + e.ml, 0);
  const pct = Math.min(100, Math.round((todayMl / store.waterGoalMl) * 100));
  const remaining = Math.max(0, store.waterGoalMl - todayMl);

  // Deep link from the water-reminder push (see /api/push/send-reminders'
  // sendWaterReminders) — no custom notification action button (iOS Safari
  // ignores those entirely), so the tap opens the app at this URL and the
  // effect below performs the add automatically, same pattern already
  // established for Sleep's start/stop deep links. Stays on /health/water
  // rather than bouncing to /health — the person tapped a water reminder,
  // seeing the updated water total right there is more useful than landing
  // back on the dashboard.
  //
  // Unlike Sleep's start/stop (naturally idempotent — re-running is a no-op
  // once `active` flips), addWater has no such guard: every call is a
  // genuinely new entry. useSearchParams()'s identity churns across
  // re-renders faster than a router.replace() navigation actually lands,
  // which was re-firing this effect (and re-adding 250ml) 3-4x before this
  // ref existed — caught live via Playwright, not just a hunch. The ref
  // makes the action run at most once per mount regardless of how many
  // times the effect re-fires; window.history.replaceState (not
  // router.replace, matching the Sleep page's own choice here) also avoids
  // triggering the Next.js navigation cycle that churns searchParams in the
  // first place.
  useEffect(() => {
    if (handledDeepLinkRef.current) return;
    if (searchParams.get("action") !== "add250") return;
    handledDeepLinkRef.current = true;
    store.addWater(250);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time deep-link action on mount, not a render-cascading loop
    setToast("+250 мл додано");
    window.history.replaceState(null, "", "/health/water");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time deep-link check on mount only
  }, [searchParams]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  function commitGoal() {
    const ml = Number(goalInput);
    if (ml > 0) store.setWaterGoal(ml);
    else setGoalInput(String(store.waterGoalMl));
    setEditingGoal(false);
  }

  function commitReminders() {
    const n = Math.max(0, Math.min(12, Math.trunc(Number(remindersInput)) || 0));
    setRemindersInput(String(n));
    store.setWaterRemindersPerDay(n);
  }

  return (
    <div>
      <HealthSubpageHeader title="Вода" subtitle="Обʼєм за день" />

      <div className="card-raised rounded-card bg-surface p-5">
        <div className="mb-4.5 text-center">
          <div className="font-display text-[32px] font-extrabold text-text">
            {formatLiters(todayMl)} з {formatLiters(store.waterGoalMl)} л
          </div>
          <div className="mt-1 text-[12.5px] text-text-faint">
            {pct}% денної цілі · лишилось {remaining} мл
          </div>
          <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="my-4.5 h-px bg-border" />

        <div className="mb-2.5 text-[11.5px] font-bold text-text-faint">Додати</div>
        <div className="grid grid-cols-4 gap-2">
          {QUICK_VOLUMES.map((v) => (
            <button
              key={v.ml}
              onClick={() => store.addWater(v.ml)}
              className="rounded-card-sm bg-surface-2 py-3 text-center"
            >
              <div className="text-[14px] font-extrabold" style={{ color: "var(--health-water)" }}>
                {v.ml}
              </div>
              <div className="mt-0.5 text-[9px] font-semibold text-text-faint">{v.label}</div>
            </button>
          ))}
          <button
            onClick={() => setCustomSheetOpen(true)}
            className="rounded-card-sm border border-dashed border-border py-3 text-center"
          >
            <div className="text-[16px] font-extrabold text-text-faint">✎</div>
            <div className="mt-0.5 text-[9px] font-semibold text-text-faint">своє</div>
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[12.5px] text-text-faint">Денна ціль</span>
          {editingGoal ? (
            <input
              type="number"
              autoFocus
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onBlur={commitGoal}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-20 rounded-input border border-border bg-surface px-2 py-1.5 text-[12px] text-text outline-none"
            />
          ) : (
            <button
              onClick={() => {
                setGoalInput(String(store.waterGoalMl));
                setEditingGoal(true);
              }}
              className="rounded-input bg-surface-2 px-3 py-1.5 text-[13px] font-extrabold"
              style={{ color: "var(--health-water)" }}
            >
              {formatLiters(store.waterGoalMl)} л ›
            </button>
          )}
        </div>
      </div>

      <div className="card-raised mt-3.5 rounded-card bg-surface p-4">
        <div className="mb-3 text-[11.5px] font-bold text-text-faint">Нагадування</div>
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-text">Нагадувань на день</span>
          <input
            type="number"
            min={0}
            max={12}
            value={remindersInput}
            onChange={(e) => setRemindersInput(e.target.value)}
            onBlur={commitReminders}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="w-16 rounded-input border border-border bg-surface-2 px-2 py-1.5 text-center text-[12px] text-text outline-none"
          />
        </div>
        <div className="mt-0.5 text-[10.5px] leading-relaxed text-text-faint">
          0 вимикає нагадування. Ті, що припадають на час, коли ти й так випереджаєш темп, пропускаються самі.
        </div>

        {store.waterRemindersPerDay > 0 && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="flex-shrink-0 text-[12.5px] text-text">Активні години</span>
            <div className="flex items-center gap-1.5">
              <input
                type="time"
                value={store.waterActiveStart}
                onChange={(e) => store.setWaterActiveHours(e.target.value, store.waterActiveEnd)}
                className="rounded-input border border-border bg-surface-2 px-2 py-1.5 text-[12px] text-text outline-none"
              />
              <span className="text-text-faint">—</span>
              <input
                type="time"
                value={store.waterActiveEnd}
                onChange={(e) => store.setWaterActiveHours(store.waterActiveStart, e.target.value)}
                className="rounded-input border border-border bg-surface-2 px-2 py-1.5 text-[12px] text-text outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {customSheetOpen && (
        <CustomWaterAmountSheet onClose={() => setCustomSheetOpen(false)} onConfirm={(ml) => store.addWater(ml)} />
      )}

      {toast && (
        <div className="fixed bottom-[84px] left-1/2 z-[60] -translate-x-1/2 rounded-btn bg-text px-4 py-2.5 text-[12.5px] font-semibold text-bg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function WaterDetailPage() {
  return (
    <Suspense fallback={null}>
      <WaterDetailInner />
    </Suspense>
  );
}
