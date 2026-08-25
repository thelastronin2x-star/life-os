import "server-only";
import { randomUUID } from "crypto";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  teams,
  teamMembers,
  teamMessages,
  teamActivity,
  teamXpEvents,
  teamProjects,
  teamProjectEntries,
  teamDeckCards,
  teamDeckReviews,
} from "@/lib/db/schema";
import { generateTeamCode, normalizeTeamCode } from "./code";
import { startOfWeekUtc } from "./week";
import { TEAM_XP } from "./xp";
import { kyivTodayDateKey } from "@/lib/kyiv-time";
import { initialSm2State, reviewSm2, addDays, type ReviewQuality } from "@/lib/sm2";
import type {
  TeamProfile,
  TeamStateView,
  TeamMessageView,
  TeamProjectView,
  TeamProjectEntryView,
  TeamDeckCardView,
} from "./types";

export type JoinResult = { ok: true; teamId: string } | { ok: false; error: "not_found" | "already_in_team" };
export type RivalResult = { ok: true } | { ok: false; error: "not_found" | "same_team" };

async function xpTotalsForTeam(teamId: string, weekStart: Date) {
  const allTimeRows = await db
    .select({ deviceId: teamXpEvents.deviceId, total: sql<number>`sum(${teamXpEvents.amount})::int` })
    .from(teamXpEvents)
    .where(eq(teamXpEvents.teamId, teamId))
    .groupBy(teamXpEvents.deviceId);
  const weekRows = await db
    .select({ deviceId: teamXpEvents.deviceId, total: sql<number>`sum(${teamXpEvents.amount})::int` })
    .from(teamXpEvents)
    .where(and(eq(teamXpEvents.teamId, teamId), gte(teamXpEvents.createdAt, weekStart)))
    .groupBy(teamXpEvents.deviceId);
  return {
    allTime: new Map(allTimeRows.map((r) => [r.deviceId, r.total])),
    week: new Map(weekRows.map((r) => [r.deviceId, r.total])),
  };
}

/** Writes an XP event and a matching activity-feed entry together — every
 *  XP-earning action is exactly one call to this, so the two logs can never
 *  drift apart. `reason` doubles as both the xp_events.reason value and the
 *  human-readable activity text (e.g. "закрив угоду", "провів навчальну
 *  сесію (12 карток)"). */
async function awardXp(teamId: string, deviceId: string, displayName: string, amount: number, reason: string): Promise<void> {
  if (amount <= 0) return;
  await db.insert(teamXpEvents).values({ teamId, deviceId, amount, reason });
  await db.insert(teamActivity).values({ teamId, deviceId, displayName, text: reason });
}

async function myMembership(deviceId: string) {
  const rows = await db.select().from(teamMembers).where(eq(teamMembers.deviceId, deviceId)).limit(1);
  return rows[0] ?? null;
}

export async function getMyTeamId(deviceId: string): Promise<string | null> {
  const membership = await myMembership(deviceId);
  return membership?.teamId ?? null;
}

export async function createTeam(params: {
  name: string;
  profile: TeamProfile;
  deviceId: string;
  displayName: string;
}): Promise<string> {
  const existing = await myMembership(params.deviceId);
  if (existing) throw new Error("already_in_team");

  let teamId: string | null = null;
  for (let attempt = 0; attempt < 5 && !teamId; attempt++) {
    const code = generateTeamCode();
    const rows = await db
      .insert(teams)
      .values({ id: code, name: params.name.trim().slice(0, 60), profile: params.profile })
      .onConflictDoNothing({ target: teams.id })
      .returning({ id: teams.id });
    if (rows.length > 0) teamId = rows[0].id;
  }
  if (!teamId) throw new Error("team_code_generation_failed");

  await db.insert(teamMembers).values({
    teamId,
    deviceId: params.deviceId,
    displayName: params.displayName.trim().slice(0, 40),
    role: "admin",
  });
  await db.insert(teamActivity).values({ teamId, deviceId: params.deviceId, displayName: params.displayName, text: "створив(-ла) команду" });
  return teamId;
}

export async function joinTeam(params: { code: string; deviceId: string; displayName: string }): Promise<JoinResult> {
  const existing = await myMembership(params.deviceId);
  if (existing) return { ok: false, error: "already_in_team" };

  const code = normalizeTeamCode(params.code);
  const teamRows = await db.select().from(teams).where(eq(teams.id, code)).limit(1);
  if (teamRows.length === 0) return { ok: false, error: "not_found" };

  const teamId = teamRows[0].id;
  const displayName = params.displayName.trim().slice(0, 40);
  await db.insert(teamMembers).values({ teamId, deviceId: params.deviceId, displayName, role: "member" });
  await db.insert(teamActivity).values({ teamId, deviceId: params.deviceId, displayName, text: "приєднався(-лась) до команди" });
  return { ok: true, teamId };
}

