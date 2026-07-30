"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PROFILES, THEMES, type Profile, useAppStore } from "@/lib/store";
import { getAvatarIcon } from "@/components/icons/avatars";
import { ThemeIcon, AvatarFrameIcon, BriefcaseIcon, GearIcon, HelpIcon } from "@/components/icons";
import { PickerSheet } from "@/components/ui/PickerSheet";

export default function ProfilePage() {
  const profile = useAppStore((s) => s.profile);
  const theme = useAppStore((s) => s.theme);
  const nickname = useAppStore((s) => s.nickname);
  const avatarId = useAppStore((s) => s.avatarId);
  const setProfile = useAppStore((s) => s.setProfile);
  const profileMeta = PROFILES.find((p) => p.id === profile)!;
  const themeName = THEMES.find((t) => t.id === theme)?.name ?? theme;
  const avatarIcon = useMemo(
    () => getAvatarIcon(avatarId)({ className: "h-10 w-10" }),
    [avatarId]
  );

  const [profilePickerOpen, setProfilePickerOpen] = useState(false);

  return (
    <div>
      <Link href="/" className="mb-1 flex items-center gap-2 pt-2 text-[12.5px] text-text-dim">
        <span className="flex h-7 w-7 items-center justify-center rounded-[9px] border border-border bg-surface">
          ‹
        </span>
        Назад на Головну
      </Link>

      <div className="flex flex-col items-center py-6">
        <Link href="/profile/avatar" className="relative mb-3.5">
          <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-gradient-to-br from-sage to-sky text-bg">
            {avatarIcon}
          </div>
          <span className="absolute bottom-0 right-0 flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-bg bg-surface">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-[11px] w-[11px] text-text-dim">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </span>
        </Link>
        <div className="font-heading text-lg font-semibold text-text">
          {nickname || profileMeta.name}
        </div>
        <div className="mt-0.5 text-[12px] text-text-faint">{profileMeta.name}</div>
      </div>

      <div className="flex flex-col gap-0.5">
        <Link
          href="/profile/theme"
          className="flex items-center gap-3.5 border-b border-border py-3.5"
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-dim">
            <ThemeIcon className="h-4 w-4" />
          </span>
          <span className="flex-1">
            <span className="block text-[13.5px] font-medium text-text">Тема оформлення</span>
          </span>
          <span className="text-[11px] text-text-faint">{themeName} ›</span>
        </Link>

        <Link
          href="/profile/avatar"
          className="flex items-center gap-3.5 border-b border-border py-3.5"
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-dim">
            <AvatarFrameIcon className="h-4 w-4" />
          </span>
          <span className="flex-1">
            <span className="block text-[13.5px] font-medium text-text">Аватар та нік</span>
          </span>
          <span className="text-[11px] text-text-faint">{nickname || "Змінити"} ›</span>
        </Link>

        <button
          onClick={() => setProfilePickerOpen(true)}
          className="flex items-center gap-3.5 border-b border-border py-3.5 text-left"
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-dim">
            <BriefcaseIcon className="h-4 w-4" />
          </span>
          <span className="flex-1">
            <span className="block text-[13.5px] font-medium text-text">Професія</span>
          </span>
          <span className="text-[11px] text-text-faint">{profileMeta.name} ›</span>
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-0.5">
        <Link href="/profile/settings" className="flex items-center gap-3.5 border-b border-border py-3.5">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-dim">
            <GearIcon className="h-4 w-4" />
          </span>
          <span className="flex-1">
            <span className="block text-[13.5px] font-medium text-text">Налаштування</span>
            <span className="mt-0.5 block text-[10.5px] text-text-faint">
              Мова, інтеграції, сповіщення
            </span>
          </span>
          <span className="text-[11px] text-text-faint">›</span>
        </Link>

        <Link href="/profile/help" className="flex items-center gap-3.5 py-3.5">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-dim">
            <HelpIcon className="h-4 w-4" />
          </span>
          <span className="flex-1">
            <span className="block text-[13.5px] font-medium text-text">Допомога</span>
          </span>
          <span className="text-[11px] text-text-faint">›</span>
        </Link>
      </div>

      {profilePickerOpen && (
        <PickerSheet<Profile>
          title="Професія"
          options={PROFILES.map((p) => ({ id: p.id, name: p.name }))}
          value={profile}
          onSelect={(id) => setProfile(id)}
          onClose={() => setProfilePickerOpen(false)}
        />
      )}
    </div>
  );
}
