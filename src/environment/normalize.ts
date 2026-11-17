import {
  findAddonPackage,
  getAddonAvailability,
  getCompatibleSkriptReleases,
  getRecommendedSkriptVersion,
  minecraftVersions,
  type EnvironmentConfig
} from "../catalog";

/**
 * 저장된 환경(프로젝트 설정)을 카탈로그 기준으로 검증합니다.
 * 알 수 없는 버전이나 지금 조합에 없는 애드온은 조용히 걸러냅니다.
 */
export function normalizeEnvironment(value: unknown): EnvironmentConfig | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<EnvironmentConfig>;
  if (typeof candidate.minecraftVersion !== "string" || !minecraftVersions.includes(candidate.minecraftVersion)) {
    return null;
  }
  const minecraftVersion = candidate.minecraftVersion;
  const compatibleSkript = getCompatibleSkriptReleases(minecraftVersion).map((release) => release.version);
  const skriptVersion =
    typeof candidate.skriptVersion === "string" && compatibleSkript.includes(candidate.skriptVersion)
      ? candidate.skriptVersion
      : getRecommendedSkriptVersion(minecraftVersion);

  const rawAddons = Array.isArray(candidate.addons) ? candidate.addons : [];
  const addons: string[] = [];
  for (const raw of rawAddons) {
    if (typeof raw !== "string" || addons.includes(raw)) {
      continue;
    }
    const addon = findAddonPackage(raw);
    if (!addon) {
      continue;
    }
    if (!getAddonAvailability(addon, minecraftVersion, skriptVersion).compatible) {
      continue;
    }
    addons.push(raw);
  }

  return { minecraftVersion, skriptVersion, addons };
}
