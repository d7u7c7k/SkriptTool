import type { EnvironmentConfig } from "../catalog";
import type { WorkspaceKind } from "../workspace/types";

export type ProjectConfig = {
  /** .skripttool.json 형식 버전 */
  configVersion: number;
  /** 화면에 보여 줄 프로젝트 이름 (폴더 이름과 다를 수 있음) */
  name: string;
  minecraftVersion: string;
  skriptVersion: string;
  /** 설치된 애드온 ID 목록 */
  addons: string[];
  createdAt?: string;
  updatedAt?: string;
};

export const PROJECT_CONFIG_FILE = ".skripttool.json";
export const PROJECT_CONFIG_VERSION = 1;
export const PROJECT_MAIN_FILE = "main.sk";

/** 최근 프로젝트 목록 항목 (localStorage) */
export type RecentProject = {
  /** 프로젝트 루트 경로 (Electron은 실제 경로, 브라우저는 browser://) */
  id: string;
  name: string;
  path: string;
  kind: WorkspaceKind;
  minecraftVersion: string;
  skriptVersion: string;
  addonCount: number;
  openedAt: string;
};

export type NewProjectSpec = {
  name: string;
  /** Electron에서 상위 폴더 (여기에 프로젝트 폴더를 만듭니다) */
  parentPath: string | null;
  environment: EnvironmentConfig;
  /** 예제 코드를 함께 만들지 여부 */
  includeSample?: boolean;
};
