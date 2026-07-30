"use client";

import Link from "next/link";
import { THEMES, useAppStore } from "@/lib/store";

export default function ThemePage() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  const darkThemes = THEMES.filter((t) => t.mode === "dark");
  const lightThemes = THEMES.filter((t) => t.mode === "light");

  return (
    <div>
      <Link href="/profile" className="mb-2 flex items-center gap-2 pt-2 text-[12.5px] text-text-dim">
        <span className="flex h-7 w-7 items-center justify-center rounded-[9px] border border-border bg-surface">
          ‹
        </span>
        Профіль
      </Link>
      <div className="mb-4 pt-2 font-heading text-lg font-semibold text-text">Тема оформлення</div>

      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-faint">
        Темні
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2.5">
        {darkThemes.map((t) => {
          const active = t.id === theme;
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`relative rounded-[13px] border-[1.5px] p-2.5 text-left ${
                active ? "border-sage" : "border-border"
              }`}
            >
              {active && (
                <span className="absolute right-1.5 top-1.5 flex h-[13px] w-[13px] items-center justify-center rounded-full bg-sage text-[8px] font-bold text-bg">
                  ✓
                </span>
              )}
              <div className="mb-1.5 flex gap-1">
                {t.swatches.map((c, i) => (
                  <span key={i} className="h-[13px] w-[13px] rounded" style={{ background: c }} />
                ))}
              </div>
              <div className="text-[10px] font-semibold text-text-dim">{t.name}</div>
            </button>
          );
        })}
      </div>

      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-faint">
        Світлі
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {lightThemes.map((t) => {
          const active = t.id === theme;
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`relative rounded-[13px] border-[1.5px] p-2.5 text-left ${
                active ? "border-sage" : "border-border"
              }`}
            >
              {active && (
                <span className="absolute right-1.5 top-1.5 flex h-[13px] w-[13px] items-center justify-center rounded-full bg-sage text-[8px] font-bold text-bg">
                  ✓
                </span>
              )}
              <div className="mb-1.5 flex gap-1">
                {t.swatches.map((c, i) => (
                  <span key={i} className="h-[13px] w-[13px] rounded border border-border" style={{ background: c }} />
                ))}
              </div>
              <div className="text-[10px] font-semibold text-text-dim">{t.name}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
