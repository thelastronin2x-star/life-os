"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SchemaFieldValue = string | number | boolean | string[] | null;

export interface SchemaEntry {
  id: string;
  schemaId: string;
  /** The trade/transaction/calendar-item id this entry rides along with —
   *  null for the two standalone targets (Здоров'я, Головна), which have no
   *  host record to attach to and just get a fresh dated entry per save. */
  recordId: string | null;
  values: Record<string, SchemaFieldValue>;
  createdAt: string;
}

interface SchemaEntriesState {
  entries: SchemaEntry[];
  saveEntry: (schemaId: string, recordId: string | null, values: Record<string, SchemaFieldValue>) => void;
  removeEntriesForRecord: (recordId: string) => void;
}

export const useSchemaEntriesStore = create<SchemaEntriesState>()(
  persist(
    (set) => ({
      entries: [],
      // One entry per (schemaId, recordId) pair when recordId is set — saving
      // again (editing the host record) overwrites rather than accumulating
      // duplicates. Standalone saves (recordId === null) always append: each
      // one is its own dated log entry, same as a health tracker.
      saveEntry: (schemaId, recordId, values) =>
        set((state) => {
          if (recordId === null) {
            return {
              entries: [
                ...state.entries,
                { id: crypto.randomUUID(), schemaId, recordId: null, values, createdAt: new Date().toISOString() },
              ],
            };
          }
          const existing = state.entries.find((e) => e.schemaId === schemaId && e.recordId === recordId);
          if (existing) {
            return { entries: state.entries.map((e) => (e.id === existing.id ? { ...e, values } : e)) };
          }
          return {
            entries: [
              ...state.entries,
              { id: crypto.randomUUID(), schemaId, recordId, values, createdAt: new Date().toISOString() },
            ],
          };
        }),
      removeEntriesForRecord: (recordId) =>
        set((state) => ({ entries: state.entries.filter((e) => e.recordId !== recordId) })),
    }),
    { name: "life-os-schema-entries" }
  )
);

export function getSchemaEntryFor(entries: SchemaEntry[], schemaId: string, recordId: string | null): SchemaEntry | undefined {
  return entries.find((e) => e.schemaId === schemaId && e.recordId === recordId);
}
