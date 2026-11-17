import { createDefaultEnvironment } from "../catalog";
import { normalizeEnvironment } from "../environment/normalize";
import { PROJECT_CONFIG_VERSION, type ProjectConfig } from "./types";

/** `.skripttool.json`은 사람이 읽을 수 있게 2칸 들여쓰기로 저장합니다. */
export function serializeProjectConfig(config: ProjectConfig): string {
  const ordered: ProjectConfig = {
    configVersion: PROJECT_CONFIG_VERSION,
    name: config.name,
    minecraftVersion: config.minecraftVersion,
    skriptVersion: config.skriptVersion,
    addons: [...config.addons],
    createdAt: config.createdAt,
    updatedAt: config.updatedAt
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

export function buildProjectConfig(
  name: string,
  environment: { minecraftVersion: string; skriptVersion: string; addons: string[] },
  options: { createdAt?: string } = {}
): ProjectConfig {
  const now = new Date().toISOString();
  return {
    configVersion: PROJECT_CONFIG_VERSION,
    name,
    minecraftVersion: environment.minecraftVersion,
    skriptVersion: environment.skriptVersion,
    addons: [...environment.addons],
    createdAt: options.createdAt ?? now,
    updatedAt: now
  };
}

/**
 * 파일이 깨졌거나 오래된 형식이어도 앱이 열리도록 최대한 복구합니다.
 * 돌려주는 값에는 항상 유효한 환경이 들어 있습니다.
 */
export function parseProjectConfig(text: string | null, fallbackName: string): {
  config: ProjectConfig;
  recovered: boolean;
} {
  if (!text) {
    const environment = createDefaultEnvironment();
    return { config: buildProjectConfig(fallbackName, environment), recovered: true };
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const environment = normalizeEnvironment(parsed);
    if (!environment) {
      return { config: buildProjectConfig(fallbackName, createDefaultEnvironment()), recovered: true };
    }
    const name = typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : fallbackName;
    return {
      config: {
        configVersion: typeof parsed.configVersion === "number" ? parsed.configVersion : PROJECT_CONFIG_VERSION,
        name,
        minecraftVersion: environment.minecraftVersion,
        skriptVersion: environment.skriptVersion,
        addons: environment.addons,
        createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : undefined,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined
      },
      recovered: false
    };
  } catch {
    return { config: buildProjectConfig(fallbackName, createDefaultEnvironment()), recovered: true };
  }
}

export function environmentOf(config: ProjectConfig): {
  minecraftVersion: string;
  skriptVersion: string;
  addons: string[];
} {
  return {
    minecraftVersion: config.minecraftVersion,
    skriptVersion: config.skriptVersion,
    addons: [...config.addons]
  };
}
