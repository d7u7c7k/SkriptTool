import { addonPackages, findAddonPackage } from "./addons";
import { defaultMinecraftVersion, minecraftVersions } from "./minecraft";
import { skriptReleases } from "./skript";
import type {
  AddonAvailability,
  AddonPackage,
  EnvironmentConfig,
  MinecraftVersion,
  SkriptVersion
} from "./types";

export function getCompatibleSkriptReleases(minecraftVersion: MinecraftVersion) {
  return skriptReleases.filter((release) => release.minecraft.includes(minecraftVersion));
}

export function getRecommendedSkriptVersion(minecraftVersion: MinecraftVersion): SkriptVersion {
  const compatible = getCompatibleSkriptReleases(minecraftVersion);
  return compatible.find((release) => release.recommended)?.version ?? compatible[0]?.version ?? skriptReleases[0].version;
}

function describeVersionRange(versions: string[] | undefined): string {
  if (!versions || versions.length === 0) {
    return "";
  }
  if (versions.length === 1) {
    return versions[0];
  }
  return `${versions[versions.length - 1]} ~ ${versions[0]}`;
}

/** 한 애드온이 이 MC/Skript 조합에서 쓸 수 있는지, 못 쓴다면 왜인지 돌려줍니다. */
export function getAddonAvailability(
  addon: AddonPackage,
  minecraftVersion: MinecraftVersion,
  skriptVersion: SkriptVersion
): AddonAvailability {
  const latestVersion = addon.versions[0] ?? "latest";

  if (addon.compatibility === "all") {
    return { addon, compatible: true, reasons: [], latestVersion };
  }

  const reasons: string[] = [];
  const { minecraft, skript } = addon.compatibility;

  if (minecraft && minecraft.length > 0 && !minecraft.includes(minecraftVersion)) {
    reasons.push(`Minecraft ${minecraftVersion} 미지원 (지원: ${describeVersionRange(minecraft)})`);
  }
  if (skript && skript.length > 0 && !skript.includes(skriptVersion)) {
    reasons.push(`Skript ${skriptVersion} 미지원 (지원: ${describeVersionRange(skript)})`);
  }

  return { addon, compatible: reasons.length === 0, reasons, latestVersion };
}

/** 호환되는 애드온을 먼저, 비호환은 뒤로 정렬해 전부 돌려줍니다. */
export function listAddonAvailability(
  minecraftVersion: MinecraftVersion,
  skriptVersion: SkriptVersion
): AddonAvailability[] {
  return addonPackages
    .map((addon) => getAddonAvailability(addon, minecraftVersion, skriptVersion))
    .sort((left, right) => {
      if (left.compatible !== right.compatible) {
        return left.compatible ? -1 : 1;
      }
      return left.addon.name.localeCompare(right.addon.name);
    });
}

export function getCompatibleAddons(
  minecraftVersion: MinecraftVersion,
  skriptVersion: SkriptVersion
): AddonPackage[] {
  return listAddonAvailability(minecraftVersion, skriptVersion)
    .filter((entry) => entry.compatible)
    .map((entry) => entry.addon);
}

export function createDefaultEnvironment(
  minecraftVersion: MinecraftVersion = defaultMinecraftVersion,
  skriptVersion?: SkriptVersion
): EnvironmentConfig {
  const mc = minecraftVersions.includes(minecraftVersion) ? minecraftVersion : defaultMinecraftVersion;
  const skript =
    skriptVersion && getCompatibleSkriptReleases(mc).some((release) => release.version === skriptVersion)
      ? skriptVersion
      : getRecommendedSkriptVersion(mc);

  // 새 프로젝트는 애드온 없이 시작합니다. 필요한 애드온은 확장 패널에서 골라 추가합니다.
  return { minecraftVersion: mc, skriptVersion: skript, addons: [] };
}

/** 버전이 바뀌었을 때 호환되지 않게 된 애드온을 정리합니다. */
function pruneAddons(
  addons: string[],
  minecraftVersion: MinecraftVersion,
  skriptVersion: SkriptVersion
): { kept: string[]; dropped: AddonPackage[] } {
  const kept: string[] = [];
  const dropped: AddonPackage[] = [];

  for (const id of addons) {
    const addon = findAddonPackage(id);
    if (!addon) {
      continue;
    }
    const availability = getAddonAvailability(addon, minecraftVersion, skriptVersion);
    if (availability.compatible) {
      kept.push(id);
    } else {
      dropped.push(addon);
    }
  }

  return { kept, dropped };
}

export function resolveEnvironmentOnMinecraftChange(
  current: EnvironmentConfig,
  minecraftVersion: MinecraftVersion
): { environment: EnvironmentConfig; dropped: AddonPackage[] } {
  const skriptVersion = getRecommendedSkriptVersion(minecraftVersion);
  const { kept, dropped } = pruneAddons(current.addons, minecraftVersion, skriptVersion);
  return {
    environment: { minecraftVersion, skriptVersion, addons: kept },
    dropped
  };
}

export function resolveEnvironmentOnSkriptChange(
  current: EnvironmentConfig,
  skriptVersion: SkriptVersion
): { environment: EnvironmentConfig; dropped: AddonPackage[] } {
  const { kept, dropped } = pruneAddons(current.addons, current.minecraftVersion, skriptVersion);
  return {
    environment: { ...current, skriptVersion, addons: kept },
    dropped
  };
}

/** 애드온 하나를 추가/제거한 새 환경을 만듭니다. */
export function toggleAddon(
  current: EnvironmentConfig,
  addonId: string
): { environment: EnvironmentConfig; added: boolean; blockedReason?: string } {
  const addon = findAddonPackage(addonId);
  if (!addon) {
    return { environment: current, added: false, blockedReason: "카탈로그에 없는 애드온입니다." };
  }

  if (current.addons.includes(addonId)) {
    return { environment: { ...current, addons: current.addons.filter((id) => id !== addonId) }, added: false };
  }

  const availability = getAddonAvailability(addon, current.minecraftVersion, current.skriptVersion);
  if (!availability.compatible) {
    return { environment: current, added: false, blockedReason: availability.reasons.join(" · ") };
  }

  return { environment: { ...current, addons: [...current.addons, addonId] }, added: true };
}
