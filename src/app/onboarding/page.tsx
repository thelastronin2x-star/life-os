"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROFILES, Profile, useAppStore } from "@/lib/store";

export default function OnboardingPage() {
  const [selected, setSelected] = useState<Profile>("trader");
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const router = useRouter();

  function handleContinue() {
    completeOnboarding(selected);
    router.replace("/");
  }

  const selectedProfile = PROFILES.find((p) => p.id === selected)!;

  return (
    <div
      data-profile={selected}
      className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-16 md:pt-24"
    >
      <h1 className="font-heading text-2xl font-semibold text-text">
        Обери свій профіль
      </h1>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-dim">
        Застосунок підлаштує вкладку «Робота» та інсайти асистента під твою
        професію.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {PROFILES.map((p) => {
          const isSelected = p.id === selected;
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`relative flex flex-col items-start gap-2 rounded-card border p-4 text-left transition-colors ${
                isSelected
                  ? "border-[1.5px] border-accent bg-surface-2"
                  : "border-border bg-surface"
              }`}
            >
              {isSelected && (
                <span className="absolute right-3 top-3 flex h-[17px] w-[17px] items-center justify-center rounded-full bg-accent text-[10px] font-bold text-bg">
                  ✓
                </span>
              )}
              <span
                className="flex h-9 w-9 items-center justify-center rounded-[10px] text-accent"
                style={{
                  background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                }}
              >
                <p.Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="text-[13.5px] font-semibold text-text">{p.name}</span>
              <span className="text-[10.5px] leading-relaxed text-text-faint">
                {p.desc}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={handleContinue}
        className="mt-6 rounded-btn bg-accent py-3.5 text-center font-heading text-[13.5px] font-semibold text-bg"
      >
        Продовжити з профілем «{selectedProfile.name}»
      </button>
    </div>
  );
}
