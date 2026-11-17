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
