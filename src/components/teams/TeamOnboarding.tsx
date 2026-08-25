"use client";

import { useState } from "react";
import type { TeamProfile } from "@/lib/teams/types";
import { cn } from "@/lib/cn";

interface Props {
  profile: TeamProfile;
  createTeam: (name: string, profile: TeamProfile, displayName: string) => Promise<{ ok: boolean; error?: string }>;
  joinTeam: (code: string, displayName: string) => Promise<{ ok: boolean; error?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "Команду з таким кодом не знайдено",
  already_in_team: "Цей пристрій уже в команді",
};

export function TeamOnboarding({ profile, createTeam, joinTeam }: Props) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!displayName.trim()) return;
    setPending(true);
    setError(null);
    const result =
      mode === "create" ? await createTeam(name, profile, displayName) : await joinTeam(code, displayName);
    setPending(false);
    if (!result.ok) setError(ERROR_MESSAGES[result.error ?? ""] ?? "Щось пішло не так");
  }

  const canSubmit = mode === "create" ? name.trim().length > 0 && displayName.trim().length > 0 : code.trim().length > 0 && displayName.trim().length > 0;

  return (
    <div>
      <div className="mb-4 flex gap-2 rounded-btn bg-surface-2 p-1">
        <button
          onClick={() => setMode("create")}
          className={cn("flex-1 rounded-btn py-2.5 text-[12px] font-extrabold", mode === "create" ? "bg-text text-bg" : "text-text-dim")}
        >
          Створити
        </button>
        <button
          onClick={() => setMode("join")}
          className={cn("flex-1 rounded-btn py-2.5 text-[12px] font-extrabold", mode === "join" ? "bg-text text-bg" : "text-text-dim")}
        >
          Приєднатися
        </button>
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        {mode === "create" ? (
          <>
            <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-faint">Назва команди</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="напр. Економ-24"
              className="mb-3.5 w-full rounded-input border border-border bg-bg px-3 py-2.5 text-[13px] text-text outline-none"
            />
          </>
        ) : (
          <>
            <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-faint">Код запрошення</div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="напр. K7QX9M"
              className="mb-3.5 w-full rounded-input border border-border bg-bg px-3 py-2.5 text-[13px] uppercase tracking-widest text-text outline-none"
            />
          </>
        )}

        <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-faint">Твоє ім&apos;я</div>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Як тебе бачитимуть інші"
          className="mb-4 w-full rounded-input border border-border bg-bg px-3 py-2.5 text-[13px] text-text outline-none"
        />

        {error && <div className="mb-3 text-[11.5px] font-semibold text-clay">{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || pending}
          className="w-full rounded-btn bg-text py-3 text-[12.5px] font-extrabold text-bg disabled:opacity-50"
        >
          {pending ? "Зачекай…" : mode === "create" ? "Створити команду" : "Приєднатися"}
        </button>
      </div>

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-text-faint">
        Немає акаунтів — команда це просто код. Будь-хто, хто його знає, може приєднатися під своїм ім&apos;ям.
      </p>
    </div>
  );
}
