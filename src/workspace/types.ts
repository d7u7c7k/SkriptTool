export type WorkspaceKind = "memory" | "browser" | "electron";

export type WorkspaceRoot = {
  name: string;
  path: string;
};

export type FileNode = {
  kind: "file";
  name: string;
  path: string;
  relativePath: string;
};

export type FolderNode = {
  kind: "folder";
  name: string;
  path: string;
  relativePath: string;
  children: TreeNode[];
};

export type TreeNode = FileNode | FolderNode;

export type WorkspaceSnapshot = {
  root: WorkspaceRoot;
  tree: TreeNode[];
};

export type WorkspaceState = WorkspaceSnapshot & {
  kind: WorkspaceKind;
};

export type OpenTab = {
  path: string;
  name: string;
  relativePath: string;
  content: string;
  savedContent: string;
};

export type SaveResult = {
  path: string;
  name: string;
  relativePath?: string;
};

export function isTabDirty(tab: OpenTab): boolean {
  return tab.content !== tab.savedContent;
}

export function firstFile(tree: TreeNode[]): FileNode | undefined {
  // 현재 폴더의 파일을 먼저 고르고, 없으면 하위 폴더로 내려갑니다.
  for (const node of tree) {
    if (node.kind === "file") {
      return node;
    }
  }
  for (const node of tree) {
    if (node.kind === "folder") {
      const nested = firstFile(node.children);
      if (nested) {
        return nested;
      }
    }
  }
  return undefined;
}

export function findFileByRelativePath(tree: TreeNode[], relativePath: string): FileNode | undefined {
  for (const node of tree) {
    if (node.kind === "file") {
      if (node.relativePath === relativePath) {
        return node;
      }
    } else {
      const nested = findFileByRelativePath(node.children, relativePath);
      if (nested) {
        return nested;
      }
    }
  }
  return undefined;
}

export function countFiles(tree: TreeNode[]): number {
  return tree.reduce((total, node) => total + (node.kind === "file" ? 1 : countFiles(node.children)), 0);
}
