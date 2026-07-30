"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { AVATAR_OPTIONS } from "@/components/icons/avatars";
import { cn } from "@/lib/cn";

export default function AvatarEditPage() {
  const router = useRouter();
  const nickname = useAppStore((s) => s.nickname);
  const avatarId = useAppStore((s) => s.avatarId);
  const setNickname = useAppStore((s) => s.setNickname);
  const setAvatarId = useAppStore((s) => s.setAvatarId);

  const [nameDraft, setNameDraft] = useState(nickname);
  const [avatarDraft, setAvatarDraft] = useState(avatarId);

  function handleSave() {
    setNickname(nameDraft.trim());
    setAvatarId(avatarDraft);
    router.push("/profile");
  }

  return (
    <div>
      <Link href="/profile" className="mb-2 flex items-center gap-2 pt-2 text-[12.5px] text-text-dim">
        <span className="flex h-7 w-7 items-center justify-center rounded-[9px] border border-border bg-surface">
          ‹
        </span>
        Профіль
      </Link>
      <div className="mb-5 pt-2 font-heading text-lg font-semibold text-text">Аватар та нік</div>

      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-dim">
        Твоє ім&apos;я / нік
      </div>
      <input
        value={nameDraft}
        onChange={(e) => setNameDraft(e.target.value)}
        placeholder="Наприклад, Богдан"
        className="mb-5 w-full rounded-card-sm bg-surface shadow-card px-3.5 py-3 font-heading text-[14px] text-text outline-none"
      />

      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-dim">
        Обери аватар
      </div>
      <div className="mb-5 grid grid-cols-3 gap-2.5">
        {AVATAR_OPTIONS.map((opt) => {
          const active = opt.id === avatarDraft;
          return (
            <button
              key={opt.id}
              onClick={() => setAvatarDraft(opt.id)}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-[18px] border-2 bg-gradient-to-br from-sage to-sky text-bg",
                active ? "border-text" : "border-transparent"
              )}
            >
              <opt.Icon className="h-7 w-7" />
              {active && (
                <span className="absolute bottom-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-bg text-text">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-2 w-2">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        className="w-full rounded-btn bg-accent py-3.5 text-center font-heading text-[13.5px] font-semibold text-bg"
      >
        Зберегти
      </button>
    </div>
  );
}
