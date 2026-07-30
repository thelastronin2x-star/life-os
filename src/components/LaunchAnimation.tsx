"use client";

import { useEffect, useRef } from "react";
import { useAppStore, useHasHydrated } from "@/lib/store";
import { LAUNCH_MOTIFS } from "@/lib/launch-motifs";
import { STRONG_BUILDERS } from "@/lib/launch-animation-builders";

const SESSION_FLAG_KEY = "life-os-launch-session";
const LAST_INDEX_KEY = "life-os-launch-last-index";
const INACTIVITY_THRESHOLD_MS = 2 * 60 * 1000;
const SIMPLE_VISIBLE_MS = 550;
const STRONG_VISIBLE_MS = 950;
const FADE_MS = 300;

export function LaunchAnimation() {
  const hydrated = useHasHydrated();
  const layerRef = useRef<HTMLDivElement>(null);
  const hiddenAtRef = useRef<number | null>(null);

  function fadeOutAndClear(after: number) {
    window.setTimeout(() => {
      const el = layerRef.current;
      if (!el) return;
      el.style.transition = `opacity ${FADE_MS}ms ease`;
      el.style.opacity = "0";
      window.setTimeout(() => {
        const layer = layerRef.current;
        if (!layer) return;
        layer.style.display = "none";
        layer.innerHTML = "";
        layer.style.opacity = "1";
        layer.style.transition = "";
      }, FADE_MS);
    }, after);
  }

  function playSimple() {
    const el = layerRef.current;
    if (!el) return;
    el.style.display = "flex";
    el.innerHTML =
      '<div style="width:44px;height:44px;border-radius:13px;background:var(--accent);opacity:0;transform:scale(0.85);animation:launchSimpleIn .6s cubic-bezier(.2,.8,.3,1) forwards;"></div>';
    fadeOutAndClear(SIMPLE_VISIBLE_MS);
  }

  function playStrong() {
    const el = layerRef.current;
    if (!el) return;

    const { profile } = useAppStore.getState();
    const motifBuilder = LAUNCH_MOTIFS[profile];
    const motifSvg = motifBuilder("var(--accent)", "var(--gold)");

    const lastIdx = Number(sessionStorage.getItem(LAST_INDEX_KEY) ?? "-1");
    let idx: number;
    do {
      idx = Math.floor(Math.random() * STRONG_BUILDERS.length);
    } while (idx === lastIdx && STRONG_BUILDERS.length > 1);
    sessionStorage.setItem(LAST_INDEX_KEY, String(idx));

    el.style.display = "flex";
    el.innerHTML = STRONG_BUILDERS[idx]("var(--accent)", "var(--gold)", motifSvg);
    fadeOutAndClear(STRONG_VISIBLE_MS);
  }

  function playForCurrentState() {
    const { hasSeenFirstLaunch, markFirstLaunchSeen } = useAppStore.getState();
    if (!hasSeenFirstLaunch) {
      playSimple();
      markFirstLaunchSeen();
    } else {
      playStrong();
    }
    sessionStorage.setItem(SESSION_FLAG_KEY, String(Date.now()));
  }

  useEffect(() => {
    // Wait for persist rehydration to land before touching the store — reading/writing
    // it earlier (via getState()) races the async rehydrate and can clobber real
    // persisted values (e.g. onboarded) with stale in-memory defaults.
    if (!hydrated) return;

    if (!sessionStorage.getItem(SESSION_FLAG_KEY)) {
      playForCurrentState();
    }

    function handleVisibility() {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (hiddenAtRef.current === null) return;
      const elapsed = Date.now() - hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (elapsed > INACTIVITY_THRESHOLD_MS) {
        playStrong();
        sessionStorage.setItem(SESSION_FLAG_KEY, String(Date.now()));
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  return (
    <div
      ref={layerRef}
      style={{ display: "none", opacity: 1 }}
      className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center bg-bg"
    />
  );
}
