"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useStudentStore } from "@/lib/student-store";
import {
  computeStudyStreak,
  computeDailyQuest,
  computeWeeklyRecap,
  computeStudyHeatmap,
  computeSubjectPerformance,
  computeOverallAverageGrade,
  computeDeckStats,
  mostRecentDeck,
  computeAchievements,
  computeTotalCardsReviewed,
  computeClassesToday,
  computeUpcomingDeadlines,
  computeDueCardsCount,
  WEEKDAY_LABELS,
} from "@/lib/student-insights";
import { useStudentInsightSync } from "@/lib/use-student-insight-sync";
import { shareWeeklyCard } from "@/lib/student-share-card";
import { FlashcardReviewSheet } from "./FlashcardReviewSheet";
import { AssignmentSheet } from "./AssignmentSheet";
import { TutorChatSheet } from "./TutorChatSheet";
import { QuizGeneratorSheet } from "./QuizGeneratorSheet";
import { PickerSheet } from "@/components/ui/PickerSheet";
import { formatDateKey } from "@/lib/calendar-utils";
import { cn } from "@/lib/cn";
import {
  FireIcon,
  SparkleIcon,
  PlusIcon,
  ClockIcon,
  NotebookIcon,
  MedalIcon,
  UsersIcon,
  ShareIcon,
  LayersIcon,
  CalendarDateIcon,
  GraduationCapIcon,
  ConstructionIcon,
} from "@/components/icons";

function heatColor(intensity: number): string {
  if (intensity === 0) return "var(--surface-2)";
  return `color-mix(in srgb, var(--sage) ${Math.round(intensity * 78)}%, var(--surface-2))`;
}

function ComingSoonCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-3.5">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface-2 text-text-faint">
          <ConstructionIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-bold text-text">{title}</div>
          <div className="mt-0.5 text-[11px] leading-relaxed text-text-faint">{description}</div>
        </div>
      </div>
    </div>
  );
}

