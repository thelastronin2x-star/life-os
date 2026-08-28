"use client";

import { useState } from "react";
import type { TeamStateView, TeamProjectKind } from "@/lib/teams/types";
import type { ReviewQuality } from "@/lib/sm2";
import { teamCopyFor } from "@/lib/teams/copy";
import { teamAvatarInitials } from "@/lib/teams/code";
import { formatRelativeTime } from "@/lib/news-view";
import { cn } from "@/lib/cn";
import { TeamChatSheet } from "./TeamChatSheet";
import { CreateProjectSheet } from "./CreateProjectSheet";
import { TeamProjectSheet } from "./TeamProjectSheet";
import { TeamRivalSheet } from "./TeamRivalSheet";
import { ChatBubbleIcon, PlusIcon, UsersIcon } from "@/components/icons";

interface Props {
  state: TeamStateView;
  sendMessage: (text: string) => Promise<{ ok: boolean }>;
  createProject: (kind: TeamProjectKind, name: string, status?: string) => Promise<{ ok: boolean }>;
  updateProject: (projectId: string, patch: { status?: string | null; data?: Record<string, unknown> }) => Promise<{ ok: boolean }>;
  addProjectEntry: (projectId: string, text: string) => Promise<{ ok: boolean }>;
  addDeckCard: (projectId: string, front: string, back: string) => Promise<{ ok: boolean }>;
  reviewDeckCard: (projectId: string, cardId: string, quality: ReviewQuality) => Promise<{ ok: boolean }>;
  setRival: (code: string) => Promise<{ ok: boolean; error?: string }>;
  leaveTeam: () => Promise<{ ok: boolean }>;
}

