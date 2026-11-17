import { PROJECT_CONFIG_FILE } from "../project/types";
import { pickDirectory, pickSaveFile, supportsDirectoryPicker, supportsSaveFilePicker, type DirectoryHandleLike, type FileHandleLike } from "./fsAccess";
import { sampleProject } from "./sampleProject";
import {
  firstFile,
  type FileNode,
  type FolderNode,
  type OpenTab,
  type SaveResult,
  type TreeNode,
  type WorkspaceSnapshot,
  type WorkspaceState
} from "./types";

const MEMORY_SCHEME = "memory://";
const BROWSER_SCHEME = "browser://";
const MEMORY_ROOT_PATH = `${MEMORY_SCHEME}/`;
const SKIP_FOLDERS = new Set(["node_modules", "dist", "dist-electron", "release", ".git", ".vscode"]);

type MemoryProject = {
  rootName: string;
  files: Map<string, string>;
  configText: string | null;
};

function freshMemoryProject(): MemoryProject {
  return {
    rootName: "예제 프로젝트",
    files: new Map(sampleProject.map((file) => [file.relativePath, file.content])),
    configText: null
  };
}

let memoryProject: MemoryProject = freshMemoryProject();
let browserRootHandle: DirectoryHandleLike | null = null;
const browserSavedHandles = new Map<string, FileHandleLike>();

export function memoryPath(relativePath: string): string {
  return `${MEMORY_SCHEME}${relativePath}`;
}

export function relativePathFromMemory(path: string): string {
  return path.startsWith(MEMORY_SCHEME) ? path.slice(MEMORY_SCHEME.length) : path;
}

function relativePathFromBrowser(path: string): string {
  return path.startsWith(BROWSER_SCHEME) ? path.slice(BROWSER_SCHEME.length) : path;
}

type TreeEntry = { relativePath: string };

type RawFolder = {
  folders: Map<string, RawFolder>;
  files: Array<{ name: string; relativePath: string }>;
};

function buildTree(entries: TreeEntry[], pathFor: (relativePath: string) => string): TreeNode[] {
  const root: RawFolder = { folders: new Map(), files: [] };

  for (const entry of entries) {
    const segments = entry.relativePath.split("/").filter(Boolean);
    if (segments.length === 0) {
      continue;
    }
    const fileName = segments.pop();
    if (!fileName) {
      continue;
    }
    let cursor = root;
    for (const segment of segments) {
      let next = cursor.folders.get(segment);
      if (!next) {
        next = { folders: new Map(), files: [] };
        cursor.folders.set(segment, next);
      }
      cursor = next;
    }
    cursor.files.push({ name: fileName, relativePath: entry.relativePath });
  }

  const convert = (folder: RawFolder, base: string): TreeNode[] => {
    const folderNodes: FolderNode[] = [...folder.folders.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "ko"))
      .map(([name, child]) => {
        const relativePath = base ? `${base}/${name}` : name;
        return {
          kind: "folder",
          name,
          path: pathFor(relativePath),
          relativePath,
          children: convert(child, relativePath)
        };
      });
    const fileNodes: FileNode[] = folder.files
      .sort((left, right) => left.name.localeCompare(right.name, "ko"))
      .map((file) => ({
        kind: "file",
        name: file.name,
        path: pathFor(file.relativePath),
        relativePath: file.relativePath
      }));
    return [...folderNodes, ...fileNodes];
  };

  return convert(root, "");
}

function memoryWorkspace(): WorkspaceState {
  const tree = buildTree(
    [...memoryProject.files.keys()].map((relativePath) => ({ relativePath })),
    memoryPath
  );
  return { kind: "memory", root: { name: memoryProject.rootName, path: MEMORY_ROOT_PATH }, tree };
}

function firstTabFor(state: WorkspaceState, content: string, file: FileNode): OpenTab {
  return {
    path: file.path,
    name: file.name,
    relativePath: file.relativePath,
    content,
    savedContent: content
  };
}

/** 예제 워크스페이스(메모리)를 새로 만듭니다. */
export function createExampleWorkspace(configText: string | null): { state: WorkspaceState; initialFile: OpenTab | null } {
  memoryProject = freshMemoryProject();
  memoryProject.configText = configText;
  const state = memoryWorkspace();
  const file = firstFile(state.tree);
  const initialFile = file ? firstTabFor(state, memoryProject.files.get(file.relativePath) ?? "", file) : null;
  return { state, initialFile };
}

/** 브라우저 폴백·예제용 인메모리 프로젝트를 만듭니다. */
export function createMemoryProject(
  name: string,
  mainContent: string,
  configText: string
): { state: WorkspaceState; initialFile: OpenTab | null } {
  memoryProject = {
    rootName: name,
    files: new Map([["main.sk", mainContent]]),
    configText
  };
  const state = memoryWorkspace();
  const file = firstFile(state.tree);
  const initialFile = file ? firstTabFor(state, memoryProject.files.get(file.relativePath) ?? "", file) : null;
  return { state, initialFile };
}