export function StudentWork() {
  const { courses, flashcards, studySessions, classSchedule, grades, assignments } = useStudentStore();

  const streak = useMemo(() => computeStudyStreak(studySessions), [studySessions]);
  const quest = useMemo(() => computeDailyQuest(studySessions), [studySessions]);
  const weeklyRecap = useMemo(() => computeWeeklyRecap(studySessions), [studySessions]);
  const heatmap = useMemo(() => computeStudyHeatmap(studySessions), [studySessions]);
  const subjectPerf = useMemo(() => computeSubjectPerformance(grades, courses), [grades, courses]);
  const overallAvg = useMemo(() => computeOverallAverageGrade(grades), [grades]);
  const deckStats = useMemo(() => computeDeckStats(flashcards), [flashcards]);
  const activeDeck = useMemo(() => mostRecentDeck(flashcards), [flashcards]);
  const achievements = useMemo(
    () => computeAchievements(streak, computeTotalCardsReviewed(studySessions), deckStats),
    [streak, studySessions, deckStats]
  );
  const classesToday = useMemo(() => computeClassesToday(classSchedule, courses), [classSchedule, courses]);
  const deadlines = useMemo(() => computeUpcomingDeadlines(assignments), [assignments]);
  const dueCount = useMemo(() => computeDueCardsCount(flashcards), [flashcards]);

  const insight = useStudentInsightSync();
  const insightText = insight.streamingText ?? insight.cached?.text ?? "";

  const [reviewOpen, setReviewOpen] = useState(false);
  const [assignmentsOpen, setAssignmentsOpen] = useState(false);
  const [coursePickerFor, setCoursePickerFor] = useState<"tutor" | "quiz" | null>(null);
  const [tutorCourseId, setTutorCourseId] = useState<string | null>(null);
  const [quizCourseId, setQuizCourseId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  function handleCarouselScroll() {
    const el = carouselRef.current;
    if (!el || el.clientWidth === 0) return;
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  }

  const maxHeatCount = Math.max(1, ...heatmap.rows.flatMap((r) => r.cells.map((c) => c.intensity)));
  const maxGrade = Math.max(1, ...subjectPerf.map((s) => s.avgGrade));

  function openHelper(kind: "tutor" | "quiz") {
    if (courses.length === 0) return;
    if (courses.length === 1) {
      if (kind === "tutor") setTutorCourseId(courses[0].id);
      else setQuizCourseId(courses[0].id);
      return;
    }
    setCoursePickerFor(kind);
  }

  const tutorCourse = courses.find((c) => c.id === tutorCourseId) ?? null;
  const quizCourse = courses.find((c) => c.id === quizCourseId) ?? null;

  if (courses.length === 0 && flashcards.length === 0) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between px-0.5 pt-1">
          <h1 className="text-[19px] font-extrabold tracking-tight text-text">Робота</h1>
        </div>
        <div className="rounded-card border border-border bg-surface py-10 text-center text-[12px] font-semibold text-text-faint">
          Ще немає предметів
          <Link href="/work/student/library" className="mt-3 block text-[12.5px] font-extrabold text-sage">
            Додати перший предмет
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-0.5 pt-1">
        <h1 className="text-[19px] font-extrabold tracking-tight text-text">Робота</h1>
        {streak > 0 && (
          <div className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-bold text-gold">
            <FireIcon className="h-3.5 w-3.5" />
            {streak} {streak === 1 ? "день" : "днів"}
          </div>
        )}
      </div>

      <div className="mb-4 px-0.5">
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-faint">
            <SparkleIcon className="h-3.5 w-3.5" />
            Асистент
          </div>
          <Link href="/assistant" className="text-[11px] font-bold text-sage">
            Повний чат →
          </Link>
        </div>
        <p className="text-[13.5px] leading-relaxed text-text-dim">
          {insightText || (insight.isFetching ? "Думаю…" : "Почни повторювати картки — і тут з'явиться підсумок прогресу.")}
        </p>
      </div>

      <div className="mb-3.5 rounded-card p-4 text-white" style={{ background: "linear-gradient(135deg,#241f1a,#151210)" }}>
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wide text-white/60">Тиждень підсумок</span>
          <button onClick={() => shareWeeklyCard(weeklyRecap)} className="flex items-center gap-1 text-[10px] font-bold text-gold">
            <ShareIcon className="h-3 w-3" /> Поділитися
          </button>
        </div>
        <div className="flex gap-4.5">
          <div>
            <div className="font-display text-[22px] font-extrabold text-white">{Math.round(weeklyRecap.minutes / 60)} год</div>
            <div className="mt-0.5 text-[9.5px] text-white/45">навчання</div>
          </div>
          <div>
            <div className="font-display text-[22px] font-extrabold text-gold">+{weeklyRecap.xp}</div>
            <div className="mt-0.5 text-[9.5px] text-white/45">XP</div>
          </div>
          <div>
            <div className="font-display text-[22px] font-extrabold text-sage">{weeklyRecap.cards}</div>
            <div className="mt-0.5 text-[9.5px] text-white/45">карток</div>
          </div>
        </div>
      </div>

      <div className="mb-3.5 rounded-card border border-border bg-surface p-4 shadow-card">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[12px] font-bold text-text">Завдання дня</span>
          <span className="flex items-center gap-1 text-[9.5px] font-bold text-gold">+{quest.xpReward} XP</span>
        </div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[13px] font-bold text-text">Повторити {quest.goalCards} карток</span>
          <span className="font-mono text-[13px] font-bold text-gold">
            {quest.progressCards} / {quest.goalCards}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-gold"
            style={{ width: `${Math.min(100, (quest.progressCards / quest.goalCards) * 100)}%` }}
          />
        </div>
        <div className="mt-2 text-[10.5px] text-text-faint">
          {quest.done ? "Ціль на сьогодні закрита 🎉" : "Ще трохи — і сьогоднішня ціль закрита"}
        </div>
      </div>

      <div className="mb-3.5">
        <div
          ref={carouselRef}
          onScroll={handleCarouselScroll}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-card border border-border bg-surface"
        >
          <div className="w-full flex-shrink-0 snap-start p-3.5">
            <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
              Теплокарта навчальних сесій
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 pl-[40px]">
                {WEEKDAY_LABELS.map((l) => (
                  <div key={l} className="flex-1 text-center text-[9px] font-semibold text-text-faint">
                    {l}
                  </div>
                ))}
              </div>
              {heatmap.rows.map((row) => (
                <div key={row.label} className="flex items-center gap-1">
                  <div className="w-[40px] flex-shrink-0 truncate text-[9.5px] font-semibold text-text-dim">{row.label}</div>
                  {row.cells.map((cell) => (
                    <div
                      key={cell.weekday}
                      className="aspect-square flex-1 rounded-[6px]"
                      style={{ background: heatColor(cell.intensity / maxHeatCount) }}
                    />
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-text-dim">{heatmap.insight}</p>
          </div>

          <div className="w-full flex-shrink-0 snap-start p-3.5">
            <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-faint">Успішність за предметами</div>
            {subjectPerf.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-text-faint">Ще немає оцінок</div>
            ) : (
              <div className="flex h-[80px] items-end gap-2">
                {subjectPerf.map((s) => (
                  <div key={s.courseId} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <div
                      className="w-full rounded-t-[4px] bg-sage"
                      style={{ height: `${Math.max(6, (s.avgGrade / maxGrade) * 100)}%` }}
                    />
                    <span className="truncate text-[8.5px] font-semibold text-text-faint">{s.courseName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 flex justify-center gap-1.5">
          {[0, 1].map((i) => (
            <span key={i} className={cn("h-1.5 w-1.5 rounded-full", page === i ? "bg-text" : "bg-border")} />
          ))}
        </div>
      </div>

      <div className="mb-3.5 flex gap-2">
        <button
          onClick={() => setAssignmentsOpen(true)}
          className="flex flex-1 flex-col items-center gap-1.5 rounded-card-sm border border-border bg-surface py-3"
        >
          <PlusIcon className="h-[17px] w-[17px] text-text-dim" />
          <span className="text-[10.5px] font-semibold text-text-dim">Завдання</span>
        </button>
        <button
          onClick={() => setReviewOpen(true)}
          className="flex flex-1 flex-col items-center gap-1.5 rounded-card-sm border border-border bg-surface py-3"
        >
          <ClockIcon className="h-[17px] w-[17px] text-text-dim" />
          <span className="text-[10.5px] font-semibold text-text-dim">Сесія {dueCount > 0 ? `(${dueCount})` : ""}</span>
        </button>
        <Link
          href="/work/student/library"
          className="flex flex-1 flex-col items-center gap-1.5 rounded-card-sm border border-border bg-surface py-3"
        >
          <NotebookIcon className="h-[17px] w-[17px] text-text-dim" />
          <span className="text-[10.5px] font-semibold text-text-dim">Конспект</span>
        </Link>
      </div>

      <div className="mb-3.5 grid grid-cols-2 gap-2">
        <div className="rounded-card border border-border bg-surface p-3.5">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-text">
            <GraduationCapIcon className="h-3.5 w-3.5 text-text-faint" /> Середній бал
          </div>
          <div className="mt-2 font-display text-[19px] font-bold text-gold">{overallAvg !== null ? overallAvg.toFixed(1) : "—"}</div>
          <div className="mt-1 text-[10px] text-text-faint">{grades.length} оцінок</div>
        </div>
        <div className="rounded-card border border-border bg-surface p-3.5">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-text">
            <LayersIcon className="h-3.5 w-3.5 text-text-faint" /> Флеш-картки
          </div>
          <div className="mt-2 font-display text-[19px] font-bold text-sage">{activeDeck ? `${activeDeck.pct}%` : "—"}</div>
          <div className="mt-1 truncate text-[10px] text-text-faint">
            {activeDeck ? `Запам'ятано з колоди «${activeDeck.deckName}»` : "Ще немає карток"}
          </div>
        </div>
        <div className="rounded-card border border-border bg-surface p-3.5">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-text">
            <UsersIcon className="h-3.5 w-3.5 text-text-faint" /> Рейтинг друзів
          </div>
          <div className="mt-2 text-[13px] font-semibold text-text-faint">Скоро</div>
          <div className="mt-1 text-[10px] text-text-faint">Ще не запущено</div>
        </div>
        <div className="rounded-card border border-border bg-surface p-3.5">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-text">
            <CalendarDateIcon className="h-3.5 w-3.5 text-text-faint" /> Пари сьогодні
          </div>
          <div className="mt-2 font-display text-[19px] font-bold text-text">{classesToday.length}</div>
          <div className="mt-1 truncate text-[10px] text-text-faint">
            {classesToday[0] ? `Наступна о ${classesToday[0].time}` : "Немає пар"}
          </div>
        </div>
      </div>

      <div className="mb-2 mt-1 px-0.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">Досягнення</div>
      <div className="mb-3.5 flex gap-2.5 overflow-x-auto rounded-card border border-border bg-surface p-3.5">
        {achievements.map((a) => (
          <div key={a.id} className="w-[70px] flex-shrink-0 text-center">
            <div
              className={cn(
                "mx-auto mb-1.5 flex h-12 w-12 items-center justify-center rounded-card-sm",
                a.unlocked ? "bg-gold-soft text-gold" : "text-text-faint opacity-40"
              )}
              style={!a.unlocked ? { background: "var(--surface-2)" } : undefined}
            >
              <MedalIcon className="h-5 w-5" />
            </div>
            <div className={cn("text-[9px] font-bold", a.unlocked ? "text-text-dim" : "text-text-faint")}>{a.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-2 mt-1 px-0.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">Навчання з допомогою</div>
      <button
        onClick={() => openHelper("tutor")}
        disabled={courses.length === 0}
        className="mb-2 flex w-full items-center gap-3 rounded-card border border-border bg-surface p-3.5 text-left disabled:opacity-50"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface-2 text-gold">
          <SparkleIcon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-bold text-text">AI-тьютор</span>
          <span className="mt-0.5 block text-[10px] text-text-faint">Знає силабус і конспекти обраного предмета</span>
        </span>
      </button>
      <button
        onClick={() => openHelper("quiz")}
        disabled={courses.length === 0}
        className="mb-3.5 flex w-full items-center gap-3 rounded-card border border-border bg-surface p-3.5 text-left disabled:opacity-50"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface-2 text-sage">
          <NotebookIcon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-bold text-text">Тест з конспекту</span>
          <span className="mt-0.5 block text-[10px] text-text-faint">Питання для самоперевірки з власних нотаток</span>
        </span>
      </button>

      <div className="mb-2 mt-1 px-0.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">Ритм разом</div>
      <div className="mb-3.5">
        <ComingSoonCard
          title="Живі сесії з друзями — скоро"
          description="Спільне навчання в реальному часі потребує акаунтів і синхронізації між пристроями, яких ще немає в застосунку."
        />
      </div>

      <div className="mb-2 mt-1 px-0.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">Груповий проєкт</div>
      <div className="mb-3.5">
        <ComingSoonCard
          title="Дошка групового проєкту — скоро"
          description="Статус учасників у реальному часі також потребує акаунтів кількох людей — з'явиться разом із живими сесіями."
        />
      </div>

      <div className="mb-2 mt-1 px-0.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">Найближчі дедлайни</div>
      <button onClick={() => setAssignmentsOpen(true)} className="mb-4 block w-full rounded-card border border-border bg-surface px-3.5 text-left">
        {deadlines.length === 0 ? (
          <div className="py-6 text-center text-[11px] text-text-faint">Немає найближчих дедлайнів</div>
        ) : (
          deadlines.slice(0, 4).map((d) => (
            <div key={d.id} className="flex items-center gap-2.5 border-b border-border py-2.5 last:border-b-0">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-text-faint" />
              <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-text-dim">{d.title}</span>
              <span className="flex-shrink-0 text-[10px] font-semibold text-text-faint">{d.relativeLabel}</span>
            </div>
          ))
        )}
      </button>

      {reviewOpen && (
        <FlashcardReviewSheet cards={flashcards.filter((c) => c.dueDate <= formatDateKey(new Date()))} onClose={() => setReviewOpen(false)} />
      )}
      {assignmentsOpen && <AssignmentSheet onClose={() => setAssignmentsOpen(false)} />}
      {coursePickerFor && (
        <PickerSheet<string>
          title="Обери предмет"
          options={courses.map((c) => ({ id: c.id, name: c.name }))}
          value=""
          onSelect={(id) => {
            if (coursePickerFor === "tutor") setTutorCourseId(id);
            else setQuizCourseId(id);
            setCoursePickerFor(null);
          }}
          onClose={() => setCoursePickerFor(null)}
        />
      )}
      {tutorCourse && <TutorChatSheet course={tutorCourse} onClose={() => setTutorCourseId(null)} />}
      {quizCourse && <QuizGeneratorSheet course={quizCourse} onClose={() => setQuizCourseId(null)} />}
    </div>
  );
}
