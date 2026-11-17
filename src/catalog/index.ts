export type {
  AddonAvailability,
  AddonCategory,
  AddonCompatibility,
  AddonPackage,
  EnvironmentConfig,
  MinecraftVersion,
  SkriptRelease,
  SkriptVersion
} from "./types";
export { addonPackages, findAddonPackage } from "./addons";
export { addonSyntax, syntaxForAddon, type AddonSyntaxRule } from "./addonSyntax";
export { defaultMinecraftVersion, minecraftVersions } from "./minecraft";
export { skriptReleases } from "./skript";
export { activeLegacyRules, legacyRules, type LegacyRule } from "./legacy";
export { atLeast, compareVersions } from "./versions";
export {
  createDefaultEnvironment,
  getAddonAvailability,
  getCompatibleAddons,
  getCompatibleSkriptReleases,
  getRecommendedSkriptVersion,
  listAddonAvailability,
  resolveEnvironmentOnMinecraftChange,
  resolveEnvironmentOnSkriptChange,
  toggleAddon
} from "./resolve";
