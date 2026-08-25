"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { initialSm2State, reviewSm2, addDays, type ReviewQuality } from "./sm2";
import { formatDateKey } from "./calendar-utils";

export interface Course {
  id: string;
  name: string;
  /** Free text — what the AI tutor and quiz generator both read as their
   *  scope. Optional: a course can exist (for schedule/deadlines/grades)
   *  before any syllabus or notes are typed in. */
  syllabus: string;
  notes: string;
}

export interface Flashcard {
  id: string;
  courseId: string;
  deckName: string;
  front: string;
  back: string;
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
  dueDate: string; // "YYYY-MM-DD" — due today or earlier means it's up for review
  lastReviewedAt: string | null; // ISO
}

export interface StudySession {
  id: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM" — entry time, buckets into the time-of-day heatmap
  minutes: number;
  cardsReviewed: number;
  xpEarned: number;
}

export interface Assignment {
  id: string;
  courseId: string | null;
  title: string;
  dueDate: string; // "YYYY-MM-DD"
  done: boolean;
}

export interface ClassScheduleItem {
  id: string;
  courseId: string;
  weekday: number; // 0=Пн..6=Нд, matches WEEKDAY_LABELS elsewhere in the app
  time: string; // "HH:MM"
}

export interface Grade {
  id: string;
  courseId: string;
  value: number; // 0-5 scale
  date: string; // "YYYY-MM-DD"
}

export const DAILY_QUEST_GOAL_CARDS = 40;
export const DAILY_QUEST_XP = 40;
const XP_PER_CARD = 4;
const XP_PER_MINUTE = 1;

interface StudentState {
  courses: Course[];
  flashcards: Flashcard[];
  studySessions: StudySession[];
  assignments: Assignment[];
  classSchedule: ClassScheduleItem[];
  grades: Grade[];

  addCourse: (c: Omit<Course, "id">) => string;
  updateCourse: (id: string, patch: Partial<Omit<Course, "id">>) => void;
  removeCourse: (id: string) => void;

  addFlashcard: (c: Omit<Flashcard, "id" | "repetitions" | "easeFactor" | "intervalDays" | "dueDate" | "lastReviewedAt">) => void;
  updateFlashcard: (id: string, patch: Partial<Pick<Flashcard, "front" | "back" | "deckName">>) => void;
  removeFlashcard: (id: string) => void;
  /** Applies one SM-2 step and reschedules the card's due date — the only
   *  way a card's schedule ever changes, so every reviewer (the review sheet
   *  today, anything else later) goes through the same scheduling rule. */
  reviewFlashcard: (id: string, quality: ReviewQuality) => void;

  logStudySession: (s: Omit<StudySession, "id" | "xpEarned">) => void;

  addAssignment: (a: Omit<Assignment, "id" | "done">) => void;
  toggleAssignment: (id: string) => void;
  removeAssignment: (id: string) => void;

  addClassScheduleItem: (c: Omit<ClassScheduleItem, "id">) => void;
  removeClassScheduleItem: (id: string) => void;

  addGrade: (g: Omit<Grade, "id">) => void;
  removeGrade: (id: string) => void;
}

export const useStudentStore = create<StudentState>()(
  persist(
    (set) => ({
      courses: [],
      flashcards: [],
      studySessions: [],
      assignments: [],
      classSchedule: [],
      grades: [],

      addCourse: (c) => {
        const id = crypto.randomUUID();
        set((s) => ({ courses: [...s.courses, { ...c, id }] }));
        return id;
      },
      updateCourse: (id, patch) =>
        set((s) => ({ courses: s.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      removeCourse: (id) =>
        set((s) => ({
          courses: s.courses.filter((c) => c.id !== id),
          // A course's own cards/schedule/grades/assignments have nothing
          // meaningful to attach to once it's gone — orphaned rows would just
          // show up as "Обрати предмет" everywhere with no way back.
          flashcards: s.flashcards.filter((f) => f.courseId !== id),
          classSchedule: s.classSchedule.filter((c) => c.courseId !== id),
          grades: s.grades.filter((g) => g.courseId !== id),
          assignments: s.assignments.filter((a) => a.courseId !== id),
        })),

      addFlashcard: (c) =>
        set((s) => {
          const sm2 = initialSm2State();
          const card: Flashcard = {
            ...c,
            id: crypto.randomUUID(),
            repetitions: sm2.repetitions,
            easeFactor: sm2.easeFactor,
            intervalDays: sm2.intervalDays,
            dueDate: formatDateKey(new Date()), // new cards are due immediately
            lastReviewedAt: null,
          };
          return { flashcards: [...s.flashcards, card] };
        }),
      updateFlashcard: (id, patch) =>
        set((s) => ({ flashcards: s.flashcards.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
      removeFlashcard: (id) => set((s) => ({ flashcards: s.flashcards.filter((f) => f.id !== id) })),
      reviewFlashcard: (id, quality) =>
        set((s) => ({
          flashcards: s.flashcards.map((f) => {
            if (f.id !== id) return f;
            const next = reviewSm2({ repetitions: f.repetitions, easeFactor: f.easeFactor, intervalDays: f.intervalDays }, quality);
            return {
              ...f,
              ...next,
              dueDate: addDays(formatDateKey(new Date()), next.intervalDays),
              lastReviewedAt: new Date().toISOString(),
            };
          }),
        })),

      logStudySession: (session) => {
        // Fire-and-forget team XP award (see api/teams/xp/study-session) —
        // mirrors the personal XP formula below so team and personal XP
        // stay comparable. No-ops server-side if this device isn't on a team.
        fetch("/api/teams/xp/study-session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cardsReviewed: session.cardsReviewed, minutes: session.minutes }),
        }).catch(() => undefined);
        set((s) => ({
          studySessions: [
            ...s.studySessions,
            {
              ...session,
              id: crypto.randomUUID(),
              xpEarned: session.cardsReviewed * XP_PER_CARD + session.minutes * XP_PER_MINUTE,
            },
          ],
        }));
      },

      addAssignment: (a) =>
        set((s) => ({ assignments: [...s.assignments, { ...a, id: crypto.randomUUID(), done: false }] })),
      toggleAssignment: (id) =>
        set((s) => ({ assignments: s.assignments.map((a) => (a.id === id ? { ...a, done: !a.done } : a)) })),
      removeAssignment: (id) => set((s) => ({ assignments: s.assignments.filter((a) => a.id !== id) })),

      addClassScheduleItem: (c) =>
        set((s) => ({ classSchedule: [...s.classSchedule, { ...c, id: crypto.randomUUID() }] })),
      removeClassScheduleItem: (id) =>
        set((s) => ({ classSchedule: s.classSchedule.filter((c) => c.id !== id) })),

      addGrade: (g) => set((s) => ({ grades: [...s.grades, { ...g, id: crypto.randomUUID() }] })),
      removeGrade: (id) => set((s) => ({ grades: s.grades.filter((g) => g.id !== id) })),
    }),
    { name: "life-os-student-v1" }
  )
);
