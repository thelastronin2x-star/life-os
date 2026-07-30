"use client";

interface HasPersist {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
  };
}

/** Resolves once every given persisted store has finished reading its state
 *  back from localStorage. zustand's persist rehydration is asynchronous —
 *  it unconditionally overwrites the in-memory store with whatever was on
 *  disk the moment it resolves. Any background effect that reads/writes a
 *  persisted store immediately on mount (before hydration finishes) risks
 *  having its own writes silently clobbered the instant hydration completes
 *  afterward — see use-monobank-webhook-sync.ts for where this was first
 *  found to actually happen, not just a theoretical race. */
export function waitForHydration(stores: HasPersist[]): Promise<void> {
  return Promise.all(
    stores.map(
      (store) =>
        new Promise<void>((resolve) => {
          if (store.persist.hasHydrated()) {
            resolve();
            return;
          }
          const unsub = store.persist.onFinishHydration(() => {
            unsub();
            resolve();
          });
        })
    )
  ).then(() => undefined);
}
