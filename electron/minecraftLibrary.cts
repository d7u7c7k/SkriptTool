import { app, dialog } from "electron";
import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

/**
 * 인게임 마크 리소스(아이템·블록 텍스처)를 앱 공용 라이브러리에 버전별로 한 번만 풀어 두고
 * 여러 프로젝트가 함께 쓰는 모듈입니다. 프로젝트 폴더에는 아무것도 복사하지 않습니다.
 *
 *   <userData>/shared-mc-library/<versionKey>/textures/item/*.png
 *   <userData>/shared-mc-library/<versionKey>/textures/block/*.png
 *   <userData>/shared-mc-library/<versionKey>/index.json
 */

export type McLibrarySourceType = "jar" | "resourcepack" | "manual-jar" | "manual-pack";

export type McLibraryEntry = {
  versionKey: string;
  /** 버전 .jar에서 온 경우 MC 버전 (리소스팩은 null) */
  mcVersion: string | null;
  /** 화면에 보여 줄 이름 (버전 또는 리소스팩 이름) */
  label: string;
  sourceType: McLibrarySourceType;
  sourcePath: string | null;
  itemCount: number;
  blockCount: number;
  textureCount: number;
  bytes: number;
  createdAt: string;
};

export type McLibraryDetection = {
  mcHome: string | null;
  mcHomeSource: "env" | "default" | null;
  installedVersions: string[];
  latestVersion: string | null;
  resourcePacks: string[];
};

export type McLibraryStatus = {
  libraryRoot: string;
  entries: McLibraryEntry[];
  totalBytes: number;
  detection: McLibraryDetection;
};

export type McLibraryMatch = "cached" | "exact" | "same-line" | "latest" | "resourcepack" | "manual";

export type McLibrarySyncResult =
  | {
      ok: true;
      reused: boolean;
      matched: McLibraryMatch;
      /** 요청한 프로젝트 MC 버전 (없으면 null) */
      requestedVersion: string | null;
      /** 실제로 다른 버전으로 대체 연결했는지 */
      substituted: boolean;
      entry: McLibraryEntry;
      message: string;
    }
  | {
      ok: false;
      reason: "no-install" | "no-textures" | "invalid-source" | "canceled" | "failed";
      message: string;
    };

const ITEM_PREFIX = "assets/minecraft/textures/item/";
const BLOCK_PREFIX = "assets/minecraft/textures/block/";
const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
const MAX_TEXTURE_BYTES = 8 * 1024 * 1024;
const MAX_TEXTURE_TOTAL = 6000;
const MAX_WALK_DEPTH = 6;
const SIGNATURE_EOCD = 0x06054b50;
const SIGNATURE_CENTRAL = 0x02014b50;
const SIGNATURE_LOCAL = 0x04034b50;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
};

type TextureCategory = "item" | "block";
type TextureTarget = { category: TextureCategory; relative: string };
type ExtractResult = { itemCount: number; blockCount: number; bytes: number };

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return typeof error === "string" ? error : "알 수 없는 오류가 발생했습니다.";
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function sharedLibraryRoot(): string {
  return path.join(app.getPath("userData"), "shared-mc-library");
}

