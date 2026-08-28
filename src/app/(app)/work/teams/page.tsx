"use client";

import { WorkSubpageHeader } from "@/components/work/WorkSubpageHeader";
import { useAppStore } from "@/lib/store";
import { useTeamState } from "@/lib/use-team";
import { TeamOnboarding } from "@/components/teams/TeamOnboarding";
import { TeamHub } from "@/components/teams/TeamHub";

export default function TeamsPage() {
  const profile = useAppStore((s) => s.profile);
  const {
    state,
    loading,
    error,
    createTeam,
    joinTeam,
    leaveTeam,
    sendMessage,
    createProject,
    updateProject,
    addProjectEntry,
    addDeckCard,
    reviewDeckCard,
    setRival,
  } = useTeamState();

  return (
    <div>
      <WorkSubpageHeader title="Команда" subtitle="Спілкування, спільна робота та невеликі змагання з друзями" />

      {loading ? (
        <div className="card-raised rounded-card bg-surface py-10 text-center text-[12px] text-text-faint">Завантажую…</div>
      ) : error ? (
        <div className="card-raised rounded-card bg-surface py-10 text-center text-[12px] text-text-faint">
          Не вдалося завантажити команду. Спробуй пізніше.
        </div>
      ) : !state ? (
        <TeamOnboarding profile={profile === "it" ? "it" : profile} createTeam={createTeam} joinTeam={joinTeam} />
      ) : (
        <TeamHub
          state={state}
          sendMessage={sendMessage}
          createProject={createProject}
          updateProject={updateProject}
          addProjectEntry={addProjectEntry}
          addDeckCard={addDeckCard}
          reviewDeckCard={reviewDeckCard}
          setRival={setRival}
          leaveTeam={leaveTeam}
        />
      )}
    </div>
  );
}
