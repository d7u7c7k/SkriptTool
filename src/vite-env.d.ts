/// <reference types="vite/client" />

type WorkspaceRootDto = {
  name: string;
  path: string;
};

type TreeNodeDto =
  | { kind: "file"; name: string; path: string; relativePath: string }
  | { kind: "folder"; name: string; path: string; relativePath: string; children: TreeNodeDto[] };

type WorkspaceSnapshotDto = {
  root: WorkspaceRootDto;
  tree: TreeNodeDto[];
};

type OpenedProjectDto = WorkspaceSnapshotDto & {
  /** `.skripttool.json` 원문 (없으면 null) */
  config: string | null;
};

type CreatedFileDto = {
  path: string;
  name: string;
  relativePath: string;
};

type SavedFileDto = {
  path: string;
  name: string;
};

type McLibrarySourceTypeDto = "jar" | "resourcepack" | "manual-jar" | "manual-pack";

type McLibraryEntryDto = {
  versionKey: string;
  mcVersion: string | null;
  label: string;
  sourceType: McLibrarySourceTypeDto;
  sourcePath: string | null;
  itemCount: number;
  blockCount: number;
  textureCount: number;
  bytes: number;
  createdAt: string;
};

type McLibraryDetectionDto = {
  mcHome: string | null;
  mcHomeSource: "env" | "default" | null;
  installedVersions: string[];
  latestVersion: string | null;
  resourcePacks: string[];
};

type McLibraryStatusDto = {
  libraryRoot: string;
  entries: McLibraryEntryDto[];
  totalBytes: number;
  detection: McLibraryDetectionDto;
};

type McLibrarySyncResultDto =
  | {
      ok: true;
      reused: boolean;
      matched: "cached" | "exact" | "same-line" | "latest" | "resourcepack" | "manual";
      requestedVersion: string | null;
      substituted: boolean;
      entry: McLibraryEntryDto;
      message: string;
    }
  | {
      ok: false;
      reason: "no-install" | "no-textures" | "invalid-source" | "canceled" | "failed";
      message: string;
    };

type SkriptApi = {
  platform: string;
  openFolder: () => Promise<WorkspaceSnapshotDto | null>;
  refreshFolder: (rootPath: string) => Promise<WorkspaceSnapshotDto>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  createFile: (rootPath: string, relativePath: string, content: string) => Promise<CreatedFileDto>;
  saveFileAs: (suggestedName: string, content: string) => Promise<SavedFileDto | null>;
  pickProjectLocation: () => Promise<string | null>;
  createProject: (
    parentPath: string,
    folderName: string,
    configText: string,
    mainContent: string
  ) => Promise<OpenedProjectDto>;
  openProject: () => Promise<OpenedProjectDto | null>;
  openProjectAt: (targetPath: string) => Promise<OpenedProjectDto>;
  readProjectConfig: (rootPath: string) => Promise<string | null>;
  writeProjectConfig: (rootPath: string, configText: string) => Promise<void>;
  /** Electron에서만 제공됩니다. 브라우저 모드에서는 undefined입니다. */
  mcLibrary?: {
    getStatus: () => Promise<McLibraryStatusDto>;
    sync: (targetMcVersion: string | null) => Promise<McLibrarySyncResultDto>;
    pickPack: () => Promise<McLibrarySyncResultDto>;
    removeVersion: (versionKey: string) => Promise<McLibraryStatusDto>;
  };
};

interface Window {
  skriptApi?: SkriptApi;
}
