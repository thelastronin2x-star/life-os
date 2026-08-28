"use client";

import { useState } from "react";
import { useStudentStore, type Flashcard } from "@/lib/student-store";
import { REVIEW_QUALITY } from "@/lib/sm2";
import { formatDateKey } from "@/lib/calendar-utils";

const SESSION_START = Date.now();

/** Due cards, one at a time: tap to flip, then grade. Grading immediately
 *  reschedules the card via SM-2 (see student-store.ts's reviewFlashcard)
 *  and advances to the next due card. Finishing (running out of due cards,
 *  or closing early) logs one StudySession with however many were actually
 *  reviewed — partial sessions still count, since XP and the daily quest
 *  are both about real reviews done, not about finishing the whole queue. */
export function FlashcardReviewSheet({ cards, onClose }: { cards: Flashcard[]; onClose: () => void }) {
  const { reviewFlashcard, logStudySession } = useStudentStore();
  const [queue, setQueue] = useState(cards);
  const [flipped, setFlipped] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const current = queue[0];

  function finish() {
    if (reviewedCount > 0) {
      const minutes = Math.max(1, Math.round((Date.now() - SESSION_START) / 60000));
      logStudySession({ date: formatDateKey(new Date()), time: new Date().toTimeString().slice(0, 5), minutes, cardsReviewed: reviewedCount });
    }
    onClose();
  }

  function grade(quality: (typeof REVIEW_QUALITY)[keyof typeof REVIEW_QUALITY]) {
    if (!current) return;
    reviewFlashcard(current.id, quality);
    setReviewedCount((n) => n + 1);
    setFlipped(false);
    setQueue((q) => q.slice(1));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="w-full max-w-md rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-text-faint">
            {current ? `Лишилось ${queue.length}` : "Готово"}
          </span>
          <button onClick={finish} className="text-[13px] font-bold text-text-dim">
            {current ? "Завершити" : "Закрити"}
          </button>
        </div>

        {current ? (
          <>
            <button
              onClick={() => setFlipped((v) => !v)}
              className="card-raised mb-4 flex min-h-[180px] w-full flex-col items-center justify-center rounded-card bg-surface p-6 text-center"
            >
              <span className="mb-2 text-[9.5px] font-bold uppercase tracking-wide text-text-faint">
                {flipped ? "Відповідь" : "Питання"}
              </span>
              <span className="text-[16px] font-semibold leading-relaxed text-text">
                {flipped ? current.back : current.front}
              </span>
              {!flipped && <span className="mt-3 text-[10.5px] text-text-faint">Тапни, щоб побачити відповідь</span>}
            </button>

            {flipped && (
              <div className="flex gap-2">
                <button
                  onClick={() => grade(REVIEW_QUALITY.again)}
                  className="flex-1 rounded-btn bg-clay-soft py-3 text-center text-[12.5px] font-extrabold text-clay"
                >
                  Знову
                </button>
                <button
                  onClick={() => grade(REVIEW_QUALITY.hard)}
                  className="flex-1 rounded-btn bg-gold-soft py-3 text-center text-[12.5px] font-extrabold text-gold"
                >
                  Важко
                </button>
                <button
                  onClick={() => grade(REVIEW_QUALITY.easy)}
                  className="flex-1 rounded-btn bg-sage-soft py-3 text-center text-[12.5px] font-extrabold text-sage"
                >
                  Легко
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="card-raised rounded-card bg-surface py-10 text-center">
            <div className="text-[14px] font-bold text-text">
              {reviewedCount > 0 ? `Повторено ${reviewedCount} карток!` : "Немає карток для повторення"}
            </div>
            <div className="mt-1 text-[11.5px] text-text-faint">
              {reviewedCount > 0 ? "Наступні картки з'являться, коли підійде їхній час." : "Додай картки в бібліотеці предметів."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
