export type MinecraftVersion = string;

export type SkriptRelease = {
  version: string;
  /** Minecraft versions this Skript release supports */
  minecraft: MinecraftVersion[];
  recommended?: boolean;
};

export type AddonCompatibility =
  | "all"
  | {
      minecraft?: MinecraftVersion[];
      skript?: string[];
    };

export type AddonPackage = {
  id: string;
  name: string;
  description: string;
  versions: string[];
  compatibility: AddonCompatibility;
};

export type InstalledAddon = {
  id: string;
  packageId: string;
  name: string;
  version: string;
};

export type EnvironmentConfig = {
  minecraftVersion: MinecraftVersion;
  skriptVersion: string;
  addons: InstalledAddon[];
};

export type CompatibleAddon = AddonPackage & {
  availableVersions: string[];
  alwaysAvailable: boolean;
};
