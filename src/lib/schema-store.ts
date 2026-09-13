"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FieldType = "text" | "longtext" | "number" | "select" | "boolean" | "scale10" | "date" | "checklist";

export interface SchemaField {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  /** Choice list for "select" (pick one) and "checklist" (each item gets its
   *  own checkbox) — every other type ignores this. */
  options?: string[];
}

/** The five real attachment destinations from the spec. Each one renders the
 *  schema's fields somewhere real in that tab (see the per-target wiring in
 *  TradeForm/TransactionForm/EventForm and the standalone widget cards on
 *  Здоров'я/Головна) — never a fake toggle with nothing behind it. */
export type AttachTab = "work" | "finance" | "calendar" | "health" | "home";

export interface Schema {
  id: string;
  name: string;
  /** Key into CONSTRUCTOR_ICONS (see constructor-icons.tsx), not a raw node —
   *  this is persisted, so it has to be serializable. */
  icon: string;
  fields: SchemaField[];
  attachedTo: { tab: AttachTab } | null;
  createdAt: string;
}

interface SchemaState {
  schemas: Schema[];
  addSchema: (s: Omit<Schema, "id" | "createdAt">) => string;
  updateSchema: (id: string, patch: Partial<Omit<Schema, "id">>) => void;
  removeSchema: (id: string) => void;
  /** Attaching to a tab always exclusive-attaches: any other schema
   *  currently on that tab is detached first, since a tab only ever renders
   *  one attached schema's fields — see schemaAttachedToTab below. */
  attachSchemaToTab: (id: string, tab: AttachTab) => void;
  detachSchema: (id: string) => void;
}

export const useSchemaStore = create<SchemaState>()(
  persist(
    (set) => ({
      schemas: [],
      addSchema: (s) => {
        const id = crypto.randomUUID();
        set((state) => ({ schemas: [...state.schemas, { ...s, id, createdAt: new Date().toISOString() }] }));
        return id;
      },
      updateSchema: (id, patch) =>
        set((state) => ({ schemas: state.schemas.map((sc) => (sc.id === id ? { ...sc, ...patch } : sc)) })),
      removeSchema: (id) => set((state) => ({ schemas: state.schemas.filter((sc) => sc.id !== id) })),
      attachSchemaToTab: (id, tab) =>
        set((state) => ({
          schemas: state.schemas.map((sc) => {
            if (sc.id === id) return { ...sc, attachedTo: { tab } };
            if (sc.attachedTo?.tab === tab) return { ...sc, attachedTo: null };
            return sc;
          }),
        })),
      detachSchema: (id) =>
        set((state) => ({ schemas: state.schemas.map((sc) => (sc.id === id ? { ...sc, attachedTo: null } : sc)) })),
    }),
    { name: "life-os-schemas" }
  )
);

/** One schema can ever be attached to a given tab at a time — attaching a
 *  second one to the same tab silently detaches the first, matching "Не
 *  використовувати" being the only other option in that same picker (a tab
 *  showing two independently-attached schemas at once was never described). */
export function schemaAttachedToTab(schemas: Schema[], tab: AttachTab): Schema | undefined {
  return schemas.find((s) => s.attachedTo?.tab === tab);
}
