"use client";

import { useStudentStore } from "./student-store";
import { useGenericSourceSync, type SourceInsightState } from "./use-generic-source-sync";
import { buildStudentContext, computeStudentSignature } from "./assistant-context-student";

const STUDENT_DEBOUNCE_MS = 15 * 1000; // matches useWorkInsightSync's cadence — a review session is a deliberate act, not a burst

export function useStudentInsightSync(): SourceInsightState {
  const sessions = useStudentStore((s) => s.studySessions);
  const signature = computeStudentSignature(sessions);
  return useGenericSourceSync("student", signature, buildStudentContext, STUDENT_DEBOUNCE_MS, 0, "student");
}
