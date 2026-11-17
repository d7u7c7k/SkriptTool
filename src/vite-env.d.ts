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
};

interface Window {
  skriptApi?: SkriptApi;
}
