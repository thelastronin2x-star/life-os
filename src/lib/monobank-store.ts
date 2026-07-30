"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface MonobankLink {
  monobankAccountId: string;
  label: string; // masked pan / iban, for display only
  localAccountId: string;
  lastSyncedAt: string | null; // ISO timestamp — newest transaction time synced so far
  earliestSyncedAt: string | null; // ISO timestamp — oldest transaction time synced so far
  historyExhausted: boolean; // true once "load older history" hit the start of the account
  /** True once the full extend-back-to-start + refresh-forward repair has
   *  completed successfully — lets it run automatically exactly once per
   *  link instead of needing a manual button press every time. */
  metadataBackfilled: boolean;
  /** ISO timestamp of the last successful balance reconciliation against
   *  Monobank's live client-info balance — null means never. A link in that
   *  state must keep retrying reconciliation on every subsequent sync
   *  attempt (see reconcileMonobankLink/syncMonobankAccount in
   *  monobank-sync.ts) instead of settling for a starting balance computed
   *  from a partial transaction import with no live anchor at all, which is
   *  what silently left new accounts stuck at a negative balance forever. */
  reconciledAt: string | null;
}

interface MonobankLinkState {
  links: MonobankLink[];
  setLink: (link: MonobankLink) => void;
  removeLink: (monobankAccountId: string) => void;
  setLastSynced: (monobankAccountId: string, iso: string) => void;
  setEarliestSynced: (monobankAccountId: string, iso: string, exhausted?: boolean) => void;
  setMetadataBackfilled: (monobankAccountId: string, value: boolean) => void;
  setReconciled: (monobankAccountId: string, iso: string) => void;
  clearAll: () => void;
}

export const useMonobankLinkStore = create<MonobankLinkState>()(
  persist(
    (set) => ({
      links: [],
      setLink: (link) =>
        set((s) => ({
          links: [...s.links.filter((l) => l.monobankAccountId !== link.monobankAccountId), link],
        })),
      removeLink: (monobankAccountId) =>
        set((s) => ({ links: s.links.filter((l) => l.monobankAccountId !== monobankAccountId) })),
      setLastSynced: (monobankAccountId, iso) =>
        set((s) => ({
          links: s.links.map((l) => (l.monobankAccountId === monobankAccountId ? { ...l, lastSyncedAt: iso } : l)),
        })),
      setEarliestSynced: (monobankAccountId, iso, exhausted) =>
        set((s) => ({
          links: s.links.map((l) =>
            l.monobankAccountId === monobankAccountId
              ? { ...l, earliestSyncedAt: iso, historyExhausted: exhausted ?? l.historyExhausted }
              : l
          ),
        })),
      setMetadataBackfilled: (monobankAccountId, value) =>
        set((s) => ({
          links: s.links.map((l) => (l.monobankAccountId === monobankAccountId ? { ...l, metadataBackfilled: value } : l)),
        })),
      setReconciled: (monobankAccountId, iso) =>
        set((s) => ({
          links: s.links.map((l) => (l.monobankAccountId === monobankAccountId ? { ...l, reconciledAt: iso } : l)),
        })),
      clearAll: () => set({ links: [] }),
    }),
    {
      name: "life-os-monobank-links",
      version: 1,
      // v0 -> v1: added `reconciledAt`. Existing links predate balance
      // reconciliation tracking entirely, so they must be treated as
      // "never reconciled" — not "already fine" — so the retry-until-
      // reconciled logic actually gets a chance to run and fix any of them
      // that are already sitting on a wrong starting balance.
      migrate: (persisted) => {
        const state = persisted as MonobankLinkState;
        return { ...state, links: state.links.map((l) => ({ ...l, reconciledAt: l.reconciledAt ?? null })) };
      },
    }
  )
);
