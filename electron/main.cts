import { app, BrowserWindow, dialog, ipcMain } from "electron";
import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const SKIP_DIRECTORIES = new Set(["node_modules", "dist", "dist-electron", "release", ".git", ".vscode", ".idea"]);
const MAX_DEPTH = 6;
const CONFIG_FILE = ".skripttool.json";
const MAIN_FILE = "main.sk";

type FileNodeDto = { kind: "file"; name: string; path: string; relativePath: string };
type FolderNodeDto = {
  kind: "folder";
  name: string;
  path: string;
  relativePath: string;
  children: TreeNodeDto[];
};
type TreeNodeDto = FileNodeDto | FolderNodeDto;

/** 사용자가 이 세션에서 직접 연 폴더와 파일만 렌더러가 읽고 쓸 수 있습니다. */
const allowedRoots = new Set<string>();
const allowedFiles = new Set<string>();

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveAllowed(target: string): string {
  const resolved = path.resolve(target);
  for (const root of allowedRoots) {
    if (isInside(root, resolved)) {
      return resolved;
    }
  }
  if (allowedFiles.has(resolved)) {
    return resolved;
  }
  throw new Error("허용되지 않은 경로입니다. 먼저 폴더를 열어 주세요.");
}

function requireRoot(rootPath: string): string {
  const resolved = path.resolve(rootPath);
  if (!allowedRoots.has(resolved)) {
    throw new Error("먼저 폴더를 열어 주세요.");
  }
  return resolved;
}

