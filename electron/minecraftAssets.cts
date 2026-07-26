import { app } from "electron";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";

export type MinecraftCatalogItem = {
  /** Skript-style id: "golden apple" */
  id: string;
  /** English display name */
  label: string;
  /** Korean display name when available */
  labelKo: string;
  /** Relative texture key: item/golden_apple */
  texture: string;
  /** Inline PNG so the renderer needs no file or custom protocol access */
  dataUrl: string;
};

export type MinecraftAssetsPayload = {
  version: string;
  minecraftPath: string;
  itemCount: number;
  items: MinecraftCatalogItem[];
};

const SKIP_IDS = new Set([
  "air",
  "cave_air",
  "void_air",
  "water",
  "lava",
  "bubble_column",
  "moving_piston",
  "piston_head",
  "fire",
  "soul_fire",
  "nether_portal",
  "end_portal",
  "end_gateway",
  "light"
]);

const payloadCache = new Map<string, MinecraftAssetsPayload>();

function getMinecraftPath() {
  return path.join(process.env.APPDATA || path.join(app.getPath("home"), "AppData", "Roaming"), ".minecraft");
}

function snakeToSkript(id: string) {
  return id.replace(/_/g, " ");
}

function cacheRoot(version: string) {
  return path.join(app.getPath("userData"), "mc-cache", version);
}

async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/** Pick best installed version folder matching requested MC version. */
export async function resolveInstalledVersion(requested: string): Promise<string | null> {
  const versionsDir = path.join(getMinecraftPath(), "versions");
  if (!(await pathExists(versionsDir))) {
    return null;
  }

  const entries = await fs.readdir(versionsDir, { withFileTypes: true });
  const withJar: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const jar = path.join(versionsDir, entry.name, `${entry.name}.jar`);
    if (await pathExists(jar)) {
      withJar.push(entry.name);
    }
  }

  if (withJar.includes(requested)) {
    return requested;
  }

  const prefix = requested.split(".").slice(0, 2).join(".");
  const sameLine = withJar.filter((name) => name.startsWith(prefix)).sort().reverse();
  if (sameLine[0]) {
    return sameLine[0];
  }

  return withJar.sort().reverse()[0] ?? null;
}

async function readAssetIndexId(version: string): Promise<string | null> {
  const versionJsonPath = path.join(getMinecraftPath(), "versions", version, `${version}.json`);
  if (!(await pathExists(versionJsonPath))) {
    return null;
  }
  const raw = JSON.parse(await fs.readFile(versionJsonPath, "utf8")) as { assetIndex?: { id?: string } };
  return raw.assetIndex?.id ?? null;
}

/** Language files live in the hashed asset object store, not in the jar. */
async function readLangObject(assetIndexId: string, langFile: string): Promise<Record<string, string>> {
  const indexPath = path.join(getMinecraftPath(), "assets", "indexes", `${assetIndexId}.json`);
  if (!(await pathExists(indexPath))) {
    return {};
  }
  const index = JSON.parse(await fs.readFile(indexPath, "utf8")) as {
    objects: Record<string, { hash: string }>;
  };
  const obj = index.objects[`minecraft/lang/${langFile}`];
  if (!obj?.hash) {
    return {};
  }
  const objectPath = path.join(getMinecraftPath(), "assets", "objects", obj.hash.slice(0, 2), obj.hash);
  if (!(await pathExists(objectPath))) {
    return {};
  }
  return JSON.parse(await fs.readFile(objectPath, "utf8")) as Record<string, string>;
}

async function extractTexturesFromJar(version: string, cacheDir: string) {
  const marker = path.join(cacheDir, ".extracted");
  if (await pathExists(marker)) {
    return;
  }

  const jarPath = path.join(getMinecraftPath(), "versions", version, `${version}.jar`);
  const bytes = new Uint8Array(await fs.readFile(jarPath));
  const entries = unzipSync(bytes);
  await fs.mkdir(path.join(cacheDir, "item"), { recursive: true });
  await fs.mkdir(path.join(cacheDir, "block"), { recursive: true });

  for (const [rawPath, data] of Object.entries(entries)) {
    const normalized = rawPath.replace(/\\/g, "/");
    const match = normalized.match(/^assets\/minecraft\/textures\/(item|block)\/([^/]+)\.png$/i);
    if (!match || !data?.length) {
      continue;
    }
    await fs.writeFile(path.join(cacheDir, match[1].toLowerCase(), `${match[2].toLowerCase()}.png`), data);
  }

  const enEntry = entries["assets/minecraft/lang/en_us.json"];
  if (enEntry) {
    await fs.writeFile(path.join(cacheDir, "en_us.json"), enEntry);
  }

  await fs.writeFile(marker, new Date().toISOString(), "utf8");
}

