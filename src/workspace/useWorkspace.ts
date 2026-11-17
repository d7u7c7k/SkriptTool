import { useCallback, useMemo, useState } from "react";
import {
  createWelcomeWorkspace,
  createWorkspaceFile,
  normalizeSkriptFileName,
  openWorkspaceFolder,
  readWorkspaceFile,
  refreshWorkspace,
  saveWorkspaceFileAs,
  writeWorkspaceFile
} from "./fileSystem";
import { findFileByRelativePath, firstFile, isTabDirty, type FileNode, type OpenTab, type WorkspaceState } from "./types";

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return typeof error === "string" ? error : "알 수 없는 오류가 발생했습니다.";
}

function newFileTemplate(relativePath: string): string {
  const name = relativePath.split("/").pop() ?? relativePath;
  return `# ${name}\n# 여기에 Skript 코드를 작성하세요. 오른쪽 "코드 흐름"에서 실행 순서를 확인할 수 있습니다.\n\n`;
}

/** 새 워크스페이스에 속한 탭인지 확인합니다. (저장하지 않은 탭은 항상 유지) */
function isTabInsideRoot(tabPath: string, rootPath: string): boolean {
  if (rootPath.startsWith("memory://")) {
    return tabPath.startsWith("memory://");
  }
  if (rootPath.startsWith("browser://")) {
    return tabPath.startsWith("browser://");
  }
  if (tabPath === rootPath) {
    return true;
  }
  const base = /[\\/]$/.test(rootPath) ? rootPath : `${rootPath}/`;
  const baseAlt = /[\\/]$/.test(rootPath) ? rootPath : `${rootPath}\\`;
  return tabPath.startsWith(base) || tabPath.startsWith(baseAlt);
}

