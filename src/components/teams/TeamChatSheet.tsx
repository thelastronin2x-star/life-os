"use client";

import { useState } from "react";
import type { TeamMessageView } from "@/lib/teams/types";
import { formatRelativeTime } from "@/lib/news-view";

export function TeamChatSheet({
  messages,
  myDeviceId,
  onSend,
  onClose,
}: {
  messages: TeamMessageView[];
  myDeviceId: string;
  onSend: (text: string) => Promise<{ ok: boolean }>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const result = await onSend(trimmed);
    setSending(false);
    if (result.ok) setText("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="flex h-[80vh] w-full max-w-md flex-col rounded-t-card bg-bg shadow-card md:rounded-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="text-[14px] font-bold text-text">Час команди</div>
          <button onClick={onClose} className="text-[13px] font-bold text-text-dim">
            Закрити
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="py-10 text-center text-[11.5px] text-text-faint">Поки що тут тихо — напиши перше повідомлення</div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="mb-3 last:mb-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[11.5px] font-bold text-text">{m.deviceId === myDeviceId ? "Ти" : m.displayName}</span>
                  <span className="text-[9.5px] text-text-faint">{formatRelativeTime(m.createdAt)}</span>
                </div>
                <div className="mt-0.5 text-[12.5px] leading-relaxed text-text-dim">{m.text}</div>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2 border-t border-border p-3.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Написати команді…"
            className="flex-1 rounded-input border border-border bg-surface px-3 py-2.5 text-[13px] text-text outline-none"
          />
          <button onClick={handleSend} disabled={sending || !text.trim()} className="rounded-btn bg-text px-4 py-2.5 text-[12px] font-bold text-bg disabled:opacity-50">
            Надіслати
          </button>
        </div>
      </div>
    </div>
  );
}