/** 폴더 이름으로 쓸 수 없는 문자만 지웁니다. 한글·영문·숫자는 그대로 두고 경로 탈출 문자는 남기지 않습니다. */
function sanitizeVersionKey(input: string): string {
  const cleaned = String(input ?? "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^[.\-]+/, "")
    .replace(/[.\-]+$/, "")
    .slice(0, 64);
  return cleaned || "pack";
}

function extractVersionFromName(name: string): string | null {
  const match = name.trim().match(/^(\d+\.\d+(?:\.\d+)?)(?:$|[-_ +])/);
  return match ? match[1] : null;
}

/** 리소스팩 이름은 버전 번호만 정확히 같을 때만 버전으로 봅니다("1.21.4 리소스팩" 같은 이름이 버전 캐시를 덮지 않게). */
function extractExactVersion(name: string): string | null {
  const match = name.trim().match(/^(\d+\.\d+(?:\.\d+)?)$/);
  return match ? match[1] : null;
}

function baseVersionParts(label: string): number[] {
  const base = label.split(/[-_+ ]/)[0] ?? "";
  const match = base.match(/^\d+(?:\.\d+)*/);
  if (!match) {
    return [];
  }
  return match[0].split(".").map((part) => Number.parseInt(part, 10));
}

/** "1.21.4" > "1.21.4_HD_U_I5", "1.21.10" > "1.21.4" 처럼 비교합니다. */
function compareMcVersions(a: string, b: string): number {
  const left = baseVersionParts(a);
  const right = baseVersionParts(b);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = Number.isFinite(left[index]) ? left[index] : 0;
    const rightPart = Number.isFinite(right[index]) ? right[index] : 0;
    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }
  // 같은 번호면 짧은(정식 이름) 쪽을 더 최신으로 봅니다.
  return b.length - a.length;
}

async function isDirectory(target: string): Promise<boolean> {
  const stats = await fs.stat(target).catch(() => null);
  return Boolean(stats && stats.isDirectory());
}

function defaultMcHomes(): string[] {
  const home = os.homedir();
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    return [path.join(appData, ".minecraft")];
  }
  if (process.platform === "darwin") {
    return [path.join(home, "Library", "Application Support", "minecraft")];
  }
  return [path.join(home, ".minecraft")];
}

async function resolveMcHome(): Promise<{ path: string; source: "env" | "default" } | null> {
  const envHome = process.env.SKRIPTTOOL_MC_HOME?.trim();
  if (envHome) {
    const resolved = path.resolve(envHome);
    if (await isDirectory(resolved)) {
      return { path: resolved, source: "env" };
    }
  }
  for (const candidate of defaultMcHomes()) {
    if (await isDirectory(candidate)) {
      return { path: candidate, source: "default" };
    }
  }
  return null;
}

async function listInstalledVersions(mcHome: string): Promise<Array<{ id: string; jarPath: string }>> {
  const versionsDir = path.join(mcHome, "versions");
  const dirents = await fs.readdir(versionsDir, { withFileTypes: true }).catch(() => [] as Dirent[]);
  const found: Array<{ id: string; jarPath: string }> = [];
  for (const dirent of dirents) {
    if (!dirent.isDirectory() || dirent.name.startsWith(".")) {
      continue;
    }
    const jarPath = path.join(versionsDir, dirent.name, `${dirent.name}.jar`);
    const stats = await fs.stat(jarPath).catch(() => null);
    if (stats?.isFile()) {
      found.push({ id: dirent.name, jarPath });
    }
  }
  return found.sort((left, right) => compareMcVersions(right.id, left.id));
}

type PackCandidate = { label: string; fullPath: string; kind: "file" | "folder"; modified: number };

async function listResourcePacks(mcHome: string): Promise<PackCandidate[]> {
  const packsDir = path.join(mcHome, "resourcepacks");
  const dirents = await fs.readdir(packsDir, { withFileTypes: true }).catch(() => [] as Dirent[]);
  const found: PackCandidate[] = [];
  for (const dirent of dirents) {
    if (dirent.name.startsWith(".")) {
      continue;
    }
    const fullPath = path.join(packsDir, dirent.name);
    const lower = dirent.name.toLowerCase();
    if (dirent.isFile() && (lower.endsWith(".zip") || lower.endsWith(".jar"))) {
      const stats = await fs.stat(fullPath).catch(() => null);
      found.push({ label: dirent.name, fullPath, kind: "file", modified: stats?.mtimeMs ?? 0 });
      continue;
    }
    if (dirent.isDirectory()) {
      // 텍스처 폴더가 있는 팩만 후보로 봅니다.
      if (await isDirectory(path.join(fullPath, ITEM_PREFIX)) || (await isDirectory(path.join(fullPath, BLOCK_PREFIX)))) {
        const stats = await fs.stat(fullPath).catch(() => null);
        found.push({ label: dirent.name, fullPath, kind: "folder", modified: stats?.mtimeMs ?? 0 });
      }
    }
  }
  return found.sort((left, right) => right.modified - left.modified);
}

