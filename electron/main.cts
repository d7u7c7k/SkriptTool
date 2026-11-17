import { app, BrowserWindow, dialog, ipcMain } from "electron";
import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const SKIP_DIRECTORIES = new Set(["node_modules", "dist", "dist-electron", "release", ".git", ".vscode", ".idea"]);
const MAX_DEPTH = 6;

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