async function shareInviteCode(code: string, teamName: string) {
  const text = `Приєднуйся до нашої команди «${teamName}» в 0.0 / Life OS! Код: ${code}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Запрошення в команду", text });
      return;
    } catch {
      // cancelled — fall through to clipboard
    }
  }
  await navigator.clipboard?.writeText(text).catch(() => undefined);
}

export function TeamHub({ state, sendMessage, createProject, updateProject, addProjectEntry, addDeckCard, reviewDeckCard, setRival, leaveTeam }: Props) {
  const copy = teamCopyFor(state.team.profile);
  const [chatOpen, setChatOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [rivalOpen, setRivalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const lastMessage = state.messages[state.messages.length - 1];
  const openProject = state.projects.find((p) => p.id === openProjectId) ?? null;

  async function handleInvite() {
    await shareInviteCode(state.team.id, state.team.name);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div className="card-raised mb-3.5 rounded-card bg-gradient-to-br from-surface-2 to-surface p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="well-pressed flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface text-[15px] font-extrabold text-gold">
            {teamAvatarInitials(state.team.name)}
          </span>
          <div>
            <div className="text-[14.5px] font-extrabold text-text">{state.team.name}</div>
            <div className="mt-0.5 text-[10.5px] font-semibold text-text-faint">
              {state.members.length} {copy.memberWord}
            </div>
          </div>
        </div>
        <div className="flex gap-5 border-t border-border pt-3.5">
          <div>
            <div className="text-[9.5px] font-bold uppercase text-text-faint">Разом XP</div>
            <div className="mt-1 font-mono text-[15px] font-bold text-gold">{state.xpAllTimeTotal}</div>
          </div>
          <div>
            <div className="text-[9.5px] font-bold uppercase text-text-faint">Твій XP за тиждень</div>
            <div className="mt-1 font-mono text-[15px] font-bold text-text">{state.myXpWeek}</div>
          </div>
        </div>
      </div>

      <div className="mb-2 mt-1 px-0.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">Час команди</div>
      <button onClick={() => setChatOpen(true)} className="card-raised mb-3.5 flex w-full items-start gap-2.5 rounded-card bg-surface p-3.5 text-left">
        <span className="well-pressed flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface-2 text-text-dim">
          <ChatBubbleIcon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          {lastMessage ? (
            <>
              <span className="block text-[11.5px] leading-relaxed text-text-dim">
                <b className="font-bold text-text">{lastMessage.displayName}:</b> {lastMessage.text}
              </span>
              <span className="mt-1 block text-[9.5px] text-text-faint">{formatRelativeTime(lastMessage.createdAt)}</span>
            </>
          ) : (
            <span className="text-[11.5px] text-text-faint">Ще нема повідомлень — напиши перше</span>
          )}
        </span>
      </button>

      <div className="mb-2 mt-1 flex items-center justify-between px-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Спільні проєкти</span>
        <button onClick={() => setCreateProjectOpen(true)} className="flex items-center gap-1 text-[11px] font-semibold text-sage">
          <PlusIcon className="h-3 w-3" /> Додати
        </button>
      </div>
      {state.projects.length === 0 ? (
        <div className="card-raised mb-3.5 rounded-card bg-surface py-6 text-center text-[11.5px] text-text-faint">Ще немає спільних проєктів</div>
      ) : (
        <div className="card-raised mb-3.5 rounded-card bg-surface p-1.5">
          {state.projects.map((project) => (
            <button key={project.id} onClick={() => setOpenProjectId(project.id)} className="flex w-full items-center gap-3 rounded-card-sm p-2.5 text-left">
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-bold text-text">{project.name}</div>
                <div className="mt-0.5 text-[10.5px] text-text-faint">{project.status ?? "—"}</div>
              </div>
              <span className="flex-shrink-0 text-[13px] text-text-faint">›</span>
            </button>
          ))}
        </div>
      )}

      <div className="mb-2 mt-1 flex items-baseline justify-between px-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">{copy.ratingTitle}</span>
        <span className="text-[10.5px] font-semibold text-text-faint">за тиждень</span>
      </div>
      <div className="card-raised mb-3.5 rounded-card bg-surface p-1.5">
        {state.members.map((member, i) => (
          <div key={member.deviceId} className={cn("flex items-center gap-2.5 rounded-card-sm p-2.5", member.deviceId === state.me.deviceId && "bg-surface-2")}>
            <span className={cn("w-5 flex-shrink-0 text-center font-mono text-[12px]", i === 0 ? "text-gold" : "text-text-faint")}>{i + 1}</span>
            <span className="h-8 w-8 flex-shrink-0 rounded-full bg-surface-2" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-bold text-text">{member.deviceId === state.me.deviceId ? "Ти" : member.displayName}</div>
              <div className="mt-0.5 text-[9.5px] text-text-faint">{member.xpAllTime} XP усього</div>
            </div>
            <span className="flex-shrink-0 font-mono text-[12.5px] font-bold text-gold">{member.xpWeek} XP</span>
          </div>
        ))}
      </div>

      <div className="mb-2 mt-1 px-0.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">Стрічка команди</div>
      <div className="card-raised mb-3.5 rounded-card bg-surface px-3.5">
        {state.activity.length === 0 ? (
          <div className="py-6 text-center text-[11.5px] text-text-faint">Ще нічого не відбувалось</div>
        ) : (
          state.activity.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2.5 border-b border-border py-2.5 last:border-b-0">
              <span className="h-7 w-7 flex-shrink-0 rounded-full bg-surface-2" />
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] leading-relaxed text-text-dim">
                  <b className="font-bold text-text">{entry.deviceId === state.me.deviceId ? "Ти" : entry.displayName}</b> {entry.text}
                </div>
                <div className="mt-0.5 text-[9.5px] text-text-faint">{formatRelativeTime(entry.createdAt)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mb-2 mt-1 px-0.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">Товариський виклик</div>
      <button onClick={() => setRivalOpen(true)} className="card-raised mb-3.5 block w-full rounded-card bg-surface p-4">
        {state.rival ? (
          <>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex-1 text-center">
                <div className="text-[11.5px] font-bold text-text">{state.team.name}</div>
                <div className="mt-1 font-mono text-[16px] font-bold text-sage">{state.members.reduce((sum, m) => sum + m.xpWeek, 0)}</div>
              </div>
              <div className="flex-shrink-0 px-3 text-[10px] font-extrabold text-text-faint">VS</div>
              <div className="flex-1 text-center">
                <div className="text-[11.5px] font-bold text-text">{state.rival.name}</div>
                <div className="mt-1 font-mono text-[16px] font-bold text-text-dim">{state.rival.xpWeek}</div>
              </div>
            </div>
            <div className="text-center text-[10.5px] font-semibold text-text-faint">XP за тиждень · просто для драйву</div>
          </>
        ) : (
          <div className="py-2 text-center text-[11.5px] font-semibold text-sage">Розпочати товариський виклик з іншою командою →</div>
        )}
      </button>

      <button onClick={handleInvite} className="mb-2.5 flex w-full items-center justify-center gap-2 rounded-btn bg-text py-3.5 text-[12.5px] font-extrabold text-bg">
        <UsersIcon className="h-4 w-4" />
        {copied ? "Скопійовано!" : copy.inviteButtonLabel}
      </button>
      <button onClick={() => leaveTeam()} className="mb-4 w-full text-center text-[11.5px] font-semibold text-text-faint">
        Покинути команду
      </button>

      {chatOpen && <TeamChatSheet messages={state.messages} myDeviceId={state.me.deviceId} onSend={sendMessage} onClose={() => setChatOpen(false)} />}
      {createProjectOpen && (
        <CreateProjectSheet onCreate={createProject} onClose={() => setCreateProjectOpen(false)} />
      )}
      {openProject && (
        <TeamProjectSheet
          project={openProject}
          myDeviceId={state.me.deviceId}
          myDisplayName={state.me.displayName}
          onAddEntry={(text) => addProjectEntry(openProject.id, text)}
          onUpdateData={(data) => updateProject(openProject.id, { data })}
          onAddCard={(front, back) => addDeckCard(openProject.id, front, back)}
          onReviewCard={(cardId, quality) => reviewDeckCard(openProject.id, cardId, quality)}
          onClose={() => setOpenProjectId(null)}
        />
      )}
      {rivalOpen && <TeamRivalSheet onSetRival={setRival} onClose={() => setRivalOpen(false)} />}
    </div>
  );
}