async function detectMinecraft(): Promise<McLibraryDetection> {
  const home = await resolveMcHome();
  if (!home) {
    return { mcHome: null, mcHomeSource: null, installedVersions: [], latestVersion: null, resourcePacks: [] };
  }
  const installed = await listInstalledVersions(home.path);
  const packs = await listResourcePacks(home.path);
  return {
    mcHome: home.path,
    mcHomeSource: home.source,
    installedVersions: installed.map((version) => version.id),
    latestVersion: installed[0]?.id ?? null,
    resourcePacks: packs.map((pack) => pack.label)
  };
}

/* ------------------------------ ZIP 읽기 ------------------------------ */

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minimum = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === SIGNATURE_EOCD) {
      return offset;
    }
  }
  return -1;
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  if (buffer.length < 22) {
    throw new Error("압축 파일이 너무 작습니다.");
  }
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) {
    throw new Error("ZIP 형식이 아닙니다. .jar 또는 .zip 파일인지 확인해 주세요.");
  }
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const directorySize = buffer.readUInt32LE(eocd + 12);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);
  if (entryCount === 0xffff || directoryOffset === 0xffffffff || directorySize === 0xffffffff) {
    throw new Error("ZIP64 형식 압축 파일은 아직 지원하지 않습니다.");
  }
  if (directoryOffset + directorySize > buffer.length) {
    throw new Error("압축 파일의 중앙 디렉터리가 손상되었습니다.");
  }

  const entries: ZipEntry[] = [];
  let cursor = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== SIGNATURE_CENTRAL) {
      break;
    }
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > buffer.length) {
      break;
    }
    entries.push({
      name: buffer.subarray(nameStart, nameEnd).toString("utf8"),
      method,
      compressedSize,
      uncompressedSize,
      localOffset
    });
    cursor = nameEnd + extraLength + commentLength;
  }
  return entries;
}

function readZipEntryData(buffer: Buffer, entry: ZipEntry): Buffer {
  const local = entry.localOffset;
  if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== SIGNATURE_LOCAL) {
    throw new Error(`압축 항목 머리를 읽지 못했습니다: ${entry.name}`);
  }
  const nameLength = buffer.readUInt16LE(local + 26);
  const extraLength = buffer.readUInt16LE(local + 28);
  const start = local + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (start > buffer.length || end > buffer.length || end < start) {
    throw new Error(`압축 항목 데이터가 잘렸습니다: ${entry.name}`);
  }
  const data = buffer.subarray(start, end);
  if (entry.method === 0) {
    return Buffer.from(data);
  }
  if (entry.method === 8) {
    return zlib.inflateRawSync(data, { maxOutputLength: MAX_TEXTURE_BYTES + 1 });
  }
  throw new Error(`지원하지 않는 압축 방식입니다: ${entry.name}`);
}

/* ---------------------------- 텍스처 경로 ---------------------------- */

/**
 * Zip Slip 방지: item/block 아래의 .png만, 절대 경로·드라이브 문자·상위 이동(..)을
 * 모두 걸러 낸 뒤에만 저장 대상으로 인정합니다.
 */
function mapTexturePath(rawName: string): TextureTarget | null {
  const name = rawName.replace(/\\/g, "/");
  if (!name || name.startsWith("/") || /^[A-Za-z]:/.test(name)) {
    return null;
  }
  const lower = name.toLowerCase();
  const category: TextureCategory | null = lower.startsWith(ITEM_PREFIX)
    ? "item"
    : lower.startsWith(BLOCK_PREFIX)
      ? "block"
      : null;
  if (!category) {
    return null;
  }
  const relative = name.slice((category === "item" ? ITEM_PREFIX : BLOCK_PREFIX).length);
  if (!relative.toLowerCase().endsWith(".png")) {
    return null;
  }
  const segments = relative.split("/");
  for (const segment of segments) {
    if (!segment || segment === "." || segment === "..") {
      return null;
    }
    if (/[\u0000-\u001f]/.test(segment)) {
      return null;
    }
  }
  return { category, relative };
}

