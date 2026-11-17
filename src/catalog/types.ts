export type MinecraftVersion = string;
export type SkriptVersion = string;

export type SkriptRelease = {
  version: string;
  /** Minecraft versions this Skript release supports */
  minecraft: MinecraftVersion[];
  recommended?: boolean;
};

export type AddonCategory = "core" | "gui" | "data" | "integration" | "legacy";

export type AddonCompatibility =
  | "all"
  | {
      minecraft?: MinecraftVersion[];
      skript?: SkriptVersion[];
    };

export type AddonPackage = {
  id: string;
  name: string;
  description: string;
  versions: string[];
  compatibility: AddonCompatibility;
  /**
   * 인게임(실제 서버)에서 이 애드온이 동작하는 Minecraft 버전 범위입니다.
   * 표시용 문자열이라 "1.20.4 ~ 1.21.8"처럼 적고, compatibility 의 지원 목록과 어긋나지 않게 맞춥니다.
   */
  inGameVersions: string;
  /** 같은 버전 하나로 구버전 MC와 최신 MC를 함께 커버하는 애드온인지 (예: skript-yaml 1.8 ~ 1.21.8) */
  supportsLegacyAndLatest?: boolean;
  category: AddonCategory;
  /** 확장 패널에 보여 줄 대표 문법 한 줄 */
  sample?: string;
  /** 이 애드온과 함께 설치해야 하는 플러그인 */
  requires?: string[];
};

/** 프로젝트 환경(.skripttool.json)에 저장되는 값. 애드온은 카탈로그 ID 목록입니다. */
export type EnvironmentConfig = {
  minecraftVersion: MinecraftVersion;
  skriptVersion: SkriptVersion;
  addons: string[];
};

/** 현재 MC/Skript 조합에서의 애드온 상태. 비호환이면 이유를 함께 돌려줍니다. */
export type AddonAvailability = {
  addon: AddonPackage;
  compatible: boolean;
  reasons: string[];
  latestVersion: string;
};
