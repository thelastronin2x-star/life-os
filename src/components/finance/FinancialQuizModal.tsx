"use client";

import { useState } from "react";
import { pickQuizQuestions } from "@/lib/finance-quiz";
import { formatDateKey } from "@/lib/calendar-utils";
import type { QuizAttempt } from "@/lib/finance-store";
import { cn } from "@/lib/cn";

interface Answer {
  questionId: string;
  selectedOptionId: string;
  correct: boolean;
}

/** Question → pick an option → immediate correct/incorrect + explanation →
 *  next question → summary at the end. The attempt is saved the moment the
 *  last question is answered (not on a separate "Готово" tap after the
 *  summary already shows), so closing the tab from the summary screen
 *  never loses it. */
export function FinancialQuizModal({
  onComplete,
  onClose,
}: {
  onComplete: (attempt: Omit<QuizAttempt, "id">) => void;
  onClose: () => void;
}) {
  const [questions] = useState(() => pickQuizQuestions());
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [finished, setFinished] = useState(false);

  const question = questions[index];
  const isLast = index === questions.length - 1;

  function selectOption(optionId: string) {
    if (selected) return; // one pick per question — no changing the answer after seeing feedback
    setSelected(optionId);
  }

  function next() {
    if (!selected) return;
    const updated = [...answers, { questionId: question.id, selectedOptionId: selected, correct: selected === question.correctOptionId }];
    setAnswers(updated);
    setSelected(null);

    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }

    const scorePct = Math.round((updated.filter((a) => a.correct).length / updated.length) * 100);
    onComplete({ date: formatDateKey(new Date()), answers: updated, scorePct });
    setFinished(true);
  }

  if (finished) {
    const correctCount = answers.filter((a) => a.correct).length;
    const scorePct = Math.round((correctCount / answers.length) * 100);
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
        <div className="w-full max-w-md rounded-t-card bg-bg shadow-card p-5 text-center md:rounded-card">
          <div className="font-display text-[36px] font-bold text-text">{scorePct}%</div>
          <div className="mt-1 text-[12.5px] text-text-dim">
            {correctCount} з {answers.length} правильних відповідей
          </div>
          <button onClick={onClose} className="mt-5 w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg">
            Готово
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[11px] font-semibold text-text-faint">
            Питання {index + 1} з {questions.length}
          </div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>

        <div className="mb-4 text-[14px] font-semibold leading-snug text-text">{question.prompt}</div>

        <div className="space-y-2">
          {question.options.map((opt) => {
            const isCorrect = opt.id === question.correctOptionId;
            const isSelected = opt.id === selected;
            const revealed = selected !== null;
            return (
              <button
                key={opt.id}
                onClick={() => selectOption(opt.id)}
                disabled={revealed}
                className={cn(
                  "w-full rounded-card-sm border-[1.5px] px-3.5 py-3 text-left text-[13px]",
                  !revealed && "border-border bg-surface text-text",
                  revealed && isCorrect && "border-sage bg-sage-soft text-sage",
                  revealed && isSelected && !isCorrect && "border-clay bg-clay-soft text-clay",
                  revealed && !isCorrect && !isSelected && "border-border bg-surface text-text-faint"
                )}
              >
                {opt.text}
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="mt-3.5 rounded-card-sm bg-surface-2 p-3 text-[12px] leading-relaxed text-text-dim">
            {question.explanation}
          </div>
        )}

        <button
          onClick={next}
          disabled={!selected}
          className="mt-4 w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg disabled:opacity-40"
        >
          {isLast ? "Завершити" : "Наступне питання"}
        </button>
      </div>
    </div>
  );
}
