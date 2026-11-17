import { useCallback, useState } from "react";
import {
  createWorkspaceFile,
  normalizeSkriptFileName,
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

export function useWorkspace(onStatus: (message: string) => void) {
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);

  const activeTab = tabs.find((tab) => tab.path === activePath) ?? null;

  /** 새 프로젝트/폴더로 전환합니다. 이전 프로젝트의 탭은 모두 닫습니다. */
  const loadWorkspace = useCallback(async (next: WorkspaceState, preferredRelativePath?: string | null) => {
    const file =
      (preferredRelativePath ? findFileByRelativePath(next.tree, preferredRelativePath) : undefined) ?? firstFile(next.tree);
    setWorkspace(next);
    if (!file) {
      setTabs([]);
      setActivePath(null);
      return null;
    }
    const content = await readWorkspaceFile(next, file.path);
    setTabs([
      {
        path: file.path,
        name: file.name,
        relativePath: file.relativePath,
        content,
        savedContent: content
      }
    ]);
    setActivePath(file.path);
    return file;
  }, []);

  const closeWorkspace = useCallback(() => {
    setWorkspace(null);
    setTabs([]);
    setActivePath(null);
  }, []);

  const hasDirtyTabs = tabs.some((tab) => isTabDirty(tab));

  const openFile = useCallback(
    async (node: FileNode) => {
      if (!workspace) {
        return;
      }
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

  const refresh = useCallback(async () => {
    if (!workspace) {
      return;
    }
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
      if (!workspace) {
        return false;
      }
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
      if (!workspace) {
        return false;
      }
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
    if (!tab || !workspace) {
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
    hasDirtyTabs,
    loadWorkspace,
    closeWorkspace,
    openFile,
    refresh,
    createFile,
    saveTab,
    saveTabAs,
    updateContent,
    closeTab,
    activateTab: setActivePath
  };
}