function isPng(data: Buffer): boolean {
  return data.length > PNG_SIGNATURE.length && data.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

async function writeTexture(versionRoot: string, target: TextureTarget, data: Buffer): Promise<void> {
  const texturesRoot = path.resolve(versionRoot, "textures");
  const filePath = path.resolve(texturesRoot, target.category, target.relative);
  if (!isInside(texturesRoot, filePath) || filePath === texturesRoot) {
    throw new Error("안전하지 않은 텍스처 경로가 들어 있어 건너뜁니다.");
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);
}

async function extractFromZip(archivePath: string, versionRoot: string): Promise<ExtractResult> {
  const stats = await fs.stat(archivePath);
  if (!stats.isFile()) {
    throw new Error("선택한 경로가 파일이 아닙니다.");
  }
  if (stats.size > MAX_ARCHIVE_BYTES) {
    throw new Error("압축 파일이 너무 큽니다(512MB 초과).");
  }
  const buffer = await fs.readFile(archivePath);
  const entries = readZipEntries(buffer);
  const result: ExtractResult = { itemCount: 0, blockCount: 0, bytes: 0 };

  for (const entry of entries) {
    if (entry.name.endsWith("/")) {
      continue;
    }
    const target = mapTexturePath(entry.name);
    if (!target) {
      continue;
    }
    if (result.itemCount + result.blockCount >= MAX_TEXTURE_TOTAL) {
      break;
    }
    if (entry.uncompressedSize > MAX_TEXTURE_BYTES) {
      continue;
    }
    let data: Buffer;
    try {
      data = readZipEntryData(buffer, entry);
    } catch {
      continue;
    }
    if (!isPng(data)) {
      continue;
    }
    await writeTexture(versionRoot, target, data);
    result.bytes += data.length;
    if (target.category === "item") {
      result.itemCount += 1;
    } else {
      result.blockCount += 1;
    }
  }

  return result;
}

async function walkPngs(
  directory: string,
  relativeBase: string,
  visit: (filePath: string, relative: string) => Promise<void>,
  depth = 0
): Promise<void> {
  if (depth > MAX_WALK_DEPTH) {
    return;
  }
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [] as Dirent[]);
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    const relative = relativeBase ? `${relativeBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await walkPngs(fullPath, relative, visit, depth + 1);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) {
      await visit(fullPath, relative);
    }
  }
}

async function extractFromFolder(packRoot: string, versionRoot: string): Promise<ExtractResult> {
  const result: ExtractResult = { itemCount: 0, blockCount: 0, bytes: 0 };

  for (const category of ["item", "block"] as TextureCategory[]) {
    const directory = path.join(packRoot, "assets", "minecraft", "textures", category);
    if (!(await isDirectory(directory))) {
      continue;
    }
    let stopped = false;
    await walkPngs(directory, "", async (filePath, relative) => {
      if (stopped || result.itemCount + result.blockCount >= MAX_TEXTURE_TOTAL) {
        stopped = true;
        return;
      }
      const stats = await fs.stat(filePath).catch(() => null);
      if (!stats?.isFile() || stats.size === 0 || stats.size > MAX_TEXTURE_BYTES) {
        return;
      }
      const data = await fs.readFile(filePath).catch(() => null);
      if (!data || !isPng(data)) {
        return;
      }
      await writeTexture(versionRoot, { category, relative }, data);
      result.bytes += data.length;
      if (category === "item") {
        result.itemCount += 1;
      } else {
        result.blockCount += 1;
      }
    });
  }

  return result;
}

/* --------------------------- 라이브러리 색인 --------------------------- */

async function scanTextures(versionRoot: string): Promise<ExtractResult> {
  const result: ExtractResult = { itemCount: 0, blockCount: 0, bytes: 0 };
  for (const category of ["item", "block"] as TextureCategory[]) {
    const directory = path.join(versionRoot, "textures", category);
    if (!(await isDirectory(directory))) {
      continue;
    }
    await walkPngs(directory, "", async (filePath) => {
      const stats = await fs.stat(filePath).catch(() => null);
      if (!stats?.isFile()) {
        return;
      }
      result.bytes += stats.size;
      if (category === "item") {
        result.itemCount += 1;
      } else {
        result.blockCount += 1;
      }
    });
  }
  return result;
}

function toEntry(versionKey: string, index: Record<string, unknown>, scan: ExtractResult): McLibraryEntry {
  return {
    versionKey,
    mcVersion: typeof index.mcVersion === "string" && index.mcVersion ? index.mcVersion : null,
    label:
      typeof index.label === "string" && index.label
        ? index.label
        : typeof index.mcVersion === "string" && index.mcVersion
          ? index.mcVersion
          : versionKey,
    sourceType: normalizeSourceType(index.sourceType),
    sourcePath: typeof index.sourcePath === "string" ? index.sourcePath : null,
    itemCount: scan.itemCount,
    blockCount: scan.blockCount,
    textureCount: scan.itemCount + scan.blockCount,
    bytes: scan.bytes,
    createdAt: typeof index.createdAt === "string" ? index.createdAt : new Date(0).toISOString()
  };
}

function normalizeSourceType(value: unknown): McLibrarySourceType {
  return value === "jar" || value === "resourcepack" || value === "manual-jar" || value === "manual-pack"
    ? value
    : "jar";
}

async function readCachedEntry(versionKey: string): Promise<{ entry: McLibraryEntry; valid: boolean } | null> {
  if (versionKey !== sanitizeVersionKey(versionKey) || versionKey.startsWith(".")) {
    return null;
  }
  const versionRoot = path.join(sharedLibraryRoot(), versionKey);
  if (!isInside(sharedLibraryRoot(), versionRoot) || versionRoot === sharedLibraryRoot()) {
    return null;
  }
  const raw = await fs.readFile(path.join(versionRoot, "index.json"), "utf8").catch(() => null);
  if (!raw) {
    return null;
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  const scan = await scanTextures(versionRoot);
  const entry = toEntry(versionKey, parsed, scan);
  const recorded = typeof parsed.textureCount === "number" ? parsed.textureCount : -1;
  return { entry, valid: entry.textureCount > 0 && entry.textureCount === recorded };
}

async function extractIntoVersion(
  versionKey: string,
  source: {
    sourceType: McLibrarySourceType;
    sourcePath: string;
    kind: "file" | "folder";
    mcVersion: string | null;
    label: string;
  }
): Promise<{ ok: true; entry: McLibraryEntry } | { ok: false; message: string }> {
  const root = sharedLibraryRoot();
  await fs.mkdir(root, { recursive: true });
  const finalRoot = path.join(root, versionKey);
  if (!isInside(root, finalRoot) || finalRoot === root) {
    return { ok: false, message: "저장 경로가 올바르지 않습니다." };
  }

  const tempRoot = await fs.mkdtemp(path.join(root, `.incoming-${versionKey}-`));
  try {
    const extracted =
      source.kind === "folder"
        ? await extractFromFolder(source.sourcePath, tempRoot)
        : await extractFromZip(source.sourcePath, tempRoot);

    if (extracted.itemCount + extracted.blockCount === 0) {
      await fs.rm(tempRoot, { recursive: true, force: true });
      return {
        ok: false,
        message:
          source.kind === "folder"
            ? `${source.label} 폴더에 아이템/블록 PNG 텍스처가 없습니다.`
            : `${source.label} 안에 아이템/블록 PNG 텍스처가 없습니다.`
      };
    }

    const entry: McLibraryEntry = {
      versionKey,
      mcVersion: source.mcVersion,
      label: source.label,
      sourceType: source.sourceType,
      sourcePath: source.sourcePath,
      itemCount: extracted.itemCount,
      blockCount: extracted.blockCount,
      textureCount: extracted.itemCount + extracted.blockCount,
      bytes: extracted.bytes,
      createdAt: new Date().toISOString()
    };
    await fs.writeFile(path.join(tempRoot, "index.json"), `${JSON.stringify(entry, null, 2)}\n`, "utf8");
    await fs.rm(finalRoot, { recursive: true, force: true });
    await fs.rename(tempRoot, finalRoot);
    return { ok: true, entry };
  } catch (error) {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
    return { ok: false, message: describeError(error) };
  }
}

function sourceLabel(entry: McLibraryEntry): string {
  switch (entry.sourceType) {
    case "jar":
      return "인게임 버전 JAR";
    case "resourcepack":
      return "리소스팩";
    case "manual-jar":
      return "직접 고른 JAR";
    case "manual-pack":
      return "직접 고른 리소스팩";
    default:
      return "알 수 없음";
  }
}

function successMessage(entry: McLibraryEntry, reused: boolean): string {
  const source = sourceLabel(entry);
  const where = entry.mcVersion ? `MC ${entry.mcVersion}` : entry.label;
  return `${where} · ${source} · 텍스처 ${entry.textureCount}개 · ${formatBytes(entry.bytes)}${
    reused ? " · 공용 캐시 재사용" : " · 공용 라이브러리에 새로 저장"
  }`;
}

/** 요청한 프로젝트 버전과 다른 버전으로 연결될 때 이유를 앞에 붙입니다. */
function withSubstituteNote(message: string, requested: string | null, entry: McLibraryEntry, matched: McLibraryMatch): string {
  if (!requested || matched === "exact" || matched === "cached" || requested === entry.mcVersion) {
    return message;
  }
  if (matched === "latest") {
    return `MC ${requested} 리소스가 설치되어 있지 않아 설치된 최신 버전 ${entry.mcVersion ?? entry.label}로 대체했습니다. ${message}`;
  }
  if (matched === "same-line") {
    return `MC ${requested} 정확한 버전이 없어 같은 버전 계열 ${entry.mcVersion ?? entry.label}로 연결했습니다. ${message}`;
  }
  if (matched === "resourcepack") {
    return `versions/에서 ${requested} JAR을 찾지 못해 리소스팩 ${entry.label}에서 가져왔습니다. ${message}`;
  }
  return message;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? Math.round(value) : value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`;
}

