"use client";

import { useState } from "react";
import type { Schema } from "@/lib/schema-store";
import { useSchemaEntriesStore, type SchemaFieldValue } from "@/lib/schema-entries-store";
import { SCHEMA_ICONS, DEFAULT_SCHEMA_ICON } from "@/lib/constructor-config";
import { SchemaFieldsValueEditor } from "./SchemaFieldsValueEditor";

/** Renders a schema attached to Здоров'я or Головна — the two targets with
 *  no existing "add a record" form to slot fields into, unlike Робота/
 *  Фінанси/Календар's trade/transaction/event forms. Each save here is its
 *  own fresh dated log entry (recordId: null in schema-entries-store), same
 *  shape as any other tracker widget on this app — not tied to any other
 *  record, and the form clears after saving so the next entry starts blank. */
export function AttachedSchemaWidgetCard({ schema }: { schema: Schema }) {
  const saveEntry = useSchemaEntriesStore((s) => s.saveEntry);
  const [values, setValues] = useState<Record<string, SchemaFieldValue>>({});
  const [saved, setSaved] = useState(false);
  const Icon = SCHEMA_ICONS[schema.icon] ?? SCHEMA_ICONS[DEFAULT_SCHEMA_ICON];

  function handleSave() {
    saveEntry(schema.id, null, values);
    setValues({});
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="card-raised rounded-card bg-surface p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="well-pressed flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface-2 text-sage">
          <Icon className="h-4 w-4" />
        </span>
        <div className="text-[13px] font-semibold text-text">{schema.name}</div>
      </div>

      {schema.fields.length === 0 ? (
        <div className="text-[11.5px] text-text-faint">У цій темі ще немає полів</div>
      ) : (
        <>
          <SchemaFieldsValueEditor fields={schema.fields} values={values} onChange={(id, v) => setValues((prev) => ({ ...prev, [id]: v }))} />
          <button
            onClick={handleSave}
            className="mt-3 w-full rounded-btn bg-sage py-2.5 text-center text-[12px] font-bold text-bg"
          >
            {saved ? "Збережено ✓" : "Зберегти"}
          </button>
        </>
      )}
    </div>
  );
}