export function detectWorkspaceKind(): WorkspaceState["kind"] {
  if (window.skriptApi) {
    return "electron";
  }
  return supportsDirectoryPicker() ? "browser" : "memory";
}

async function scanBrowserDirectory(handle: DirectoryHandleLike): Promise<WorkspaceSnapshot> {
  const entries: TreeEntry[] = [];

  const walk = async (directory: DirectoryHandleLike, base: string, depth: number): Promise<void> => {
    if (depth > 6) {
      return;
    }
    for await (const entry of directory.values()) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      if (entry.kind === "directory") {
        if (SKIP_FOLDERS.has(entry.name)) {
          continue;
        }
        await walk(entry, base ? `${base}/${entry.name}` : entry.name, depth + 1);
      } else if (/\.sk$/i.test(entry.name)) {
        entries.push({ relativePath: base ? `${base}/${entry.name}` : entry.name });
      }
    }
  };

  await walk(handle, "", 0);

  return {
    root: { name: handle.name, path: `${BROWSER_SCHEME}/` },
    tree: buildTree(entries, (relativePath) => `${BROWSER_SCHEME}${relativePath}`)
  };
}

async function readBrowserConfigText(handle: DirectoryHandleLike): Promise<string | null> {
  try {
    const fileHandle = await handle.getFileHandle(PROJECT_CONFIG_FILE, { create: false });
    const file = await fileHandle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

async function writeBrowserConfigText(handle: DirectoryHandleLike, text: string): Promise<void> {
  const fileHandle = await handle.getFileHandle(PROJECT_CONFIG_FILE, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();
}

export type OpenedProject = {
  state: WorkspaceState;
  /** .skripttool.json 원문. 없으면 null (기본값으로 열고 저장하면 됩니다) */
  configText: string | null;
};

/** 폴더 선택 다이얼로그로 프로젝트를 엽니다. */
export async function openProjectFolder(): Promise<OpenedProject | null> {
  const api = window.skriptApi;
  if (api) {
    const opened = await api.openProject();
    if (!opened) {
      return null;
    }
    return {
      state: { kind: "electron", root: opened.root, tree: opened.tree },
      configText: opened.config
    };
  }

  if (!supportsDirectoryPicker()) {
    throw new Error("이 환경에서는 폴더 열기를 지원하지 않습니다. 새 프로젝트를 만들거나 예제 워크스페이스를 사용하세요.");
  }

  const handle = await pickDirectory();
  browserRootHandle = handle;
  const snapshot = await scanBrowserDirectory(handle);
  return {
    state: { ...snapshot, kind: "browser" },
    configText: await readBrowserConfigText(handle)
  };
}

/** 최근 프로젝트 목록에서 경로로 바로 엽니다. (Electron) */
export async function openProjectAtPath(targetPath: string): Promise<OpenedProject> {
  const api = window.skriptApi;
  if (!api) {
    throw new Error("경로로 프로젝트를 여는 기능은 데스크톱 앱에서만 지원합니다.");
  }
  const opened = await api.openProjectAt(targetPath);
  return {
    state: { kind: "electron", root: opened.root, tree: opened.tree },
    configText: opened.config
  };
}

/** Electron: 선택한 상위 폴더 아래에 프로젝트 폴더와 기본 파일을 만듭니다. */
export async function createProjectOnDisk(
  parentPath: string,
  folderName: string,
  configText: string,
  mainContent: string
): Promise<OpenedProject> {
  const api = window.skriptApi;
  if (!api) {
    throw new Error("폴더에 프로젝트를 만드는 기능은 데스크톱 앱에서만 지원합니다.");
  }
  const created = await api.createProject(parentPath, folderName, configText, mainContent);
  return {
    state: { kind: "electron", root: created.root, tree: created.tree },
    configText
  };
}

export async function refreshWorkspace(workspace: WorkspaceState): Promise<WorkspaceState> {
  if (workspace.kind === "electron" && window.skriptApi) {
    const snapshot = await window.skriptApi.refreshFolder(workspace.root.path);
    return { ...snapshot, kind: "electron" };
  }
  if (workspace.kind === "browser") {
    if (!browserRootHandle) {
      throw new Error("폴더 연결이 만료되었습니다. 폴더를 다시 열어 주세요.");
    }
    const snapshot = await scanBrowserDirectory(browserRootHandle);
    return { ...snapshot, kind: "browser" };
  }

  return memoryWorkspace();
}

export async function readProjectConfigText(workspace: WorkspaceState): Promise<string | null> {
  if (workspace.kind === "electron" && window.skriptApi) {
    return window.skriptApi.readProjectConfig(workspace.root.path);
  }
  if (workspace.kind === "browser") {
    if (!browserRootHandle) {
      return null;
    }
    return readBrowserConfigText(browserRootHandle);
  }
  return memoryProject.configText;
}

export async function writeProjectConfigText(workspace: WorkspaceState, text: string): Promise<void> {
  if (workspace.kind === "electron" && window.skriptApi) {
    await window.skriptApi.writeProjectConfig(workspace.root.path, text);
    return;
  }
  if (workspace.kind === "browser") {
    if (!browserRootHandle) {
      throw new Error("폴더 연결이 만료되었습니다. 폴더를 다시 열어 주세요.");
    }
    await writeBrowserConfigText(browserRootHandle, text);
    return;
  }
  memoryProject.configText = text;
}

async function resolveBrowserFile(relativePath: string, create: boolean) {
  if (!browserRootHandle) {
    throw new Error("먼저 폴더를 열어 주세요.");
  }
  const segments = relativePath.split("/").filter(Boolean);
  const fileName = segments.pop();
  if (!fileName) {
    throw new Error("파일 이름이 비어 있습니다.");
  }
  let directory = browserRootHandle;
  for (const segment of segments) {
    directory = await directory.getDirectoryHandle(segment, { create });
  }
  return directory.getFileHandle(fileName, { create });
}

export async function readWorkspaceFile(workspace: WorkspaceState, path: string): Promise<string> {
  if (workspace.kind === "electron" && window.skriptApi) {
    return window.skriptApi.readFile(path);
  }
  if (workspace.kind === "browser") {
    const handle = await resolveBrowserFile(relativePathFromBrowser(path), false);
    const file = await handle.getFile();
    return file.text();
  }
  const relativePath = relativePathFromMemory(path);
  const content = memoryProject.files.get(relativePath);
  if (content === undefined) {
    throw new Error("파일을 찾을 수 없습니다.");
  }
  return content;
}

export async function writeWorkspaceFile(workspace: WorkspaceState, path: string, content: string): Promise<void> {
  if (workspace.kind === "electron" && window.skriptApi) {
    await window.skriptApi.writeFile(path, content);
    return;
  }
  if (workspace.kind === "browser") {
    const savedHandle = path.startsWith("saved://") ? browserSavedHandles.get(path) : undefined;
    const handle = savedHandle ?? (await resolveBrowserFile(relativePathFromBrowser(path), false));
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    return;
  }
  memoryProject.files.set(relativePathFromMemory(path), content);
}

export function normalizeSkriptFileName(input: string): string {
  const cleaned = input
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/");
  if (!cleaned) {
    throw new Error("파일 이름을 입력해 주세요.");
  }
  if (cleaned.split("/").some((segment) => segment === ".." || segment === ".")) {
    throw new Error("상위 폴더(..)로는 만들 수 없습니다.");
  }
  return /\.sk$/i.test(cleaned) ? cleaned : `${cleaned}.sk`;
}

export async function createWorkspaceFile(
  workspace: WorkspaceState,
  relativePath: string,
  content: string
): Promise<SaveResult & { content: string }> {
  const name = relativePath.split("/").pop() ?? relativePath;

  if (workspace.kind === "electron" && window.skriptApi) {
    const result = await window.skriptApi.createFile(workspace.root.path, relativePath, content);
    return { ...result, content };
  }

  if (workspace.kind === "browser") {
    const handle = await resolveBrowserFile(relativePath, true);
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    return { path: `${BROWSER_SCHEME}${relativePath}`, name, relativePath, content };
  }

  if (memoryProject.files.has(relativePath)) {
    throw new Error("이미 같은 이름의 파일이 있습니다.");
  }
  memoryProject.files.set(relativePath, content);
  return { path: memoryPath(relativePath), name, relativePath, content };
}

export async function saveWorkspaceFileAs(
  workspace: WorkspaceState,
  suggestedName: string,
  content: string
): Promise<SaveResult | null> {
  if (workspace.kind === "electron" && window.skriptApi) {
    return window.skriptApi.saveFileAs(suggestedName, content);
  }

  if (workspace.kind === "browser" && supportsSaveFilePicker()) {
    const handle = await pickSaveFile(suggestedName);
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    const savedPath = `saved://${handle.name}`;
    browserSavedHandles.set(savedPath, handle);
    return { path: savedPath, name: handle.name };
  }

  // 마지막 폴백: 현재 메모리 프로젝트의 exports 폴더로 저장
  const relativePath = `exports/${suggestedName.endsWith(".sk") ? suggestedName : `${suggestedName}.sk`}`;
  memoryProject.files.set(relativePath, content);
  return { path: memoryPath(relativePath), name: relativePath.split("/").pop() ?? suggestedName, relativePath };
}