/* ------------------------------- 동기화 ------------------------------- */

/** 같은 순간에 두 번 추출하지 않도록 요청을 차례로 처리합니다. */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function matchInstalledVersion(
  installed: Array<{ id: string; jarPath: string }>,
  target: string
): { candidate: { id: string; jarPath: string }; kind: "exact" | "same-line" } | null {
  const exact = installed.find((version) => version.id === target);
  if (exact) {
    return { candidate: exact, kind: "exact" };
  }
  const sameLine = installed.find(
    (version) =>
      version.id.startsWith(`${target}-`) || version.id.startsWith(`${target}_`) || version.id.startsWith(`${target} `)
  );
  if (sameLine) {
    return { candidate: sameLine, kind: "same-line" };
  }
  return null;
}

async function performSync(targetMcVersion: string | null): Promise<McLibrarySyncResult> {
  const requested = targetMcVersion?.trim() || null;
  await fs.mkdir(sharedLibraryRoot(), { recursive: true });

  // 1) 이미 같은 버전 캐시가 있으면 탐색 없이 바로 재사용합니다.
  if (requested) {
    const cached = await readCachedEntry(sanitizeVersionKey(requested));
    if (cached?.valid && cached.entry.mcVersion === requested) {
      return {
        ok: true,
        reused: true,
        matched: "cached",
        requestedVersion: requested,
        substituted: false,
        entry: cached.entry,
        message: successMessage(cached.entry, true)
      };
    }
  }

  const home = await resolveMcHome();
  let lastMessage = "";

  if (home) {
    // 2) versions/<ver>/<ver>.jar → 현재 프로젝트 버전 우선, 없으면 최신 설치 버전
    const installed = await listInstalledVersions(home.path);
    if (installed.length > 0) {
      const match = requested ? matchInstalledVersion(installed, requested) : null;
      const candidate = match?.candidate ?? installed[0];
      const matched: McLibraryMatch = match?.kind ?? "latest";
      const key = sanitizeVersionKey(candidate.id);

      const cached = await readCachedEntry(key);
      if (cached?.valid) {
        return {
          ok: true,
          reused: true,
          matched,
          requestedVersion: requested,
          substituted: matched !== "exact",
          entry: cached.entry,
          message: withSubstituteNote(successMessage(cached.entry, true), requested, cached.entry, matched)
        };
      }

      const extracted = await extractIntoVersion(key, {
        sourceType: "jar",
        sourcePath: candidate.jarPath,
        kind: "file",
        mcVersion: candidate.id,
        label: candidate.id
      });
      if (extracted.ok) {
        return {
          ok: true,
          reused: false,
          matched,
          requestedVersion: requested,
          substituted: matched !== "exact",
          entry: extracted.entry,
          message: withSubstituteNote(successMessage(extracted.entry, false), requested, extracted.entry, matched)
        };
      }
      lastMessage = extracted.message;
    }

    // 3) versions/에서 못 찾으면 resourcepacks/의 최신 팩
    const packs = await listResourcePacks(home.path);
    for (const pack of packs.slice(0, 6)) {
      const baseName = pack.kind === "file" ? pack.label.replace(/\.(zip|jar)$/i, "") : pack.label;
      const version = extractExactVersion(baseName);
      const key = sanitizeVersionKey(version ?? `pack-${baseName}`);

      const cached = await readCachedEntry(key);
      if (cached?.valid) {
        return {
          ok: true,
          reused: true,
          matched: "resourcepack",
          requestedVersion: requested,
          substituted: Boolean(requested),
          entry: cached.entry,
          message: withSubstituteNote(successMessage(cached.entry, true), requested, cached.entry, "resourcepack")
        };
      }

      const extracted = await extractIntoVersion(key, {
        sourceType: "resourcepack",
        sourcePath: pack.fullPath,
        kind: pack.kind,
        mcVersion: version,
        label: baseName
      });
      if (extracted.ok) {
        return {
          ok: true,
          reused: false,
          matched: "resourcepack",
          requestedVersion: requested,
          substituted: Boolean(requested && version !== requested),
          entry: extracted.entry,
          message: withSubstituteNote(successMessage(extracted.entry, false), requested, extracted.entry, "resourcepack")
        };
      }
      lastMessage = extracted.message;
    }
  }

  if (!home) {
    return {
      ok: false,
      reason: "no-install",
      message:
        "마인크래프트 설치 경로를 찾지 못했습니다. 「리소스팩 / JAR 직접 선택」으로 .jar 또는 리소스팩을 골라 주세요."
    };
  }

  return {
    ok: false,
    reason: lastMessage ? "no-textures" : "invalid-source",
    message:
      lastMessage ||
      `${home.path} 에서 versions/*.jar나 resourcepacks/ 텍스처를 찾지 못했습니다. 「리소스팩 / JAR 직접 선택」으로 골라 주세요.`
  };
}