async function buildTree(directory: string, base = "", depth = 0): Promise<TreeNodeDto[]> {
  if (depth > MAX_DEPTH) {
    return [];
  }

  let entries: Dirent[] = [];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const folders: FolderNodeDto[] = [];
  const files: FileNodeDto[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    const relativePath = base ? `${base}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) {
        continue;
      }
      const children = await buildTree(fullPath, relativePath, depth + 1);
      if (children.length > 0) {
        folders.push({ kind: "folder", name: entry.name, path: fullPath, relativePath, children });
      }
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".sk")) {
      files.push({ kind: "file", name: entry.name, path: fullPath, relativePath });
    }
  }

  folders.sort((left, right) => left.name.localeCompare(right.name, "ko"));
  files.sort((left, right) => left.name.localeCompare(right.name, "ko"));
  return [...folders, ...files];
}

async function snapshot(rootPath: string) {
  const tree = await buildTree(rootPath);
  return { root: { name: path.basename(rootPath), path: rootPath }, tree };
}

async function readConfigText(rootPath: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(rootPath, CONFIG_FILE), "utf8");
  } catch {
    return null;
  }
}

/** 프로젝트 폴더 이름으로 쓸 수 없는 문자를 제거합니다. 경로 탈출도 함께 막습니다. */
function sanitizeFolderName(input: string): string {
  const cleaned = input
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .trim();
  if (!cleaned) {
    throw new Error("프로젝트 이름에 쓸 수 있는 글자가 없습니다. 다른 이름을 입력해 주세요.");
  }
  return cleaned.slice(0, 80);
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1024,
    minHeight: 680,
    title: "SkriptTool v2",
    backgroundColor: "#0d1015",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.once("ready-to-show", () => window.show());

  if (isDev) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    void window.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

ipcMain.handle("project:pickParent", async () => {
  const result = await dialog.showOpenDialog({
    title: "새 프로젝트를 만들 상위 폴더 선택",
    buttonLabel: "이 폴더 선택",
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return path.resolve(result.filePaths[0]);
});

ipcMain.handle(
  "project:create",
  async (_event, parentPath: string, folderName: string, configText: string, mainContent: string) => {
    const parent = path.resolve(String(parentPath));
    const parentStats = await fs.stat(parent).catch(() => null);
    if (!parentStats || !parentStats.isDirectory()) {
      throw new Error("상위 폴더를 찾을 수 없습니다. 저장 위치를 다시 선택해 주세요.");
    }

    const folder = sanitizeFolderName(String(folderName));
    const root = path.join(parent, folder);
    if (!isInside(parent, root) || root === parent) {
      throw new Error("프로젝트 폴더 경로가 올바르지 않습니다.");
    }

    const existing = await fs.stat(root).catch(() => null);
    if (existing) {
      if (!existing.isDirectory()) {
        throw new Error(`같은 이름의 파일이 이미 있습니다: ${folder}`);
      }
      const entries = await fs.readdir(root);
      if (entries.length > 0) {
        throw new Error(`"${folder}" 폴더가 이미 있고 비어 있지 않습니다. 다른 이름을 써 주세요.`);
      }
    } else {
      await fs.mkdir(root, { recursive: true });
    }

    await fs.writeFile(path.join(root, CONFIG_FILE), configText, "utf8");
    await fs.writeFile(path.join(root, MAIN_FILE), mainContent, "utf8");

    allowedRoots.add(root);
    const tree = await buildTree(root);
    return { root: { name: path.basename(root), path: root }, tree, config: configText };
  }
);

ipcMain.handle("project:open", async () => {
  const result = await dialog.showOpenDialog({
    title: "Skript 프로젝트 폴더 열기",
    buttonLabel: "프로젝트 열기",
    properties: ["openDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const rootPath = path.resolve(result.filePaths[0]);
  allowedRoots.add(rootPath);
  const tree = await buildTree(rootPath);
  return {
    root: { name: path.basename(rootPath), path: rootPath },
    tree,
    config: await readConfigText(rootPath)
  };
});

ipcMain.handle("project:openAt", async (_event, targetPath: string) => {
  // 최근 프로젝트 목록에서 바로 여는 경로입니다. 렌더러는 로컬 앱 코드뿐이고,
  // 실제로 존재하는 폴더만 열리도록 여기서 한 번 더 확인합니다.
  const rootPath = path.resolve(String(targetPath));
  const stats = await fs.stat(rootPath).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    throw new Error("프로젝트 폴더를 찾을 수 없습니다. 이동되었거나 삭제되었을 수 있습니다.");
  }
  allowedRoots.add(rootPath);
  const tree = await buildTree(rootPath);
  return {
    root: { name: path.basename(rootPath), path: rootPath },
    tree,
    config: await readConfigText(rootPath)
  };
});

ipcMain.handle("project:readConfig", async (_event, rootPath: string) => {
  const root = requireRoot(rootPath);
  return readConfigText(root);
});

ipcMain.handle("project:writeConfig", async (_event, rootPath: string, configText: string) => {
  const root = requireRoot(rootPath);
  await fs.writeFile(path.join(root, CONFIG_FILE), configText, "utf8");
});

ipcMain.handle("workspace:openFolder", async () => {
  const result = await dialog.showOpenDialog({
    title: "Skript 프로젝트 폴더 열기",
    properties: ["openDirectory", "createDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const rootPath = path.resolve(result.filePaths[0]);
  allowedRoots.add(rootPath);
  return snapshot(rootPath);
});

ipcMain.handle("workspace:refresh", async (_event, rootPath: string) => {
  return snapshot(requireRoot(rootPath));
});

ipcMain.handle("workspace:readFile", async (_event, filePath: string) => {
  const resolved = resolveAllowed(filePath);
  return fs.readFile(resolved, "utf8");
});

ipcMain.handle("workspace:writeFile", async (_event, filePath: string, content: string) => {
  const resolved = resolveAllowed(filePath);
  await fs.writeFile(resolved, content, "utf8");
});

ipcMain.handle("workspace:createFile", async (_event, rootPath: string, relativePath: string, content: string) => {
  const root = requireRoot(rootPath);
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");

  if (!normalized || normalized.split("/").some((segment) => segment === ".." || segment === ".")) {
    throw new Error("사용할 수 없는 파일 경로입니다.");
  }
  if (!/\.sk$/i.test(normalized)) {
    throw new Error(".sk 파일만 만들 수 있습니다.");
  }

  const target = path.resolve(root, normalized);
  if (!isInside(root, target) || target === root) {
    throw new Error("워크스페이스 밖에는 파일을 만들 수 없습니다.");
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  try {
    await fs.writeFile(target, content, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("이미 같은 이름의 파일이 있습니다.");
    }
    throw error;
  }

  allowedFiles.add(target);
  return { path: target, name: path.basename(target), relativePath: normalized };
});

ipcMain.handle("workspace:saveAs", async (_event, suggestedName: string, content: string) => {
  const result = await dialog.showSaveDialog({
    title: "Skript 파일로 저장",
    defaultPath: suggestedName.toLowerCase().endsWith(".sk") ? suggestedName : `${suggestedName}.sk`,
    filters: [{ name: "Skript", extensions: ["sk"] }]
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  const target = path.resolve(result.filePath);
  await fs.writeFile(target, content, "utf8");
  allowedFiles.add(target);
  return { path: target, name: path.basename(target) };
});

void app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
