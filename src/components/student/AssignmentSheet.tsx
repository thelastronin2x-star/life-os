"use client";

import { useState } from "react";
import { useStudentStore } from "@/lib/student-store";
import { computeUpcomingDeadlines } from "@/lib/student-insights";
import { formatDateKey } from "@/lib/calendar-utils";
import { TrashIcon } from "@/components/icons";

export function AssignmentSheet({ onClose }: { onClose: () => void }) {
  const { courses, assignments, addAssignment, toggleAssignment, removeAssignment } = useStudentStore();
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<string>("");
  const [dueDate, setDueDate] = useState(formatDateKey(new Date()));

  const deadlines = computeUpcomingDeadlines(assignments);
  const courseName = (id: string | null) => courses.find((c) => c.id === id)?.name;

  function handleAdd() {
    const t = title.trim();
    if (!t) return;
    addAssignment({ title: t, dueDate, courseId: courseId || null });
    setTitle("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[14px] font-bold text-text">Завдання й дедлайни</div>
          <button onClick={onClose} className="text-[13px] font-bold text-text-dim">
            Закрити
          </button>
        </div>

        <div className="mb-4 rounded-card bg-surface shadow-card p-3.5">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Що потрібно здати?"
            className="mb-2 w-full rounded-input border border-border bg-surface-2 px-3 py-2 text-[12.5px] text-text outline-none"
          />
          <div className="flex gap-2">
            {courses.length > 0 && (
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="flex-1 rounded-input border border-border bg-surface-2 px-3 py-2 text-[12.5px] text-text outline-none"
              >
                <option value="">Без предмета</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="flex-1 rounded-input border border-border bg-surface-2 px-3 py-2 text-[12.5px] text-text outline-none"
            />
          </div>
          <button onClick={handleAdd} className="mt-2 w-full rounded-btn bg-accent py-2.5 text-[12px] font-semibold text-bg">
            Додати
          </button>
        </div>

        {deadlines.length === 0 && (
          <div className="rounded-card-sm bg-surface shadow-card py-8 text-center text-[11.5px] text-text-faint">
            Немає найближчих дедлайнів
          </div>
        )}

        {deadlines.map((d) => (
          <div key={d.id} className="mb-1.5 flex items-center gap-2.5 rounded-card-sm bg-surface shadow-card p-3">
            <button
              onClick={() => toggleAssignment(d.id)}
              className="h-4 w-4 flex-shrink-0 rounded-[5px] border-2 border-border"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold text-text">{d.title}</div>
              {courseName(assignments.find((a) => a.id === d.id)?.courseId ?? null) && (
                <div className="text-[10px] text-text-faint">{courseName(assignments.find((a) => a.id === d.id)?.courseId ?? null)}</div>
              )}
            </div>
            <span className="flex-shrink-0 text-[10.5px] font-semibold text-text-faint">{d.relativeLabel}</span>
            <button onClick={() => removeAssignment(d.id)} className="flex-shrink-0 text-text-faint">
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