export async function leaveTeam(deviceId: string): Promise<void> {
  await db.delete(teamMembers).where(eq(teamMembers.deviceId, deviceId));
}

export async function setRival(deviceId: string, opponentCode: string): Promise<RivalResult> {
  const membership = await myMembership(deviceId);
  if (!membership) return { ok: false, error: "not_found" };

  const code = normalizeTeamCode(opponentCode);
  if (code === membership.teamId) return { ok: false, error: "same_team" };

  const opponentRows = await db.select().from(teams).where(eq(teams.id, code)).limit(1);
  if (opponentRows.length === 0) return { ok: false, error: "not_found" };

  await db.update(teams).set({ rivalTeamId: code }).where(eq(teams.id, membership.teamId));
  return { ok: true };
}

export async function postMessage(deviceId: string, text: string): Promise<TeamMessageView | null> {
  const membership = await myMembership(deviceId);
  if (!membership) return null;
  const trimmed = text.trim().slice(0, 1000);
  if (!trimmed) return null;

  const [row] = await db
    .insert(teamMessages)
    .values({ teamId: membership.teamId, deviceId, displayName: membership.displayName, text: trimmed })
    .returning();
  return { id: row.id, deviceId: row.deviceId, displayName: row.displayName, text: row.text, createdAt: row.createdAt.toISOString() };
}

export async function awardTradeClosedXp(deviceId: string): Promise<void> {
  const membership = await myMembership(deviceId);
  if (!membership) return;
  await awardXp(membership.teamId, deviceId, membership.displayName, TEAM_XP.tradeClosed, "закрив(-ла) угоду");
}

export async function awardStudySessionXp(deviceId: string, cardsReviewed: number, minutes: number): Promise<void> {
  const membership = await myMembership(deviceId);
  if (!membership) return;
  const amount = cardsReviewed * TEAM_XP.studySessionPerCard + minutes * TEAM_XP.studySessionPerMinute;
  await awardXp(membership.teamId, deviceId, membership.displayName, amount, `провів(-ла) навчальну сесію (${cardsReviewed} карток)`);
}

const PROJECT_DEFAULTS: Record<string, Record<string, unknown>> = {
  note: {},
  session: { weekday: 1, time: "19:00" },
  parts_project: { parts: [] },
  shared_deck: {},
};

export async function createProject(
  deviceId: string,
  params: { kind: "note" | "session" | "parts_project" | "shared_deck"; name: string; status?: string }
): Promise<TeamProjectView | null> {
  const membership = await myMembership(deviceId);
  if (!membership) return null;

  const id = randomUUID();
  const [row] = await db
    .insert(teamProjects)
    .values({
      id,
      teamId: membership.teamId,
      kind: params.kind,
      name: params.name.trim().slice(0, 80),
      status: params.status?.slice(0, 120) ?? null,
      data: PROJECT_DEFAULTS[params.kind] ?? {},
    })
    .returning();

  await db.insert(teamActivity).values({
    teamId: membership.teamId,
    deviceId,
    displayName: membership.displayName,
    text: `додав(-ла) проєкт «${row.name}»`,
  });

  return { id: row.id, kind: row.kind as TeamProjectView["kind"], name: row.name, status: row.status, data: row.data, createdAt: row.createdAt.toISOString() };
}

function newlyDonePartNames(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const beforeParts = Array.isArray(before.parts) ? (before.parts as { id?: string; name?: string; status?: string }[]) : [];
  const afterParts = Array.isArray(after.parts) ? (after.parts as { id?: string; name?: string; status?: string }[]) : [];
  const beforeStatusById = new Map(beforeParts.map((p) => [p.id, p.status]));
  return afterParts
    .filter((p) => p.status === "done" && beforeStatusById.get(p.id) !== "done")
    .map((p) => p.name ?? "частину")
    .filter((name): name is string => Boolean(name));
}

export async function updateProject(
  deviceId: string,
  projectId: string,
  patch: { status?: string | null; data?: Record<string, unknown> }
): Promise<boolean> {
  const membership = await myMembership(deviceId);
  if (!membership) return false;

  const [project] = await db.select().from(teamProjects).where(eq(teamProjects.id, projectId)).limit(1);
  if (!project || project.teamId !== membership.teamId) return false;

  const set: Record<string, unknown> = {};
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.data !== undefined) set.data = patch.data;
  if (Object.keys(set).length === 0) return true;

  await db.update(teamProjects).set(set).where(eq(teamProjects.id, projectId));

  // parts_project's completed-part XP award happens here, not on a dedicated
  // endpoint — the client always PATCHes the whole `parts` array (same
  // full-snapshot-replace convention as elsewhere in this app), so diffing
  // old vs. new here is the one place that can tell a status genuinely
  // changed rather than being re-sent unchanged.
  if (project.kind === "parts_project" && patch.data) {
    const doneNames = newlyDonePartNames(project.data, patch.data);
    for (const name of doneNames) {
      await awardXp(membership.teamId, deviceId, membership.displayName, TEAM_XP.projectPartDone, `завершив(-ла) частину «${name}»`);
    }
  }

  return true;
}

