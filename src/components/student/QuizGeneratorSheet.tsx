"use client";

import { useState } from "react";
import type { Course } from "@/lib/student-store";
import { callAssistantOnce } from "@/lib/assistant-client";

const QUESTION_COUNT = 10;

function buildQuizPrompt(topic: string): string {
  return `Згенеруй ${QUESTION_COUNT} питань для самоперевірки на основі конспекту нижче${
    topic.trim() ? ` за темою "${topic.trim()}"` : ""
  }. Питання українською, пронумеровані, без відповідей одразу — відповідь додай окремим рядком "Відповідь: ..." одразу під кожним питанням.`;
}

/** Generates a self-check quiz from the course's own notes text — a single
 *  one-shot "report"-tier call (powerful model, since writing good quiz
 *  questions needs real reasoning about the material), not a cached insight
 *  and not a chat: there's nothing to keep regenerating once the answer is
 *  in hand. */
export function QuizGeneratorSheet({ course, onClose }: { course: Course; onClose: () => void }) {
  const [topic, setTopic] = useState("");
  const [quiz, setQuiz] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(false);

  async function handleGenerate() {
    if (!course.notes.trim()) return;
    setIsGenerating(true);
    setError(false);
    setQuiz(null);
    try {
      const text = await callAssistantOnce(buildQuizPrompt(topic), `Конспекти предмета "${course.name}": ${course.notes}`, "report");
      setQuiz(text);
    } catch {
      setError(true);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[14px] font-bold text-text">Тест з конспекту</div>
            <div className="text-[11px] text-text-faint">{course.name}</div>
          </div>
          <button onClick={onClose} className="text-[13px] font-bold text-text-dim">
            Закрити
          </button>
        </div>

        {!course.notes.trim() ? (
          <div className="rounded-card-sm bg-surface shadow-card py-8 text-center text-[11.5px] text-text-faint">
            У цього предмета ще немає конспектів — додай їх у бібліотеці предметів.
          </div>
        ) : (
          <>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Тема (необов'язково) — напр. «Розділ 4»"
              className="mb-3 w-full rounded-input border border-border bg-surface px-3 py-2.5 text-[13px] text-text outline-none"
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="mb-4 w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg disabled:opacity-50"
            >
              {isGenerating ? "Генерую…" : `Згенерувати ${QUESTION_COUNT} питань`}
            </button>

            {error && <div className="text-center text-[11.5px] text-clay">Не вдалося згенерувати тест. Спробуй ще раз.</div>}
            {quiz && (
              <div className="whitespace-pre-wrap rounded-card border border-border bg-surface p-3.5 text-[12.5px] leading-relaxed text-text">
                {quiz}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
