import {
  addonPackages,
  getCompatibleAddons,
  getCompatibleSkriptReleases,
  getRecommendedSkriptVersion,
  minecraftVersions,
  type EnvironmentConfig,
  type InstalledAddon
} from "../catalog";

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

  const compatible = getCompatibleAddons(minecraftVersion, skriptVersion);
  const allowed = new Map(compatible.map((addon) => [addon.id, addon]));

  const rawAddons = Array.isArray(candidate.addons) ? candidate.addons : [];
  const addons: InstalledAddon[] = [];
  for (const raw of rawAddons) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const installed = raw as Partial<InstalledAddon>;
    if (typeof installed.packageId !== "string") {
      continue;
    }
    const addon = allowed.get(installed.packageId);
    if (!addon) {
      continue;
    }
    const version =
      typeof installed.version === "string" && addon.availableVersions.includes(installed.version)
        ? installed.version
        : addon.availableVersions[0] ?? "latest";
    addons.push({
      id: typeof installed.id === "string" ? installed.id : `${addon.id}-${Date.now()}`,
      packageId: addon.id,
      name: addonPackages.find((entry) => entry.id === addon.id)?.name ?? addon.name,
      version
    });
  }

  return { minecraftVersion, skriptVersion, addons };
}