export async function addProjectEntry(deviceId: string, projectId: string, text: string): Promise<TeamProjectEntryView | null> {
  const membership = await myMembership(deviceId);
  if (!membership) return null;
  const [project] = await db.select().from(teamProjects).where(eq(teamProjects.id, projectId)).limit(1);
  if (!project || project.teamId !== membership.teamId) return null;

  const trimmed = text.trim().slice(0, 2000);
  if (!trimmed) return null;

  const [row] = await db
    .insert(teamProjectEntries)
    .values({ projectId, deviceId, displayName: membership.displayName, text: trimmed })
    .returning();
  return { id: row.id, deviceId: row.deviceId, displayName: row.displayName, text: row.text, createdAt: row.createdAt.toISOString() };
}

export async function addDeckCard(deviceId: string, projectId: string, front: string, back: string): Promise<TeamDeckCardView | null> {
  const membership = await myMembership(deviceId);
  if (!membership) return null;
  const [project] = await db.select().from(teamProjects).where(eq(teamProjects.id, projectId)).limit(1);
  if (!project || project.teamId !== membership.teamId || project.kind !== "shared_deck") return null;

  const trimmedFront = front.trim().slice(0, 300);
  const trimmedBack = back.trim().slice(0, 1000);
  if (!trimmedFront || !trimmedBack) return null;

  const [row] = await db
    .insert(teamDeckCards)
    .values({ id: randomUUID(), projectId, front: trimmedFront, back: trimmedBack, addedByDeviceId: deviceId, addedByName: membership.displayName })
    .returning();

  await db.insert(teamActivity).values({
    teamId: membership.teamId,
    deviceId,
    displayName: membership.displayName,
    text: "додав(-ла) картку до спільної колоди",
  });

  return { id: row.id, front: row.front, back: row.back, addedByName: row.addedByName, createdAt: row.createdAt.toISOString(), due: true };
}

export async function reviewDeckCard(deviceId: string, cardId: string, quality: ReviewQuality): Promise<boolean> {
  const membership = await myMembership(deviceId);
  if (!membership) return false;

  const [card] = await db.select().from(teamDeckCards).where(eq(teamDeckCards.id, cardId)).limit(1);
  if (!card) return false;
  const [project] = await db.select().from(teamProjects).where(eq(teamProjects.id, card.projectId)).limit(1);
  if (!project || project.teamId !== membership.teamId) return false;

  const [existing] = await db
    .select()
    .from(teamDeckReviews)
    .where(and(eq(teamDeckReviews.cardId, cardId), eq(teamDeckReviews.deviceId, deviceId)))
    .limit(1);

  const prevState = existing
    ? { repetitions: existing.repetitions, easeFactor: existing.easeFactor, intervalDays: existing.intervalDays }
    : initialSm2State();
  const nextState = reviewSm2(prevState, quality);
  const dueDate = addDays(kyivTodayDateKey(), nextState.intervalDays);

  await db
    .insert(teamDeckReviews)
    .values({
      cardId,
      deviceId,
      repetitions: nextState.repetitions,
      easeFactor: nextState.easeFactor,
      intervalDays: nextState.intervalDays,
      dueDate,
    })
    .onConflictDoUpdate({
      target: [teamDeckReviews.cardId, teamDeckReviews.deviceId],
      set: { repetitions: nextState.repetitions, easeFactor: nextState.easeFactor, intervalDays: nextState.intervalDays, dueDate, updatedAt: new Date() },
    });

  await awardXp(membership.teamId, deviceId, membership.displayName, TEAM_XP.sharedDeckReview, "повторив(-ла) картку зі спільної колоди");
  return true;
}

