"use client";

import { useState } from "react";
import type { TeamProjectView, TeamProjectPart, PartStatus } from "@/lib/teams/types";
import { REVIEW_QUALITY, type ReviewQuality } from "@/lib/sm2";
import { formatRelativeTime } from "@/lib/news-view";
import { cn } from "@/lib/cn";

const WEEKDAY_LABELS = ["Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота", "Неділя"];
const STATUS_LABEL: Record<PartStatus, string> = { todo: "Не почато", in_progress: "У роботі", done: "Готово" };
const NEXT_STATUS: Record<PartStatus, PartStatus> = { todo: "in_progress", in_progress: "done", done: "todo" };

interface Props {
  project: TeamProjectView;
  myDeviceId: string;
  myDisplayName: string;
  onAddEntry: (text: string) => Promise<{ ok: boolean }>;
  onUpdateData: (data: Record<string, unknown>) => Promise<{ ok: boolean }>;
  onAddCard: (front: string, back: string) => Promise<{ ok: boolean }>;
  onReviewCard: (cardId: string, quality: ReviewQuality) => Promise<{ ok: boolean }>;
  onClose: () => void;
}

function NoteBody({ project, myDeviceId, onAddEntry }: Pick<Props, "project" | "myDeviceId" | "onAddEntry">) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!text.trim() || pending) return;
    setPending(true);
    const result = await onAddEntry(text);
    setPending(false);
    if (result.ok) setText("");
  }

  return (
    <>
      <div className="mb-4 max-h-[45vh] overflow-y-auto">
        {(project.entries ?? []).length === 0 ? (
          <div className="py-6 text-center text-[11.5px] text-text-faint">Ще немає записів</div>
        ) : (
          (project.entries ?? []).map((entry) => (
            <div key={entry.id} className="mb-3 last:mb-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] font-bold text-text">{entry.deviceId === myDeviceId ? "Ти" : entry.displayName}</span>
                <span className="text-[9.5px] text-text-faint">{formatRelativeTime(entry.createdAt)}</span>
              </div>
              <div className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-text-dim">{entry.text}</div>
            </div>
          ))
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Додати запис…"
        rows={3}
        className="mb-2 w-full resize-none rounded-input border border-border bg-surface px-3 py-2.5 text-[13px] text-text outline-none"
      />
      <button onClick={submit} disabled={!text.trim() || pending} className="w-full rounded-btn bg-text py-2.5 text-[12px] font-extrabold text-bg disabled:opacity-50">
        Додати
      </button>
    </>
  );
}

function SessionBody({ project, onUpdateData }: Pick<Props, "project" | "onUpdateData">) {
  const data = project.data as { weekday?: number; time?: string };
  const weekday = data.weekday ?? 1;
  const time = data.time ?? "19:00";

  return (
    <div className="rounded-card border border-border bg-surface p-4 text-center">
      <div className="text-[12px] font-semibold text-text-faint">Наступна сесія</div>
      <div className="mt-1.5 font-heading text-[18px] font-bold text-text">
        {WEEKDAY_LABELS[weekday - 1]}, {time}
      </div>
      <div className="mt-3 flex justify-center gap-2">
        <select
          value={weekday}
          onChange={(e) => onUpdateData({ weekday: Number(e.target.value), time })}
          className="rounded-input border border-border bg-bg px-2.5 py-2 text-[12px] text-text outline-none"
        >
          {WEEKDAY_LABELS.map((label, i) => (
            <option key={label} value={i + 1}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={time}
          onChange={(e) => onUpdateData({ weekday, time: e.target.value })}
          className="rounded-input border border-border bg-bg px-2.5 py-2 text-[12px] text-text outline-none"
        />
      </div>
    </div>
  );
}

function PartsBody({ project, myDeviceId, myDisplayName, onUpdateData }: Pick<Props, "project" | "myDeviceId" | "myDisplayName" | "onUpdateData">) {
  const parts = ((project.data as { parts?: TeamProjectPart[] }).parts ?? []) as TeamProjectPart[];
  const [newPart, setNewPart] = useState("");

  function save(nextParts: TeamProjectPart[]) {
    onUpdateData({ parts: nextParts });
  }

  function addPart() {
    if (!newPart.trim()) return;
    save([...parts, { id: crypto.randomUUID(), name: newPart.trim(), assigneeDeviceId: null, assigneeName: null, status: "todo" }]);
    setNewPart("");
  }

  function claim(partId: string) {
    save(parts.map((p) => (p.id === partId ? { ...p, assigneeDeviceId: myDeviceId, assigneeName: myDisplayName } : p)));
  }

  function cycleStatus(partId: string) {
    save(parts.map((p) => (p.id === partId ? { ...p, status: NEXT_STATUS[p.status] } : p)));
  }

  return (
    <>
      <div className="mb-4 space-y-2">
        {parts.length === 0 ? (
          <div className="py-6 text-center text-[11.5px] text-text-faint">Ще немає частин — додай першу нижче</div>
        ) : (
          parts.map((part) => (
            <div key={part.id} className="rounded-card-sm border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-text">{part.name}</span>
                <button
                  onClick={() => cycleStatus(part.id)}
                  className={cn(
                    "flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold",
                    part.status === "done" && "bg-sage/15 text-sage",
                    part.status === "in_progress" && "bg-gold/15 text-gold",
                    part.status === "todo" && "bg-surface-2 text-text-faint"
                  )}
                >
                  {STATUS_LABEL[part.status]}
                </button>
              </div>
              <div className="mt-1.5 text-[10.5px] text-text-faint">
                {part.assigneeName ? (
                  `Відповідає: ${part.assigneeDeviceId === myDeviceId ? "ти" : part.assigneeName}`
                ) : (
                  <button onClick={() => claim(part.id)} className="font-semibold text-sage">
                    Взяти собі →
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={newPart}
          onChange={(e) => setNewPart(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addPart()}
          placeholder="Нова частина…"
          className="flex-1 rounded-input border border-border bg-surface px-3 py-2.5 text-[13px] text-text outline-none"
        />
        <button onClick={addPart} disabled={!newPart.trim()} className="rounded-btn bg-text px-4 py-2.5 text-[12px] font-bold text-bg disabled:opacity-50">
          Додати
        </button>
      </div>
    </>
  );
}

function SharedDeckBody({ project, onAddCard, onReviewCard }: Pick<Props, "project" | "onAddCard" | "onReviewCard">) {
  const cards = project.cards ?? [];
  const dueCards = cards.filter((c) => c.due);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [reviewQueue, setReviewQueue] = useState<typeof cards | null>(null);
  const [flipped, setFlipped] = useState(false);

  async function addCard() {
    if (!front.trim() || !back.trim()) return;
    const result = await onAddCard(front, back);
    if (result.ok) {
      setFront("");
      setBack("");
    }
  }

  async function grade(quality: ReviewQuality) {
    if (!reviewQueue || reviewQueue.length === 0) return;
    await onReviewCard(reviewQueue[0].id, quality);
    setFlipped(false);
    setReviewQueue((q) => (q ? q.slice(1) : q));
  }

  if (reviewQueue) {
    const current = reviewQueue[0];
    return (
      <div>
        {current ? (
          <>
            <div onClick={() => setFlipped((f) => !f)} className="mb-4 flex min-h-[160px] cursor-pointer items-center justify-center rounded-card border border-border bg-surface p-6 text-center">
              <div className="text-[14px] font-semibold text-text">{flipped ? current.back : current.front}</div>
            </div>
            {!flipped ? (
              <button onClick={() => setFlipped(true)} className="w-full rounded-btn bg-text py-2.5 text-[12px] font-extrabold text-bg">
                Показати відповідь
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => grade(REVIEW_QUALITY.again)} className="flex-1 rounded-btn bg-clay/15 py-2.5 text-[11.5px] font-bold text-clay">
                  Знову
                </button>
                <button onClick={() => grade(REVIEW_QUALITY.hard)} className="flex-1 rounded-btn bg-gold/15 py-2.5 text-[11.5px] font-bold text-gold">
                  Важко
                </button>
                <button onClick={() => grade(REVIEW_QUALITY.easy)} className="flex-1 rounded-btn bg-sage/15 py-2.5 text-[11.5px] font-bold text-sage">
                  Легко
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="py-6 text-center text-[12px] font-semibold text-text-faint">Готово — усі картки повторено</div>
        )}
        <button onClick={() => setReviewQueue(null)} className="mt-3 w-full text-center text-[11.5px] font-semibold text-text-dim">
          Назад до колоди
        </button>
      </div>
    );
  }

  return (
    <>
      {dueCards.length > 0 && (
        <button onClick={() => setReviewQueue(dueCards)} className="mb-4 w-full rounded-btn bg-sage py-3 text-[12.5px] font-extrabold text-bg">
          Повторити {dueCards.length} карток
        </button>
      )}
      <div className="mb-4 max-h-[35vh] overflow-y-auto">
        {cards.length === 0 ? (
          <div className="py-6 text-center text-[11.5px] text-text-faint">Колода ще порожня</div>
        ) : (
          cards.map((card) => (
            <div key={card.id} className="border-b border-border py-2.5 last:border-b-0">
              <div className="text-[12px] font-semibold text-text">{card.front}</div>
              <div className="mt-0.5 text-[10.5px] text-text-faint">Додав(-ла): {card.addedByName}</div>
            </div>
          ))
        )}
      </div>
      <input
        value={front}
        onChange={(e) => setFront(e.target.value)}
        placeholder="Питання / термін"
        className="mb-2 w-full rounded-input border border-border bg-surface px-3 py-2.5 text-[13px] text-text outline-none"
      />
      <textarea
        value={back}
        onChange={(e) => setBack(e.target.value)}
        placeholder="Відповідь"
        rows={2}
        className="mb-2 w-full resize-none rounded-input border border-border bg-surface px-3 py-2.5 text-[13px] text-text outline-none"
      />
      <button onClick={addCard} disabled={!front.trim() || !back.trim()} className="w-full rounded-btn bg-text py-2.5 text-[12px] font-extrabold text-bg disabled:opacity-50">
        Додати картку
      </button>
    </>
  );
}

export function TeamProjectSheet({ project, myDeviceId, myDisplayName, onAddEntry, onUpdateData, onAddCard, onReviewCard, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-card bg-bg p-5 shadow-card md:rounded-card" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[14px] font-bold text-text">{project.name}</div>
          <button onClick={onClose} className="text-[13px] font-bold text-text-dim">
            Закрити
          </button>
        </div>

        {project.kind === "note" && <NoteBody project={project} myDeviceId={myDeviceId} onAddEntry={onAddEntry} />}
        {project.kind === "session" && <SessionBody project={project} onUpdateData={onUpdateData} />}
        {project.kind === "parts_project" && (
          <PartsBody project={project} myDeviceId={myDeviceId} myDisplayName={myDisplayName} onUpdateData={onUpdateData} />
        )}
        {project.kind === "shared_deck" && <SharedDeckBody project={project} onAddCard={onAddCard} onReviewCard={onReviewCard} />}
      </div>
    </div>
  );
}
