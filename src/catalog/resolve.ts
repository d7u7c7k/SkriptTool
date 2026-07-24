import { addonPackages } from "./addons";
import { skriptReleases } from "./skript";
import type { CompatibleAddon, EnvironmentConfig, InstalledAddon, MinecraftVersion, SkriptRelease } from "./types";

export function getCompatibleSkriptReleases(minecraftVersion: MinecraftVersion): SkriptRelease[] {
  return skriptReleases.filter((release) => release.minecraft.includes(minecraftVersion));
}

export function getRecommendedSkriptVersion(minecraftVersion: MinecraftVersion): string {
  const compatible = getCompatibleSkriptReleases(minecraftVersion);
  return compatible.find((release) => release.recommended)?.version ?? compatible[0]?.version ?? skriptReleases[0].version;
}

function versionMatches(selected: string, allowed?: string[]): boolean {
  if (!allowed || allowed.length === 0) {
    return true;
  }
  return allowed.includes(selected);
}

export function getCompatibleAddons(minecraftVersion: MinecraftVersion, skriptVersion: string): CompatibleAddon[] {
  return addonPackages
    .map((addon) => {
      if (addon.compatibility === "all") {
        return {
          ...addon,
          availableVersions: addon.versions,
          alwaysAvailable: true
        };
      }

      const mcOk = versionMatches(minecraftVersion, addon.compatibility.minecraft);
      const skOk = versionMatches(skriptVersion, addon.compatibility.skript);

      if (!mcOk || !skOk) {
        return null;
      }

      return {
        ...addon,
        availableVersions: addon.versions,
        alwaysAvailable: false
      };
    })
    .filter((addon): addon is CompatibleAddon => addon !== null)
    .sort((left, right) => {
      if (left.alwaysAvailable !== right.alwaysAvailable) {
        return left.alwaysAvailable ? 1 : -1;
      }
      return left.name.localeCompare(right.name);
    });
}

export function createDefaultEnvironment(): EnvironmentConfig {
  const minecraftVersion = "1.21.4";
  const skriptVersion = getRecommendedSkriptVersion(minecraftVersion);
  const compatible = getCompatibleAddons(minecraftVersion, skriptVersion);
  const prefer = ["skbee", "skript-reflect"];

  const addons: InstalledAddon[] = prefer
    .map((packageId) => compatible.find((addon) => addon.id === packageId))
    .filter((addon): addon is CompatibleAddon => Boolean(addon))
    .map((addon) => ({
      id: `${addon.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      packageId: addon.id,
      name: addon.name,
      version: addon.availableVersions[0]
    }));

  return { minecraftVersion, skriptVersion, addons };
}

export function resolveEnvironmentOnMinecraftChange(
  current: EnvironmentConfig,
  minecraftVersion: MinecraftVersion
): EnvironmentConfig {
  const skriptVersion = getRecommendedSkriptVersion(minecraftVersion);
  const compatible = getCompatibleAddons(minecraftVersion, skriptVersion);
  const addons = current.addons
    .map((installed) => {
      const match = compatible.find((addon) => addon.id === installed.packageId);
      if (!match) {
        return null;
      }
      const version = match.availableVersions.includes(installed.version)
        ? installed.version
        : match.availableVersions[0];
      return { ...installed, name: match.name, version };
    })
    .filter((addon): addon is InstalledAddon => addon !== null);

  return { minecraftVersion, skriptVersion, addons };
}

export function resolveEnvironmentOnSkriptChange(current: EnvironmentConfig, skriptVersion: string): EnvironmentConfig {
  const compatible = getCompatibleAddons(current.minecraftVersion, skriptVersion);
  const addons = current.addons
    .map((installed) => {
      const match = compatible.find((addon) => addon.id === installed.packageId);
      if (!match) {
        return null;
      }
      const version = match.availableVersions.includes(installed.version)
        ? installed.version
        : match.availableVersions[0];
      return { ...installed, name: match.name, version };
    })
    .filter((addon): addon is InstalledAddon => addon !== null);

  return { ...current, skriptVersion, addons };
}
