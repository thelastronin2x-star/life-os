"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSchemaStore } from "@/lib/schema-store";
import { SCHEMA_ICONS, DEFAULT_SCHEMA_ICON, ATTACH_TAB_LABELS } from "@/lib/constructor-config";
import { PlusIcon } from "@/components/icons";

export default function ConstructorListPage() {
  const router = useRouter();
  const schemas = useSchemaStore((s) => s.schemas);

  return (
    <div>
      <Link href="/" className="mb-2 flex items-center gap-2 pt-2 text-[12.5px] text-text-dim">
        <span className="flex h-7 w-7 items-center justify-center rounded-icon border border-border bg-surface">‹</span>
        Головна
      </Link>
      <div className="mb-1 pt-2 font-heading text-lg font-semibold text-text">Конструктор</div>
      <div className="mb-4 text-[11.5px] text-text-faint">Твої власні теми</div>

      {schemas.length === 0 && (
        <div className="card-raised mb-3 rounded-card bg-surface py-10 text-center text-[12px] font-semibold text-text-faint">
          Ще немає власних тем
        </div>
      )}

      {schemas.map((schema) => {
        const Icon = SCHEMA_ICONS[schema.icon] ?? SCHEMA_ICONS[DEFAULT_SCHEMA_ICON];
        const fieldsSummary = schema.fields.map((f) => f.name).join(" · ") || "Ще немає полів";
        return (
          <button
            key={schema.id}
            onClick={() => router.push(`/constructor/builder?id=${schema.id}`)}
            className="card-raised mb-2.5 flex w-full items-center gap-3 rounded-card bg-surface p-3.5 text-left"
          >
            <span className="well-pressed flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface-2 text-sage">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-text">{schema.name}</div>
              <div className="mt-0.5 truncate text-[10.5px] text-text-faint">{fieldsSummary}</div>
            </div>
            <span
              className="flex-shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide"
              style={
                schema.attachedTo
                  ? { background: "var(--gold-soft)", color: "var(--gold)" }
                  : { background: "var(--surface-2)", color: "var(--text-faint)" }
              }
            >
              {schema.attachedTo ? `↳ ${ATTACH_TAB_LABELS[schema.attachedTo.tab]}` : "Самостійна"}
            </span>
          </button>
        );
      })}

      <button
        onClick={() => router.push("/constructor/builder")}
        className="well-pressed mt-2 flex w-full items-center justify-center gap-2 rounded-card bg-surface py-3.5 text-[12.5px] font-bold text-sage"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Створити нову тему
      </button>
    </div>
  );
}
