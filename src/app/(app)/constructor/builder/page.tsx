"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSchemaStore, type SchemaField, type FieldType, type AttachTab } from "@/lib/schema-store";
import { FIELD_TYPE_META, SCHEMA_ICONS, DEFAULT_SCHEMA_ICON, ATTACH_TAB_LABELS } from "@/lib/constructor-config";
import { useDragReorder } from "@/lib/use-drag-reorder";
import { FieldTypePickerSheet } from "@/components/constructor/FieldTypePickerSheet";
import { SchemaIconPickerSheet } from "@/components/constructor/SchemaIconPickerSheet";
import { AttachTargetPickerSheet } from "@/components/constructor/AttachTargetPickerSheet";
import { PlusIcon, TrashIcon, SparkleIcon, ChevronDownIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

type Mode = "ai" | "manual";

function FieldRow({
  field,
  index,
  onToggleRequired,
  onDelete,
  bindHandle,
  setRowRef,
  dragging,
}: {
  field: SchemaField;
  index: number;
  onToggleRequired: () => void;
  onDelete: () => void;
  bindHandle: ReturnType<typeof useDragReorder>["bindHandle"];
  setRowRef: ReturnType<typeof useDragReorder>["setRowRef"];
  dragging: boolean;
}) {
  const meta = FIELD_TYPE_META[field.type];
  const Icon = meta.icon;
  return (
    <div
      ref={setRowRef(index)}
      className={cn("card-raised mb-2 flex items-center gap-2.5 rounded-card bg-surface p-3", dragging && "opacity-60")}
    >
      <span {...bindHandle(index)} className="flex-shrink-0 touch-none text-[15px] text-text-faint" style={{ cursor: "grab" }}>
        ⠿
      </span>
      <span className="well-pressed flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-card-sm bg-surface-2 text-sage">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-semibold text-text">{field.name}</div>
        <div className="mt-0.5 text-[9.5px] text-text-faint">{meta.typeHint}</div>
      </div>
      <button
        onClick={onToggleRequired}
        aria-label="Обов'язкове поле"
        className={cn("h-4 w-4 flex-shrink-0 rounded-[5px]", field.required ? "bg-sage" : "border border-border")}
      />
      <button onClick={onDelete} aria-label="Видалити поле" className="flex-shrink-0 text-text-faint">
        <TrashIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ConstructorBuilderInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editingId = searchParams.get("id");

  const schemas = useSchemaStore((s) => s.schemas);
  const addSchema = useSchemaStore((s) => s.addSchema);
  const updateSchema = useSchemaStore((s) => s.updateSchema);
  const attachSchemaToTab = useSchemaStore((s) => s.attachSchemaToTab);
  const detachSchema = useSchemaStore((s) => s.detachSchema);

  const editingSchema = editingId ? schemas.find((s) => s.id === editingId) : null;

  const [mode, setMode] = useState<Mode>(editingId ? "manual" : "ai");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(DEFAULT_SCHEMA_ICON);
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [attachedTab, setAttachedTab] = useState<AttachTab | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [attachPickerOpen, setAttachPickerOpen] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState(false);

  // Load an existing schema exactly once when editing — after that this
  // screen's own state is the source of truth until "Зберегти тему" writes
  // it back, so the store's own later changes (e.g. from another tab) don't
  // fight with in-progress edits here.
  useEffect(() => {
    if (editingSchema) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load of an existing schema when ?id= is present, not a render-cascading loop
      setName(editingSchema.name);
      setIcon(editingSchema.icon);
      setFields(editingSchema.fields);
      setAttachedTab(editingSchema.attachedTo?.tab ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  const { draggingIndex, bindHandle, setRowRef } = useDragReorder(fields, setFields);

  function addField(fieldName: string, type: FieldType, options?: string[]) {
    setFields((prev) => [...prev, { id: crypto.randomUUID(), name: fieldName, type, required: false, options }]);
    setTypePickerOpen(false);
  }

  function toggleRequired(id: string) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, required: !f.required } : f)));
  }

  function deleteField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleGenerateFields() {
    if (!aiDescription.trim() || aiBusy) return;
    setAiBusy(true);
    setAiError(false);
    try {
      const res = await fetch("/api/assistant/constructor-generate-fields", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: aiDescription.trim() }),
      });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as {
        fields: { name: string; type: FieldType; required: boolean; options?: string[] }[];
      };
      const generated: SchemaField[] = data.fields.map((f) => ({
        id: crypto.randomUUID(),
        name: f.name,
        type: f.type,
        required: !!f.required,
        options: f.options,
      }));
      setFields((prev) => [...prev, ...generated]);
    } catch {
      setAiError(true);
    } finally {
      setAiBusy(false);
    }
  }

  function handleSave() {
    if (!name.trim()) return;
    const payload = { name: name.trim(), icon, fields, attachedTo: attachedTab ? { tab: attachedTab } : null };
    let id = editingId;
    if (editingSchema) {
      updateSchema(editingSchema.id, payload);
    } else {
      id = addSchema(payload);
    }
    if (id) {
      if (attachedTab) attachSchemaToTab(id, attachedTab);
      else detachSchema(id);
    }
    router.push("/constructor");
  }

  const IconComp = SCHEMA_ICONS[icon] ?? SCHEMA_ICONS[DEFAULT_SCHEMA_ICON];
  const otherSchemas = schemas.filter((s) => s.id !== editingId);

  return (
    <div className="pb-24">
      <div className="mb-4 flex items-center pt-2">
        <button onClick={() => router.push("/constructor")} className="text-[13px] font-semibold text-text-dim">
          ‹ Скасувати
        </button>
        <span className="ml-auto text-[12px] font-bold text-sage">Крок 1 з 2</span>
      </div>

      <div className="mb-4 flex gap-[3px] rounded-btn bg-surface-2 p-[3px]">
        {(["ai", "manual"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-btn py-2.5 text-[12px] font-bold",
              mode === m ? "well-pressed bg-surface text-text" : "text-text-faint"
            )}
          >
            {m === "ai" ? <SparkleIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5 rotate-180" />}
            {m === "ai" ? "AI-опис" : "Ручні"}
          </button>
        ))}
      </div>

      {mode === "ai" && (
        <div className="card-raised mb-4 rounded-card bg-surface p-4">
          <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">
            <SparkleIcon className="h-3.5 w-3.5 text-gold" /> Опиши тему
          </div>
          <textarea
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            placeholder='"Прочитав книжку — хочу записувати автора, головну ідею, три інсайти, і оцінку 1-10, чи застосував на практиці"'
            rows={3}
            className="mb-3 w-full resize-none rounded-input border border-border bg-surface-2 px-3 py-2.5 text-[12.5px] leading-relaxed text-text outline-none"
          />
          <button
            onClick={handleGenerateFields}
            disabled={!aiDescription.trim() || aiBusy}
            className="w-full rounded-btn bg-sage py-3 text-center text-[12.5px] font-bold text-bg disabled:opacity-40"
          >
            {aiBusy ? "Генерую…" : "Згенерувати поля ✨"}
          </button>
          {aiError && <div className="mt-2 text-[11px] text-clay">Не вдалося згенерувати — спробуй ще раз.</div>}
        </div>
      )}

      <div className="card-raised mb-4 flex items-center gap-3 rounded-card bg-surface p-4">
        <button
          onClick={() => setIconPickerOpen(true)}
          className="well-pressed flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-card bg-surface-2 text-sage"
        >
          <IconComp className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Назва теми"
            className="w-full bg-transparent text-[16px] font-bold text-text outline-none placeholder:text-text-faint"
          />
          <div className="mt-0.5 text-[10.5px] text-text-faint">Тап на іконку — обрати іншу</div>
        </div>
      </div>

      <div className="mb-2.5 mt-[18px] text-[11px] font-bold uppercase tracking-wide text-text-faint">Поля теми</div>
      {fields.map((f, i) => (
        <FieldRow
          key={f.id}
          field={f}
          index={i}
          dragging={draggingIndex === i}
          onToggleRequired={() => toggleRequired(f.id)}
          onDelete={() => deleteField(f.id)}
          bindHandle={bindHandle}
          setRowRef={setRowRef}
        />
      ))}

      <button
        onClick={() => setTypePickerOpen(true)}
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-border py-3.5 text-[12.5px] font-bold text-text-faint"
      >
        <PlusIcon className="h-3.5 w-3.5" /> Додати поле
      </button>

      <div className="mb-2.5 mt-[18px] text-[11px] font-bold uppercase tracking-wide text-text-faint">Прив&apos;язка</div>
      <button
        onClick={() => setAttachPickerOpen(true)}
        className="card-raised flex w-full items-center gap-3 rounded-card bg-surface p-3.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-text">
            {attachedTab ? ATTACH_TAB_LABELS[attachedTab] : "Не використовувати"}
          </div>
          <div className="mt-0.5 text-[10px] text-text-faint">Самостійна тема чи всередині наявної вкладки</div>
        </div>
        <span className="flex-shrink-0 text-[12px] font-bold text-sage">{attachedTab ? ATTACH_TAB_LABELS[attachedTab] : "Самостійна"} ›</span>
      </button>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-bg p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="w-full rounded-btn bg-sage py-3.5 text-center text-[13.5px] font-bold text-bg disabled:opacity-40"
        >
          Зберегти тему
        </button>
      </div>

      {iconPickerOpen && (
        <SchemaIconPickerSheet selected={icon} onSelect={setIcon} onClose={() => setIconPickerOpen(false)} />
      )}
      {typePickerOpen && <FieldTypePickerSheet onAdd={addField} onClose={() => setTypePickerOpen(false)} />}
      {attachPickerOpen && (
        <AttachTargetPickerSheet
          current={attachedTab}
          otherSchemas={otherSchemas}
          onSelect={setAttachedTab}
          onClose={() => setAttachPickerOpen(false)}
        />
      )}
    </div>
  );
}

export default function ConstructorBuilderPage() {
  return (
    <Suspense fallback={null}>
      <ConstructorBuilderInner />
    </Suspense>
  );
}