export function useWorkspace(onStatus: (message: string) => void) {
  const welcome = useMemo(() => createWelcomeWorkspace(), []);
  const [workspace, setWorkspace] = useState<WorkspaceState>(welcome.state);
  const [tabs, setTabs] = useState<OpenTab[]>(() => (welcome.initialFile ? [welcome.initialFile] : []));
  const [activePath, setActivePath] = useState<string | null>(welcome.initialFile?.path ?? null);

  const activeTab = tabs.find((tab) => tab.path === activePath) ?? null;

  const openFile = useCallback(
    async (node: FileNode) => {
      if (tabs.some((tab) => tab.path === node.path)) {
        setActivePath(node.path);
        return;
      }
      try {
        const content = await readWorkspaceFile(workspace, node.path);
        setTabs((previous) =>
          previous.some((tab) => tab.path === node.path)
            ? previous
            : [
                ...previous,
                {
                  path: node.path,
                  name: node.name,
                  relativePath: node.relativePath,
                  content,
                  savedContent: content
                }
              ]
        );
        setActivePath(node.path);
      } catch (error) {
        onStatus(`열기 실패: ${describeError(error)}`);
      }
    },
    [onStatus, tabs, workspace]
  );

  const openFolder = useCallback(async () => {
    try {
      const next = await openWorkspaceFolder();
      if (!next) {
        return;
      }
      const file = firstFile(next.tree);
      let content: string | null = null;
      if (file) {
        content = await readWorkspaceFile(next, file.path);
      }

      setWorkspace(next);
      setTabs((previous) => {
        const kept = previous.filter((tab) => isTabInsideRoot(tab.path, next.root.path) || isTabDirty(tab));
        if (file && content !== null && !kept.some((tab) => tab.path === file.path)) {
          kept.push({
            path: file.path,
            name: file.name,
            relativePath: file.relativePath,
            content,
            savedContent: content
          });
        }
        return kept;
      });

      if (file) {
        setActivePath(file.path);
        onStatus(`${next.root.name} 폴더를 열었습니다.`);
      } else {
        const fallback = tabs.find((tab) => isTabDirty(tab))?.path ?? null;
        setActivePath(fallback);
        onStatus(`${next.root.name} 폴더를 열었지만 .sk 파일이 없습니다.`);
      }
    } catch (error) {
      onStatus(`폴더 열기 실패: ${describeError(error)}`);
    }
  }, [onStatus, tabs]);

  const refresh = useCallback(async () => {
    try {
      const next = await refreshWorkspace(workspace);
      setWorkspace(next);
      onStatus("파일 트리를 새로고침했습니다.");
    } catch (error) {
      onStatus(`새로고침 실패: ${describeError(error)}`);
    }
  }, [onStatus, workspace]);

  const createFile = useCallback(
    async (rawName: string): Promise<boolean> => {
      try {
        const relativePath = normalizeSkriptFileName(rawName);
        if (findFileByRelativePath(workspace.tree, relativePath)) {
          throw new Error("이미 같은 이름의 파일이 있습니다.");
        }
        const content = newFileTemplate(relativePath);
        const created = await createWorkspaceFile(workspace, relativePath, content);
        const next = await refreshWorkspace(workspace);
        setWorkspace(next);
        setTabs((previous) => [
          ...previous,
          {
            path: created.path,
            name: created.name,
            relativePath: created.relativePath ?? relativePath,
            content,
            savedContent: content
          }
        ]);
        setActivePath(created.path);
        onStatus(`${relativePath} 파일을 만들었습니다.`);
        return true;
      } catch (error) {
        onStatus(`새 파일 실패: ${describeError(error)}`);
        return false;
      }
    },
    [onStatus, workspace]
  );

  const saveTab = useCallback(
    async (path?: string): Promise<boolean> => {
      const tab = tabs.find((item) => item.path === (path ?? activePath));
      if (!tab) {
        return false;
      }
      try {
        await writeWorkspaceFile(workspace, tab.path, tab.content);
        setTabs((previous) =>
          previous.map((item) => (item.path === tab.path ? { ...item, savedContent: item.content } : item))
        );
        onStatus(`${tab.name} 저장 완료`);
        return true;
      } catch (error) {
        onStatus(`저장 실패: ${describeError(error)}`);
        return false;
      }
    },
    [activePath, onStatus, tabs, workspace]
  );

  const saveTabAs = useCallback(async () => {
    const tab = activeTab;
    if (!tab) {
      return;
    }
    try {
      const result = await saveWorkspaceFileAs(workspace, tab.name, tab.content);
      if (!result) {
        return;
      }
      setTabs((previous) =>
        previous.map((item) =>
          item.path === tab.path
            ? {
                ...item,
                path: result.path,
                name: result.name,
                relativePath: result.relativePath ?? item.relativePath,
                savedContent: item.content
              }
            : item
        )
      );
      setActivePath(result.path);
      if (workspace.kind !== "electron") {
        setWorkspace(await refreshWorkspace(workspace));
      }
      onStatus(`다른 이름으로 저장: ${result.name}`);
    } catch (error) {
      onStatus(`저장 실패: ${describeError(error)}`);
    }
  }, [activeTab, onStatus, workspace]);

  const updateContent = useCallback((path: string, content: string) => {
    setTabs((previous) => previous.map((tab) => (tab.path === path ? { ...tab, content } : tab)));
  }, []);

  const closeTab = useCallback(
    (path: string) => {
      const index = tabs.findIndex((tab) => tab.path === path);
      const next = tabs.filter((tab) => tab.path !== path);
      setTabs(next);
      if (activePath === path) {
        const fallback = next[Math.min(Math.max(index, 0), next.length - 1)];
        setActivePath(fallback ? fallback.path : null);
      }
    },
    [activePath, tabs]
  );

  return {
    workspace,
    tabs,
    activeTab,
    activePath,
    openFile,
    openFolder,
    refresh,
    createFile,
    saveTab,
    saveTabAs,
    updateContent,
    closeTab,
    activateTab: setActivePath
  };
}