async function syncFromPath(targetPath: string): Promise<McLibrarySyncResult> {
  const stats = await fs.stat(targetPath).catch(() => null);
  if (!stats) {
    return { ok: false, reason: "invalid-source", message: "선택한 경로를 찾을 수 없습니다." };
  }
  const actualKind = stats.isDirectory() ? "folder" : "file";
  const baseName =
    actualKind === "file" ? path.basename(targetPath).replace(/\.(jar|zip)$/i, "") : path.basename(targetPath);
  const isJar = actualKind === "file" && targetPath.toLowerCase().endsWith(".jar");
  const version = isJar ? extractVersionFromName(baseName) : extractExactVersion(baseName);
  const key = sanitizeVersionKey(version ?? `pack-${baseName}`);
  const sourceType: McLibrarySourceType =
    actualKind === "folder" ? "manual-pack" : isJar ? "manual-jar" : "manual-pack";

  const cached = await readCachedEntry(key);
  if (cached?.valid) {
    return {
      ok: true,
      reused: true,
      matched: "manual",
      requestedVersion: null,
      substituted: false,
      entry: cached.entry,
      message: successMessage(cached.entry, true)
    };
  }

  const extracted = await extractIntoVersion(key, {
    sourceType,
    sourcePath: targetPath,
    kind: actualKind,
    mcVersion: version,
    label: baseName
  });

  if (!extracted.ok) {
    return { ok: false, reason: "no-textures", message: extracted.message };
  }
  return {
    ok: true,
    reused: false,
    matched: "manual",
    requestedVersion: null,
    substituted: false,
    entry: extracted.entry,
    message: successMessage(extracted.entry, false)
  };
}

