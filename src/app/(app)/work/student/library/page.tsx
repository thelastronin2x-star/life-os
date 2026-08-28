"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStudentStore } from "@/lib/student-store";
import { computeDeckStats } from "@/lib/student-insights";
import { WEEKDAY_LABELS } from "@/lib/student-insights";
import { formatDateKey } from "@/lib/calendar-utils";
import { useStudentOnlyGuard } from "@/lib/use-trader-guard";
import { cn } from "@/lib/cn";
import { TrashIcon } from "@/components/icons";

type Section = "courses" | "cards" | "schedule" | "grades";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "courses", label: "Предмети" },
  { id: "cards", label: "Картки" },
  { id: "schedule", label: "Розклад" },
  { id: "grades", label: "Оцінки" },
];

export default function StudentLibraryPage() {
  const isStudent = useStudentOnlyGuard();
  const {
    courses,
    flashcards,
    classSchedule,
    grades,
    addCourse,
    updateCourse,
    removeCourse,
    addFlashcard,
    removeFlashcard,
    addClassScheduleItem,
    removeClassScheduleItem,
    addGrade,
    removeGrade,
  } = useStudentStore();

  const [section, setSection] = useState<Section>("courses");

  // --- Courses ---
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [newCourseName, setNewCourseName] = useState("");

  const editingCourse = courses.find((c) => c.id === editingCourseId) ?? null;

  function handleAddCourse() {
    const name = newCourseName.trim();
    if (!name) return;
    const id = addCourse({ name, syllabus: "", notes: "" });
    setNewCourseName("");
    setEditingCourseId(id);
  }

  // --- Cards ---
  const [cardCourseId, setCardCourseId] = useState(courses[0]?.id ?? "");
  const [deckName, setDeckName] = useState("");
  const [cardFront, setCardFront] = useState("");
  const [cardBack, setCardBack] = useState("");
  const deckStats = useMemo(() => computeDeckStats(flashcards), [flashcards]);
  const decksForCourse = deckStats.filter((d) => d.courseId === (cardCourseId || courses[0]?.id));
  const cardsForCourse = flashcards.filter((f) => f.courseId === (cardCourseId || courses[0]?.id));

  function handleAddCard() {
    const front = cardFront.trim();
    const back = cardBack.trim();
    const courseId = cardCourseId || courses[0]?.id;
    const deck = deckName.trim();
    if (!front || !back || !courseId || !deck) return;
    addFlashcard({ courseId, deckName: deck, front, back });
    setCardFront("");
    setCardBack("");
  }

  // --- Schedule ---
  const [scheduleCourseId, setScheduleCourseId] = useState(courses[0]?.id ?? "");
  const [scheduleWeekday, setScheduleWeekday] = useState(0);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const sortedSchedule = [...classSchedule].sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time));

  function handleAddScheduleItem() {
    const courseId = scheduleCourseId || courses[0]?.id;
    if (!courseId) return;
    addClassScheduleItem({ courseId, weekday: scheduleWeekday, time: scheduleTime });
  }

  // --- Grades ---
  const [gradeCourseId, setGradeCourseId] = useState(courses[0]?.id ?? "");
  const [gradeValue, setGradeValue] = useState("5");
  const sortedGrades = [...grades].sort((a, b) => b.date.localeCompare(a.date));

  function handleAddGrade() {
    const courseId = gradeCourseId || courses[0]?.id;
    const value = Number(gradeValue);
    if (!courseId || !Number.isFinite(value)) return;
    addGrade({ courseId, value, date: formatDateKey(new Date()) });
  }

  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? "—";

  if (!isStudent) return null;

  return (
    <div>
      <div className="pb-3.5 pt-2">
        <Link href="/work" className="mb-2 flex items-center gap-2 text-[12.5px] text-text-dim">
          <span className="flex h-7 w-7 items-center justify-center rounded-icon border border-border bg-surface">
            ‹
          </span>
          Робота
        </Link>
        <div className="font-heading text-lg font-semibold text-text">Предмети й картки</div>
        <div className="mt-0.5 text-[11.5px] text-text-faint">
          Керуй курсами, флеш-картками, розкладом і оцінками
        </div>
      </div>

      <div className="mb-3.5 flex gap-2 overflow-x-auto pb-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={cn(
              "flex-shrink-0 rounded-btn px-3.5 py-2 text-[11.5px] font-extrabold",
              section === s.id ? "bg-text text-bg" : "bg-surface text-text-dim"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "courses" && (
        <div>
          <div className="mb-3 flex gap-1.5">
            <input
              type="text"
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
              placeholder="Назва предмета"
              className="flex-1 rounded-input border border-border bg-surface px-3 py-2.5 text-[13px] text-text outline-none"
            />
            <button onClick={handleAddCourse} className="rounded-btn bg-accent px-4 py-2.5 text-[12px] font-semibold text-bg">
              Додати
            </button>
          </div>

          {courses.length === 0 && (
            <div className="card-raised rounded-card-sm bg-surface py-8 text-center text-[11.5px] text-text-faint">
              Ще немає предметів
            </div>
          )}

          {courses.map((c) => (
            <div key={c.id} className="card-raised mb-2.5 rounded-card bg-surface p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13.5px] font-bold text-text">{c.name}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingCourseId(editingCourseId === c.id ? null : c.id)}
                    className="text-[11px] font-semibold text-sage"
                  >
                    {editingCourseId === c.id ? "згорнути" : "силабус / конспекти"}
                  </button>
                  <button onClick={() => removeCourse(c.id)} className="text-text-faint">
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {editingCourse?.id === c.id && (
                <div className="space-y-2">
                  <div>
                    <span className="mb-1 block text-[9.5px] font-bold uppercase text-text-faint">Силабус</span>
                    <textarea
                      value={c.syllabus}
                      onChange={(e) => updateCourse(c.id, { syllabus: e.target.value })}
                      rows={3}
                      placeholder="Теми курсу, структура..."
                      className="w-full resize-none rounded-input border border-border bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-text outline-none"
                    />
                  </div>
                  <div>
                    <span className="mb-1 block text-[9.5px] font-bold uppercase text-text-faint">Конспекти</span>
                    <textarea
                      value={c.notes}
                      onChange={(e) => updateCourse(c.id, { notes: e.target.value })}
                      rows={5}
                      placeholder="Нотатки з лекцій — AI-тьютор і генератор тестів читають саме це"
                      className="w-full resize-none rounded-input border border-border bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-text outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {section === "cards" && (
        <div>
          {courses.length === 0 ? (
            <div className="card-raised rounded-card-sm bg-surface py-8 text-center text-[11.5px] text-text-faint">
              Спочатку додай предмет у вкладці «Предмети»
            </div>
          ) : (
            <>
              <select
                value={cardCourseId || courses[0]?.id}
                onChange={(e) => setCardCourseId(e.target.value)}
                className="mb-3 w-full rounded-input border border-border bg-surface px-3 py-2.5 text-[13px] text-text outline-none"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {decksForCourse.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {decksForCourse.map((d) => (
                    <span
                      key={d.deckName}
                      className="rounded-full bg-surface-2 px-3 py-1.5 text-[10.5px] font-semibold text-text-dim"
                    >
                      {d.deckName} · {d.total} карток · {d.pct}% запам&apos;ятано
                    </span>
                  ))}
                </div>
              )}

              <div className="card-raised mb-3 rounded-card bg-surface p-3.5">
                <input
                  type="text"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  placeholder="Назва колоди (напр. «Мікро»)"
                  className="mb-2 w-full rounded-input border border-border bg-surface-2 px-3 py-2 text-[12.5px] text-text outline-none"
                />
                <textarea
                  value={cardFront}
                  onChange={(e) => setCardFront(e.target.value)}
                  placeholder="Питання / термін"
                  rows={2}
                  className="mb-2 w-full resize-none rounded-input border border-border bg-surface-2 px-3 py-2 text-[12.5px] text-text outline-none"
                />
                <textarea
                  value={cardBack}
                  onChange={(e) => setCardBack(e.target.value)}
                  placeholder="Відповідь"
                  rows={2}
                  className="mb-2 w-full resize-none rounded-input border border-border bg-surface-2 px-3 py-2 text-[12.5px] text-text outline-none"
                />
                <button onClick={handleAddCard} className="w-full rounded-btn bg-accent py-2.5 text-[12px] font-semibold text-bg">
                  Додати картку
                </button>
              </div>

              {cardsForCourse.map((f) => (
                <div key={f.id} className="card-raised mb-1.5 flex items-center gap-2.5 rounded-card-sm bg-surface p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-semibold text-text">{f.front}</div>
                    <div className="truncate text-[10.5px] text-text-faint">
                      {f.deckName} · {f.back}
                    </div>
                  </div>
                  <button onClick={() => removeFlashcard(f.id)} className="flex-shrink-0 text-text-faint">
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {section === "schedule" && (
        <div>
          {courses.length === 0 ? (
            <div className="card-raised rounded-card-sm bg-surface py-8 text-center text-[11.5px] text-text-faint">
              Спочатку додай предмет у вкладці «Предмети»
            </div>
          ) : (
            <>
              <div className="card-raised mb-3 rounded-card bg-surface p-3.5">
                <select
                  value={scheduleCourseId || courses[0]?.id}
                  onChange={(e) => setScheduleCourseId(e.target.value)}
                  className="mb-2 w-full rounded-input border border-border bg-surface-2 px-3 py-2 text-[12.5px] text-text outline-none"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="mb-2 flex gap-2">
                  <select
                    value={scheduleWeekday}
                    onChange={(e) => setScheduleWeekday(Number(e.target.value))}
                    className="flex-1 rounded-input border border-border bg-surface-2 px-3 py-2 text-[12.5px] text-text outline-none"
                  >
                    {WEEKDAY_LABELS.map((l, i) => (
                      <option key={l} value={i}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="flex-1 rounded-input border border-border bg-surface-2 px-3 py-2 text-[12.5px] text-text outline-none"
                  />
                </div>
                <button onClick={handleAddScheduleItem} className="w-full rounded-btn bg-accent py-2.5 text-[12px] font-semibold text-bg">
                  Додати пару
                </button>
              </div>

              {sortedSchedule.map((s) => (
                <div key={s.id} className="card-raised mb-1.5 flex items-center gap-2.5 rounded-card-sm bg-surface p-3">
                  <span className="w-9 flex-shrink-0 text-[11px] font-bold text-text-faint">{WEEKDAY_LABELS[s.weekday]}</span>
                  <span className="flex-1 text-[12.5px] font-semibold text-text">{courseName(s.courseId)}</span>
                  <span className="font-mono text-[11.5px] text-text-faint">{s.time}</span>
                  <button onClick={() => removeClassScheduleItem(s.id)} className="flex-shrink-0 text-text-faint">
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {section === "grades" && (
        <div>
          {courses.length === 0 ? (
            <div className="card-raised rounded-card-sm bg-surface py-8 text-center text-[11.5px] text-text-faint">
              Спочатку додай предмет у вкладці «Предмети»
            </div>
          ) : (
            <>
              <div className="card-raised mb-3 flex gap-2 rounded-card bg-surface p-3.5">
                <select
                  value={gradeCourseId || courses[0]?.id}
                  onChange={(e) => setGradeCourseId(e.target.value)}
                  className="flex-1 rounded-input border border-border bg-surface-2 px-3 py-2 text-[12.5px] text-text outline-none"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={gradeValue}
                  onChange={(e) => setGradeValue(e.target.value)}
                  className="w-16 rounded-input border border-border bg-surface-2 px-2 py-2 text-center text-[12.5px] text-text outline-none"
                />
                <button onClick={handleAddGrade} className="rounded-btn bg-accent px-4 py-2 text-[12px] font-semibold text-bg">
                  +
                </button>
              </div>

              {sortedGrades.map((g) => (
                <div key={g.id} className="card-raised mb-1.5 flex items-center gap-2.5 rounded-card-sm bg-surface p-3">
                  <span className="flex-1 text-[12.5px] font-semibold text-text">{courseName(g.courseId)}</span>
                  <span className="font-mono text-[13px] font-bold text-gold">{g.value}</span>
                  <span className="text-[10.5px] text-text-faint">{g.date}</span>
                  <button onClick={() => removeGrade(g.id)} className="flex-shrink-0 text-text-faint">
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
