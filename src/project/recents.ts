import type { RecentProject } from "./types";

const STORAGE_KEY = "skripttool.recents.v2";
const MAX_RECENTS = 8;

function isRecentProject(value: unknown): value is RecentProject {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<RecentProject>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.path === "string" &&
    typeof candidate.openedAt === "string" &&
    (candidate.kind === "electron" || candidate.kind === "browser" || candidate.kind === "memory")
  );
}

export function loadRecents(): RecentProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isRecentProject).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function saveRecents(recents: RecentProject[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
  } catch {
    /* 저장 공간이 없어도 앱은 계속 동작합니다. */
  }
}

export function rememberProject(recents: RecentProject[], entry: RecentProject): RecentProject[] {
  const next = [entry, ...recents.filter((item) => item.id !== entry.id)].slice(0, MAX_RECENTS);
  saveRecents(next);
  return next;
}

export function forgetProject(recents: RecentProject[], id: string): RecentProject[] {
  const next = recents.filter((item) => item.id !== id);
  saveRecents(next);
  return next;
}

export function relativeTime(iso: string): string {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) {
    return "";
  }
  const diff = Date.now() - time;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) {
    return "방금";
  }
  if (minutes < 60) {
    return `${minutes}분 전`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}시간 전`;
  }
  const days = Math.round(hours / 24);
  if (days < 30) {
    return `${days}일 전`;
  }
  return new Date(iso).toLocaleDateString("ko-KR");
}