export function syncMcLibrary(targetMcVersion?: string | null): Promise<McLibrarySyncResult> {
  const target = typeof targetMcVersion === "string" ? targetMcVersion : null;
  return enqueue(() => performSync(target));
}

export async function pickMcLibraryPack(): Promise<McLibrarySyncResult> {
  const choice = await dialog.showMessageBox({
    type: "question",
    title: "공용 마크 리소스 라이브러리",
    message: "어디에서 텍스처를 가져올까요?",
    detail:
      "마인크래프트 .jar 파일이나 리소스팩 .zip 파일, 압축을 푼 리소스팩 폴더를 고를 수 있습니다. 고른 파일은 읽기만 하고 옮기지 않습니다.",
    buttons: ["JAR / ZIP 파일", "리소스팩 폴더", "취소"],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  });

  if (choice.response === 2) {
    return { ok: false, reason: "canceled", message: "취소했습니다." };
  }

  if (choice.response === 0) {
    const result = await dialog.showOpenDialog({
      title: "마인크래프트 JAR 또는 리소스팩 ZIP 선택",
      buttonLabel: "이 파일 사용",
      properties: ["openFile"],
      filters: [
        { name: "마인크래프트 JAR / 리소스팩 ZIP", extensions: ["jar", "zip"] },
        { name: "모든 파일", extensions: ["*"] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, reason: "canceled", message: "취소했습니다." };
    }
    const picked = result.filePaths[0];
    return enqueue(() => syncFromPath(picked));
  }

  const result = await dialog.showOpenDialog({
    title: "리소스팩 폴더 선택",
    buttonLabel: "이 폴더 사용",
    properties: ["openDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, reason: "canceled", message: "취소했습니다." };
  }
  const picked = result.filePaths[0];
  return enqueue(() => syncFromPath(picked));
}

export async function getMcLibraryStatus(): Promise<McLibraryStatus> {
  const root = sharedLibraryRoot();
  const dirents = await fs.readdir(root, { withFileTypes: true }).catch(() => [] as Dirent[]);
  const entries: McLibraryEntry[] = [];
  for (const dirent of dirents) {
    if (!dirent.isDirectory() || dirent.name.startsWith(".")) {
      continue;
    }
    const cached = await readCachedEntry(dirent.name);
    if (cached) {
      entries.push(cached.entry);
    }
  }
  entries.sort((left, right) => {
    const versionOrder = compareMcVersions(right.mcVersion ?? right.label, left.mcVersion ?? left.label);
    return versionOrder !== 0 ? versionOrder : left.label.localeCompare(right.label, "ko");
  });
  return {
    libraryRoot: root,
    entries,
    totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    detection: await detectMinecraft()
  };
}

export async function removeMcLibraryVersion(versionKey: string): Promise<McLibraryStatus> {
  const raw = typeof versionKey === "string" ? versionKey.trim() : "";
  const key = sanitizeVersionKey(raw);
  if (!raw || key !== raw || key.startsWith(".")) {
    throw new Error("올바르지 않은 버전 키입니다.");
  }
  const root = sharedLibraryRoot();
  const target = path.resolve(root, key);
  if (!isInside(root, target) || target === root) {
    throw new Error("공용 라이브러리 밖의 폴더는 삭제할 수 없습니다.");
  }
  await fs.rm(target, { recursive: true, force: true });
  return getMcLibraryStatus();
}