function pickTexture(cacheDir: string, rawId: string): string | null {
  const candidates = [
    `item/${rawId}`,
    `block/${rawId}`,
    `block/${rawId}_top`,
    `block/${rawId}_front`,
    `block/${rawId}_side`,
    `item/${rawId}_00`
  ];
  for (const candidate of candidates) {
    if (fsSync.existsSync(path.join(cacheDir, `${candidate}.png`))) {
      return candidate;
    }
  }
  return null;
}

function readDataUrl(cacheDir: string, textureKey: string): string {
  const file = path.join(cacheDir, `${textureKey}.png`);
  return `data:image/png;base64,${fsSync.readFileSync(file).toString("base64")}`;
}

function buildCatalog(
  cacheDir: string,
  en: Record<string, string>,
  ko: Record<string, string>
): MinecraftCatalogItem[] {
  const items = new Map<string, MinecraftCatalogItem>();

  const add = (rawId: string, enName: string, koName: string) => {
    if (SKIP_IDS.has(rawId)) {
      return;
    }
    const id = snakeToSkript(rawId);
    if (items.has(id)) {
      return;
    }
    const texture = pickTexture(cacheDir, rawId);
    if (!texture) {
      return;
    }
    items.set(id, {
      id,
      label: enName || id,
      labelKo: koName || "",
      texture,
      dataUrl: readDataUrl(cacheDir, texture)
    });
  };

  for (const prefix of ["item.minecraft.", "block.minecraft."]) {
    for (const [key, enName] of Object.entries(en)) {
      if (key.startsWith(prefix)) {
        const rawId = key.slice(prefix.length);
        add(rawId, enName, ko[key] || "");
      }
    }
  }

  // Cover textures that have no language entry (or a differently keyed one).
  const itemDir = path.join(cacheDir, "item");
  if (fsSync.existsSync(itemDir)) {
    for (const file of fsSync.readdirSync(itemDir)) {
      if (!file.endsWith(".png")) {
        continue;
      }
      const rawId = file.replace(/\.png$/i, "");
      if (/_\d{2}$/.test(rawId) && !rawId.endsWith("_00")) {
        continue;
      }
      const normalized = rawId.replace(/_00$/, "");
      add(
        normalized,
        en[`item.minecraft.${normalized}`] || snakeToSkript(normalized),
        ko[`item.minecraft.${normalized}`] || ""
      );
    }
  }

  return [...items.values()].sort((a, b) => a.id.localeCompare(b.id, "en"));
}

export async function prepareMinecraftAssets(requestedVersion: string): Promise<MinecraftAssetsPayload> {
  const minecraftPath = getMinecraftPath();
  const version = (await resolveInstalledVersion(requestedVersion)) ?? requestedVersion;

  const cached = payloadCache.get(version);
  if (cached) {
    return cached;
  }

  const jarPath = path.join(minecraftPath, "versions", version, `${version}.jar`);
  if (!(await pathExists(jarPath))) {
    throw new Error(`.minecraft 버전 jar를 찾을 수 없습니다: ${jarPath}`);
  }

  const cacheDir = cacheRoot(version);
  await fs.mkdir(cacheDir, { recursive: true });
  await extractTexturesFromJar(version, cacheDir);

  let en: Record<string, string> = {};
  let ko: Record<string, string> = {};

  const cachedEn = path.join(cacheDir, "en_us.json");
  if (await pathExists(cachedEn)) {
    en = JSON.parse(await fs.readFile(cachedEn, "utf8")) as Record<string, string>;
  }

  const assetIndexId = await readAssetIndexId(version);
  if (assetIndexId) {
    const enFromAssets = await readLangObject(assetIndexId, "en_us.json");
    if (Object.keys(enFromAssets).length > 0) {
      en = enFromAssets;
    }
    ko = await readLangObject(assetIndexId, "ko_kr.json");
  }

  const items = buildCatalog(cacheDir, en, ko);
  const payload: MinecraftAssetsPayload = {
    version,
    minecraftPath,
    itemCount: items.length,
    items
  };

  payloadCache.set(version, payload);
  return payload;
}

export function getMinecraftHomePath() {
  return getMinecraftPath();
}
