"use client";

import { NumberInput } from "@/components/ui/NumberInput";
import type { SchemaField } from "@/lib/schema-store";
import type { SchemaFieldValue } from "@/lib/schema-entries-store";
import { cn } from "@/lib/cn";

/** Renders one input per field, appropriate to its type — the one universal
 *  renderer every attached schema goes through, whether it's inline inside
 *  TradeForm/TransactionForm/EventForm or standing alone on the Здоров'я/
 *  Головна widget card. Nothing here hardcodes a specific schema's fields;
 *  it only ever reacts to `field.type`. */
export function SchemaFieldsValueEditor({
  fields,
  values,
  onChange,
}: {
  fields: SchemaField[];
  values: Record<string, SchemaFieldValue>;
  onChange: (fieldId: string, value: SchemaFieldValue) => void;
}) {
  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <div key={field.id}>
          <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-faint">
            {field.name}
            {field.required && <span className="text-clay"> *</span>}
          </div>
          <FieldInput field={field} value={values[field.id] ?? null} onChange={(v) => onChange(field.id, v)} />
        </div>
      ))}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: SchemaField;
  value: SchemaFieldValue;
  onChange: (v: SchemaFieldValue) => void;
}) {
  switch (field.type) {
    case "text":
      return (
        <input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-input border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none"
        />
      );
    case "longtext":
      return (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-input border border-border bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed text-text outline-none"
        />
      );
    case "number":
      return (
        <NumberInput
          value={typeof value === "number" ? value : 0}
          onChange={onChange}
          className="w-full rounded-input border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none"
        />
      );
    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-input border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none"
        />
      );
    case "boolean":
      return (
        <div className="flex gap-2">
          {(["Так", "Ні"] as const).map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => onChange(label)}
              className={cn(
                "flex-1 rounded-btn py-2.5 text-center text-[12.5px] font-semibold",
                value === label ? "bg-sage text-bg" : "bg-surface-2 text-text-dim"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      );
    case "scale10":
      return (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={cn(
                "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                value === n ? "bg-sage text-bg" : "bg-surface-2 text-text-dim"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      );
    case "select": {
      const options = field.options ?? [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[11.5px] font-semibold",
                value === opt ? "bg-sage text-bg" : "bg-surface-2 text-text-dim"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    }
    case "checklist": {
      const options = field.options ?? [];
      const checked = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-1.5">
          {options.map((opt) => {
            const on = checked.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(on ? checked.filter((o) => o !== opt) : [...checked, opt])}
                className="flex w-full items-center gap-2.5 rounded-input border border-border bg-surface-2 px-3 py-2 text-left"
              >
                <span
                  className={cn("flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[5px]", on ? "bg-sage" : "border border-border")}
                >
                  {on && <span className="text-[10px] font-bold text-bg">✓</span>}
                </span>
                <span className="text-[12.5px] text-text">{opt}</span>
              </button>
            );
          })}
        </div>
      );
    }
    default:
      return null;
  }
}
