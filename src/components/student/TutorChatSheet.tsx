"use client";

import { useEffect, useRef, useState } from "react";
import type { Course } from "@/lib/student-store";
import { callAssistantTurn } from "@/lib/assistant-client";
import { cn } from "@/lib/cn";

interface TutorMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function buildTutorContext(course: Course): string {
  return [
    `Ти — AI-тьютор з предмета "${course.name}". Відповідай ТІЛЬКИ в межах цього предмета — не переключайся на інші теми.`,
    course.syllabus.trim() ? `Силабус курсу: ${course.syllabus.trim()}` : "Силабус ще не заповнено.",
    course.notes.trim() ? `Конспекти студента: ${course.notes.trim()}` : "Конспектів ще немає.",
  ].join("\n\n");
}

/** A chat scoped to one course — separate from the general assistant
 *  (/assistant) both in UI (own sheet, own message list, nothing persisted
 *  to assistant-store) and in system prompt (buildTutorContext is injected
 *  as `context` on every turn, so the model only ever answers from this
 *  course's own syllabus/notes). No tool loop: this is plain Q&A, so
 *  callAssistantTurn is called with `scope` left undefined (tools only
 *  attach when `scope` is one of the recognized tool scopes). */
export function TutorChatSheet({ course, onClose }: { course: Course; onClose: () => void }) {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    const userMsg: TutorMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setIsStreaming(true);
    try {
      const res = await callAssistantTurn(
        history.map((m) => ({ role: m.role, content: m.content })),
        buildTutorContext(course),
        "chat"
      );
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: res.text || "Не вдалося відповісти. Спробуй ще раз." },
      ]);
    } catch {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "Сталася помилка. Спробуй ще раз." }]);
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="flex h-[80vh] w-full max-w-md flex-col rounded-t-card bg-bg shadow-card p-4 md:rounded-card">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[14px] font-bold text-text">AI-тьютор</div>
            <div className="text-[11px] text-text-faint">{course.name}</div>
          </div>
          <button onClick={onClose} className="text-[13px] font-bold text-text-dim">
            Закрити
          </button>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto">
          {messages.length === 0 && (
            <div className="mt-6 text-center text-[12px] text-text-faint">
              Постав питання про {course.name} — тьютор бачить силабус і конспекти цього предмета.
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-[20px] px-3.5 py-2.5 text-[13px] font-medium leading-relaxed",
                  m.role === "user" ? "rounded-br-[7px] bg-text text-bg" : "rounded-bl-[7px] bg-surface text-text"
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {isStreaming && (
            <div className="flex justify-start">
              <div className="rounded-[20px] rounded-bl-[7px] bg-surface px-3.5 py-2.5 text-[13px] text-text-faint">…</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="mt-3 flex items-end gap-2 rounded-btn bg-surface shadow-card py-1.5 pl-4 pr-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder="Напиши питання..."
            className="max-h-24 flex-1 resize-none bg-transparent py-1.5 text-[13px] text-text outline-none placeholder:text-text-faint"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-btn bg-sage text-[14px] text-bg disabled:opacity-40"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
