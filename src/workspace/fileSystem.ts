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

const memoryFiles = new Map<string, string>(sampleProject.map((file) => [file.relativePath, file.content]));
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

export function createWelcomeWorkspace(): { state: WorkspaceState; initialFile: OpenTab | null } {
  const tree = buildTree(
    [...memoryFiles.keys()].map((relativePath) => ({ relativePath })),
    memoryPath
  );
  const root = { name: "예제 프로젝트", path: MEMORY_ROOT_PATH };
  const file = firstFile(tree);
  const initialFile = file
    ? {
        path: file.path,
        name: file.name,
        relativePath: file.relativePath,
        content: memoryFiles.get(file.relativePath) ?? "",
        savedContent: memoryFiles.get(file.relativePath) ?? ""
      }
    : null;

  return { state: { kind: "memory", root, tree }, initialFile };
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

export async function openWorkspaceFolder(): Promise<WorkspaceState | null> {
  const api = window.skriptApi;
  if (api) {
    const snapshot = await api.openFolder();
    return snapshot ? { ...snapshot, kind: "electron" } : null;
  }

  if (!supportsDirectoryPicker()) {
    throw new Error("이 환경에서는 폴더 열기를 지원하지 않습니다. 예제 워크스페이스를 사용합니다.");
  }

  const handle = await pickDirectory();
  browserRootHandle = handle;
  const snapshot = await scanBrowserDirectory(handle);
  return { ...snapshot, kind: "browser" };
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

  const tree = buildTree(
    [...memoryFiles.keys()].map((relativePath) => ({ relativePath })),
    memoryPath
  );
  return { ...workspace, tree };
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
  const content = memoryFiles.get(relativePath);
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
  memoryFiles.set(relativePathFromMemory(path), content);
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

  if (memoryFiles.has(relativePath)) {
    throw new Error("이미 같은 이름의 파일이 있습니다.");
  }
  memoryFiles.set(relativePath, content);
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

  // 마지막 폴백: 예제 워크스페이스에 내보내기 폴더로 저장
  const relativePath = `exports/${suggestedName.endsWith(".sk") ? suggestedName : `${suggestedName}.sk`}`;
  memoryFiles.set(relativePath, content);
  return { path: memoryPath(relativePath), name: relativePath.split("/").pop() ?? suggestedName, relativePath };
}
