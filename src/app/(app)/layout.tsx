"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useHasHydrated } from "@/lib/store";
import { NavShell } from "@/components/nav/NavShell";
import { useNewsReminders } from "@/lib/use-news-reminders";
import { useWorkoutActivitySync } from "@/lib/use-workout-activity-sync";
import { checkAndGenerateAutoReports } from "@/lib/reports";

export default function AppLayout({ children }: { children: ReactNode }) {
  const hydrated = useHasHydrated();
  const onboarded = useAppStore((s) => s.onboarded);
  const profile = useAppStore((s) => s.profile);
  const router = useRouter();

  useNewsReminders(hydrated && onboarded && profile === "trader");
  useWorkoutActivitySync();

  useEffect(() => {
    if (!hydrated) return;
    // Read live state instead of the closed-over `onboarded` value: right
    // after hydration finishes, this effect can otherwise fire once with a
    // stale pre-hydration snapshot and redirect before the real value lands.
    if (!useAppStore.getState().onboarded) {
      router.replace("/onboarding");
    }
  }, [hydrated, router]);

  useEffect(() => {
    if (!hydrated || !onboarded) return;
    // Best-effort client-side substitute for a real cron job: there is no
    // server-side database this app can wake up against (data lives in the
    // browser's localStorage), so instead we check on every app open whether
    // a week/month has passed since the last report and generate it then.
    checkAndGenerateAutoReports(profile).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, onboarded]);

  if (!hydrated || !onboarded) {
    return null;
  }

  return <NavShell>{children}</NavShell>;
}
