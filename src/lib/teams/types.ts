export type TeamProfile = "trader" | "student" | "it";

export interface TeamMemberView {
  deviceId: string;
  displayName: string;
  role: "admin" | "member";
  xpAllTime: number;
  xpWeek: number;
  joinedAt: string;
}

export interface TeamMessageView {
  id: number;
  deviceId: string;
  displayName: string;
  text: string;
  createdAt: string;
}

export interface TeamActivityView {
  id: number;
  deviceId: string;
  displayName: string;
  text: string;
  createdAt: string;
}

export type TeamProjectKind = "note" | "session" | "parts_project" | "shared_deck";

export type PartStatus = "todo" | "in_progress" | "done";

export interface TeamProjectPart {
  id: string;
  name: string;
  assigneeDeviceId: string | null;
  assigneeName: string | null;
  status: PartStatus;
}

export interface SessionProjectData {
  weekday: number; // 1=Mon..7=Sun
  time: string; // "HH:MM"
}

export interface PartsProjectData {
  parts: TeamProjectPart[];
}

export interface TeamProjectEntryView {
  id: number;
  deviceId: string;
  displayName: string;
  text: string;
  createdAt: string;
}

export interface TeamDeckCardView {
  id: string;
  front: string;
  back: string;
  addedByName: string;
  createdAt: string;
  due: boolean;
}

export interface TeamProjectView {
  id: string;
  kind: TeamProjectKind;
  name: string;
  status: string | null;
  data: Record<string, unknown>;
  createdAt: string;
  entries?: TeamProjectEntryView[];
  cards?: TeamDeckCardView[];
}

export interface TeamRivalView {
  id: string;
  name: string;
  xpWeek: number;
}

export interface TeamStateView {
  team: { id: string; name: string; profile: TeamProfile; createdAt: string };
  me: { deviceId: string; displayName: string; role: "admin" | "member" };
  members: TeamMemberView[];
  xpAllTimeTotal: number;
  myXpWeek: number;
  messages: TeamMessageView[];
  activity: TeamActivityView[];
  projects: TeamProjectView[];
  rival: TeamRivalView | null;
}