export async function getTeamState(deviceId: string): Promise<TeamStateView | null> {
  const membership = await myMembership(deviceId);
  if (!membership) return null;

  const [team] = await db.select().from(teams).where(eq(teams.id, membership.teamId)).limit(1);
  if (!team) return null;

  const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, team.id));
  const weekStart = startOfWeekUtc();
  const xp = await xpTotalsForTeam(team.id, weekStart);
  const xpAllTimeTotal = Array.from(xp.allTime.values()).reduce((sum, v) => sum + v, 0);

  const messageRows = await db
    .select()
    .from(teamMessages)
    .where(eq(teamMessages.teamId, team.id))
    .orderBy(desc(teamMessages.createdAt))
    .limit(50);

  const activityRows = await db
    .select()
    .from(teamActivity)
    .where(eq(teamActivity.teamId, team.id))
    .orderBy(desc(teamActivity.createdAt))
    .limit(30);

  const projectRows = await db.select().from(teamProjects).where(eq(teamProjects.teamId, team.id)).orderBy(desc(teamProjects.createdAt));

  const noteProjectIds = projectRows.filter((p) => p.kind === "note").map((p) => p.id);
  const entriesByProject = new Map<string, TeamProjectEntryView[]>();
  if (noteProjectIds.length > 0) {
    const entryRows = await db
      .select()
      .from(teamProjectEntries)
      .where(inArray(teamProjectEntries.projectId, noteProjectIds))
      .orderBy(teamProjectEntries.createdAt);
    for (const row of entryRows) {
      const list = entriesByProject.get(row.projectId) ?? [];
      list.push({ id: row.id, deviceId: row.deviceId, displayName: row.displayName, text: row.text, createdAt: row.createdAt.toISOString() });
      entriesByProject.set(row.projectId, list);
    }
  }

  const deckProjectIds = projectRows.filter((p) => p.kind === "shared_deck").map((p) => p.id);
  const cardsByProject = new Map<string, TeamDeckCardView[]>();
  if (deckProjectIds.length > 0) {
    const cardRows = await db.select().from(teamDeckCards).where(inArray(teamDeckCards.projectId, deckProjectIds));
    const cardIds = cardRows.map((c) => c.id);
    const reviewRows =
      cardIds.length > 0
        ? await db
            .select()
            .from(teamDeckReviews)
            .where(and(inArray(teamDeckReviews.cardId, cardIds), eq(teamDeckReviews.deviceId, deviceId)))
        : [];
    const dueDateByCard = new Map(reviewRows.map((r) => [r.cardId, r.dueDate]));
    const todayKey = kyivTodayDateKey();
    for (const row of cardRows) {
      const list = cardsByProject.get(row.projectId) ?? [];
      const dueDate = dueDateByCard.get(row.id);
      list.push({
        id: row.id,
        front: row.front,
        back: row.back,
        addedByName: row.addedByName,
        createdAt: row.createdAt.toISOString(),
        due: !dueDate || dueDate <= todayKey,
      });
      cardsByProject.set(row.projectId, list);
    }
  }

  let rival: TeamStateView["rival"] = null;
  if (team.rivalTeamId) {
    const [rivalTeam] = await db.select().from(teams).where(eq(teams.id, team.rivalTeamId)).limit(1);
    if (rivalTeam) {
      const rivalXp = await xpTotalsForTeam(rivalTeam.id, weekStart);
      const rivalWeekTotal = Array.from(rivalXp.week.values()).reduce((sum, v) => sum + v, 0);
      rival = { id: rivalTeam.id, name: rivalTeam.name, xpWeek: rivalWeekTotal };
    }
  }

  return {
    team: { id: team.id, name: team.name, profile: team.profile as TeamProfile, createdAt: team.createdAt.toISOString() },
    me: { deviceId, displayName: membership.displayName, role: membership.role as "admin" | "member" },
    members: members
      .map((m) => ({
        deviceId: m.deviceId,
        displayName: m.displayName,
        role: m.role as "admin" | "member",
        xpAllTime: xp.allTime.get(m.deviceId) ?? 0,
        xpWeek: xp.week.get(m.deviceId) ?? 0,
        joinedAt: m.joinedAt.toISOString(),
      }))
      .sort((a, b) => b.xpWeek - a.xpWeek),
    xpAllTimeTotal,
    myXpWeek: xp.week.get(deviceId) ?? 0,
    messages: messageRows
      .slice()
      .reverse()
      .map((r) => ({ id: r.id, deviceId: r.deviceId, displayName: r.displayName, text: r.text, createdAt: r.createdAt.toISOString() })),
    activity: activityRows.map((r) => ({ id: r.id, deviceId: r.deviceId, displayName: r.displayName, text: r.text, createdAt: r.createdAt.toISOString() })),
    projects: projectRows.map((p) => ({
      id: p.id,
      kind: p.kind as TeamProjectView["kind"],
      name: p.name,
      status: p.status,
      data: p.data,
      createdAt: p.createdAt.toISOString(),
      entries: p.kind === "note" ? (entriesByProject.get(p.id) ?? []) : undefined,
      cards: p.kind === "shared_deck" ? (cardsByProject.get(p.id) ?? []) : undefined,
    })),
    rival,
  };
}
