"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TeamProfile, TeamStateView } from "@/lib/teams/types";
import type { ReviewQuality } from "@/lib/sm2";

export interface TeamHookState {
  state: TeamStateView | null;
  loading: boolean;
  error: boolean;
}

async function postJson(url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.ok) return { ok: true };
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: false, error: data.error };
}

/** No real-time infrastructure exists in this app (no websockets/pusher —
 *  see model-router.ts's own note on scope), so "Час команди" and the
 *  activity feed feel live via plain polling instead: refetch every 8s
 *  while a team exists and this hook is mounted, and pause entirely once
 *  there's no team to poll for (the create/join screen has nothing to
 *  refresh). */
const POLL_MS = 8000;

export function useTeamState() {
  const [hook, setHook] = useState<TeamHookState>({ state: null, loading: true, error: false });
  const hasTeamRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/teams/state");
      if (!res.ok) throw new Error("fetch_failed");
      const data = (await res.json()) as { state: TeamStateView | null };
      hasTeamRef.current = data.state !== null;
      setHook({ state: data.state, loading: false, error: false });
    } catch {
      setHook((s) => ({ ...s, loading: false, error: true }));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- genuine initial fetch on mount, not a derivable render value
    refresh();
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => {
      if (hasTeamRef.current) refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const createTeam = useCallback(
    async (name: string, profile: TeamProfile, displayName: string) => {
      const result = await postJson("/api/teams/create", { name, profile, displayName });
      if (result.ok) await refresh();
      return result;
    },
    [refresh]
  );

  const joinTeam = useCallback(
    async (code: string, displayName: string) => {
      const result = await postJson("/api/teams/join", { code, displayName });
      if (result.ok) await refresh();
      return result;
    },
    [refresh]
  );

  const leaveTeam = useCallback(async () => {
    const result = await postJson("/api/teams/leave");
    if (result.ok) await refresh();
    return result;
  }, [refresh]);

  const sendMessage = useCallback(
    async (text: string) => {
      const result = await postJson("/api/teams/messages", { text });
      if (result.ok) await refresh();
      return result;
    },
    [refresh]
  );

  const createProject = useCallback(
    async (kind: "note" | "session" | "parts_project" | "shared_deck", name: string, status?: string) => {
      const result = await postJson("/api/teams/projects", { kind, name, status });
      if (result.ok) await refresh();
      return result;
    },
    [refresh]
  );

  const updateProject = useCallback(
    async (projectId: string, patch: { status?: string | null; data?: Record<string, unknown> }) => {
      const res = await fetch(`/api/teams/projects/${projectId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const ok = res.ok;
      if (ok) await refresh();
      return { ok };
    },
    [refresh]
  );

  const addProjectEntry = useCallback(
    async (projectId: string, text: string) => {
      const result = await postJson(`/api/teams/projects/${projectId}/entries`, { text });
      if (result.ok) await refresh();
      return result;
    },
    [refresh]
  );

  const addDeckCard = useCallback(
    async (projectId: string, front: string, back: string) => {
      const result = await postJson(`/api/teams/projects/${projectId}/cards`, { front, back });
      if (result.ok) await refresh();
      return result;
    },
    [refresh]
  );

  const reviewDeckCard = useCallback(
    async (projectId: string, cardId: string, quality: ReviewQuality) => {
      const result = await postJson(`/api/teams/projects/${projectId}/review`, { cardId, quality });
      if (result.ok) await refresh();
      return result;
    },
    [refresh]
  );

  const setRival = useCallback(
    async (code: string) => {
      const result = await postJson("/api/teams/rival", { code });
      if (result.ok) await refresh();
      return result;
    },
    [refresh]
  );

  return {
    ...hook,
    refresh,
    createTeam,
    joinTeam,
    leaveTeam,
    sendMessage,
    createProject,
    updateProject,
    addProjectEntry,
    addDeckCard,
    reviewDeckCard,
    setRival,
  };
}
