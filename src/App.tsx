import {
  Boxes,
  FilePlus2,
  Folder,
  House,
  ListTree,
  PanelLeft,
  Settings as SettingsIcon
} from "lucide-react";
import type { editor } from "monaco-editor";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddonManager } from "./addons/AddonManager";
import { createDefaultEnvironment, findAddonPackage, toggleAddon, type EnvironmentConfig } from "./catalog";
import { analyzeDiagnostics } from "./diagnostics/analyze";
import { DiagnosticBar } from "./diagnostics/DiagnosticBar";
import { countDiagnostics } from "./diagnostics/types";
import { SkriptEditor } from "./editor/SkriptEditor";
import { EnvironmentMenu } from "./environment/EnvironmentMenu";
import { FlowInspector } from "./inspector/FlowInspector";
import { LauncherScreen } from "./launcher/LauncherScreen";
import { NewProjectDialog } from "./launcher/NewProjectDialog";
import { buildProjectConfig, environmentOf, parseProjectConfig, serializeProjectConfig } from "./project/config";
import { forgetProject, loadRecents, rememberProject } from "./project/recents";
import { newProjectMainScript } from "./project/template";
import { PROJECT_CONFIG_FILE, type NewProjectSpec, type RecentProject } from "./project/types";
import { SettingsPanel } from "./settings/SettingsPanel";
import { usePersistentState } from "./lib/usePersistentState";
import { defaultEditorSettings, sanitizeEditorSettings, type EditorSettings } from "./settings/types";
import { setAddonFixHandler, setCompletionEnvironment } from "./skriptLanguage";
import { useTheme } from "./theme/ThemeProvider";
import {
  createExampleWorkspace,
  createMemoryProject,
  createProjectOnDisk,
  openProjectAtPath,
  openProjectFolder,
  writeProjectConfigText,
  type OpenedProject
} from "./workspace/fileSystem";
import { FileTree } from "./workspace/FileTree";
import { TabBar } from "./workspace/TabBar";
import { isTabDirty, type OpenTab, type WorkspaceState } from "./workspace/types";
import { useWorkspace } from "./workspace/useWorkspace";

type Screen = "launcher" | "editor";

function normalizeSettings(value: unknown): EditorSettings | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return sanitizeEditorSettings(value as Partial<EditorSettings>);
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return typeof error === "string" ? error : "알 수 없는 오류가 발생했습니다.";
}

const EXAMPLE_PROJECT_NAME = "예제 프로젝트";

export function App() {
  const { theme } = useTheme();

  const [screen, setScreen] = useState<Screen>("launcher");
  const [status, setStatus] = useState("새 프로젝트를 만들거나 최근 프로젝트를 여세요.");
  const [environment, setEnvironment] = useState<EnvironmentConfig | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectCreatedAt, setProjectCreatedAt] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentProject[]>(() => loadRecents());
  const [busy, setBusy] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [focusAddonId, setFocusAddonId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [editorSettings, setEditorSettings] = usePersistentState<EditorSettings>(
    "skripttool.editor.v2",
    defaultEditorSettings,
    normalizeSettings
  );

  const {
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
    activateTab
  } = useWorkspace(setStatus);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [creatingFile, setCreatingFile] = useState(false);
  const [pendingClose, setPendingClose] = useState<OpenTab | null>(null);
  const [pendingHome, setPendingHome] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const canPickLocation = Boolean(window.skriptApi);

  const diagnostics = useMemo(
    () => (activeTab && environment ? analyzeDiagnostics(activeTab.content, { environment }) : []),
    [activeTab, environment]
  );
  const counts = useMemo(() => countDiagnostics(diagnostics), [diagnostics]);
  const lineCount = useMemo(() => (activeTab ? activeTab.content.split(/\r\n|\r|\n/).length : 0), [activeTab]);

  useEffect(() => {
    setCursor({ line: 1, column: 1 });
  }, [activePath]);

  useEffect(() => {
    setCompletionEnvironment(environment?.addons ?? []);
  }, [environment]);

  const remember = useCallback((state: WorkspaceState, name: string, env: EnvironmentConfig) => {
    if (state.kind === "memory") {
      return;
    }
    const entry: RecentProject = {
      id: state.root.path,
      name,
      path: state.root.path,
      kind: state.kind,
      minecraftVersion: env.minecraftVersion,
      skriptVersion: env.skriptVersion,
      addonCount: env.addons.length,
      openedAt: new Date().toISOString()
    };
    setRecents((previous) => rememberProject(previous, entry));
  }, []);

  const jumpToLine = useCallback((line: number) => {
    const mounted = editorRef.current;
    if (!mounted) {
      setCursor({ line, column: 1 });
      return;
    }
    mounted.revealLineInCenter(line);
    mounted.setPosition({ lineNumber: line, column: 1 });
    mounted.focus();
  }, []);

  const startNewFile = useCallback(() => {
    setSidebarOpen(true);
    setCreatingFile(true);
  }, []);

  /** `applyOpened` : 열린 폴더/생성된 프로젝트를 편집 화면으로 올립니다. */
  const applyOpened = useCallback(
    async (opened: OpenedProject) => {
      const parsed = parseProjectConfig(opened.configText, opened.state.root.name);
      const env = environmentOf(parsed.config);
      await loadWorkspace(opened.state);
      setProjectName(parsed.config.name);
      setProjectCreatedAt(parsed.config.createdAt ?? null);
      setEnvironment(env);
      setScreen("editor");
      setRecents((previous) => {
        if (opened.state.kind === "memory") {
          return previous;
        }
        return rememberProject(previous, {
          id: opened.state.root.path,
          name: parsed.config.name,
          path: opened.state.root.path,
          kind: opened.state.kind,
          minecraftVersion: env.minecraftVersion,
          skriptVersion: env.skriptVersion,
          addonCount: env.addons.length,
          openedAt: new Date().toISOString()
        });
      });

      if (!opened.configText || parsed.recovered) {
        const config = buildProjectConfig(parsed.config.name, env, {
          createdAt: parsed.config.createdAt
        });
        await writeProjectConfigText(opened.state, serializeProjectConfig(config));
        setStatus(
          opened.configText
            ? `${parsed.config.name}: 설정 파일을 읽지 못해 기본값으로 열고 새로 저장했습니다.`
            : `${parsed.config.name} 폴더에 설정 파일이 없어 기본값으로 열고 .skripttool.json을 저장했습니다.`
        );
      } else {
        setStatus(
          `${parsed.config.name} 열기 완료 · MC ${env.minecraftVersion} · Skript ${env.skriptVersion} · 애드온 ${env.addons.length}`
        );
      }
    },
    [loadWorkspace]
  );

  const handleCreateProject = useCallback(
    async (spec: NewProjectSpec) => {
      const config = buildProjectConfig(spec.name, spec.environment);
      const configText = serializeProjectConfig(config);
      const mainContent = newProjectMainScript(spec.name, spec.environment);

      let opened: OpenedProject;
      if (canPickLocation && spec.parentPath) {
        opened = await createProjectOnDisk(spec.parentPath, spec.name, configText, mainContent);
      } else {
        const memory = createMemoryProject(spec.name, mainContent, configText);
        opened = { state: memory.state, configText };
      }

      await applyOpened(opened);
      setNewProjectOpen(false);
      setStatus(
        `"${spec.name}" 프로젝트를 만들었습니다 · MC ${spec.environment.minecraftVersion} · Skript ${
          spec.environment.skriptVersion
        } · 애드온 ${spec.environment.addons.length}`
      );
    },
    [applyOpened, canPickLocation]
  );

  const handleOpenProject = useCallback(async () => {
    setBusy(true);
    try {
      const opened = await openProjectFolder();
      if (!opened) {
        return;
      }
      await applyOpened(opened);
    } catch (error) {
      setStatus(`프로젝트 열기 실패: ${describeError(error)}`);
    } finally {
      setBusy(false);
    }
  }, [applyOpened]);

  const handleOpenRecent = useCallback(
    async (recent: RecentProject) => {
      if (recent.kind !== "electron") {
        setStatus("브라우저 폴더는 보안상 경로로 다시 열 수 없습니다. '프로젝트 열기'로 직접 선택해 주세요.");
        return;
      }
      setBusy(true);
      try {
        const opened = await openProjectAtPath(recent.path);
        await applyOpened(opened);
      } catch (error) {
        setStatus(`프로젝트를 열지 못했습니다: ${describeError(error)}`);
        setRecents((previous) => forgetProject(previous, recent.id));
      } finally {
        setBusy(false);
      }
    },
    [applyOpened]
  );

  const handleBrowseExample = useCallback(async () => {
    const env = createDefaultEnvironment();
    const configText = serializeProjectConfig(buildProjectConfig(EXAMPLE_PROJECT_NAME, env));
    const example = createExampleWorkspace(configText);
    await loadWorkspace(example.state);
    setProjectName(EXAMPLE_PROJECT_NAME);
    setProjectCreatedAt(null);
    setEnvironment(env);
    setScreen("editor");
    setStatus("예제 워크스페이스 · examples/diagnostics.sk 에서 줄 색(빨간줄·노란줄)을 확인해 보세요.");
  }, [loadWorkspace]);

  /** 환경(버전·애드온) 변경 → .skripttool.json 즉시 저장 + 최근 목록 갱신 */
  const persistEnvironment = useCallback(
    async (next: EnvironmentConfig, note: string) => {
      setEnvironment(next);
      if (!workspace) {
        setStatus(note);
        return;
      }
      try {
        const config = buildProjectConfig(projectName || workspace.root.name, next, {
          createdAt: projectCreatedAt ?? undefined
        });
        await writeProjectConfigText(workspace, serializeProjectConfig(config));
        remember(workspace, config.name, next);
        setStatus(`${note} · ${PROJECT_CONFIG_FILE} 저장됨`);
      } catch (error) {
        setStatus(`${note} · 설정 저장 실패: ${describeError(error)}`);
      }
    },
    [projectCreatedAt, projectName, remember, workspace]
  );

  const handleQuickAddAddon = useCallback(
    (addonId: string) => {
      if (!environment) {
        return;
      }
      const result = toggleAddon(environment, addonId);
      const addonName = findAddonPackage(addonId)?.name ?? addonId;
      if (result.blockedReason) {
        setFocusAddonId(addonId);
        setAddonsOpen(true);
        setStatus(`${addonName}을(를) 추가할 수 없습니다: ${result.blockedReason}`);
        return;
      }
      void persistEnvironment(
        result.environment,
        result.added
          ? `${addonName} 애드온을 추가했습니다. 진단과 자동완성이 갱신됩니다.`
          : `${addonName} 애드온을 제거했습니다.`
      );
    },
    [environment, persistEnvironment]
  );

  useEffect(() => {
    setAddonFixHandler(handleQuickAddAddon);
    return () => setAddonFixHandler(null);
  }, [handleQuickAddAddon]);

  const goHome = useCallback(() => {
    setScreen("launcher");
    closeWorkspace();
    setEnvironment(null);
    setProjectName("");
    setProjectCreatedAt(null);
    setStatus("새 프로젝트를 만들거나 최근 프로젝트를 여세요.");
  }, [closeWorkspace]);

  const requestGoHome = useCallback(() => {
    if (hasDirtyTabs) {
      setPendingHome(true);
      return;
    }
    goHome();
  }, [goHome, hasDirtyTabs]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) {
        return;
      }
      const key = event.key.toLowerCase();
      if (screen === "launcher") {
        if (key === "o") {
          event.preventDefault();
          void handleOpenProject();
        } else if (key === "n") {
          event.preventDefault();
          setNewProjectOpen(true);
        }
        return;
      }
      if (key === "s") {
        event.preventDefault();
        if (event.shiftKey) {
          void saveTabAs();
        } else {
          void saveTab();
        }
      } else if (key === "o") {
        event.preventDefault();
        void handleOpenProject();
      } else if (key === "n") {
        event.preventDefault();
        startNewFile();
      } else if (key === "e") {
        event.preventDefault();
        setFocusAddonId(null);
        setAddonsOpen(true);
      } else if (key === "b") {
        event.preventDefault();
        setSidebarOpen((value) => !value);
      } else if (key === "i" && event.shiftKey) {
        event.preventDefault();
        setInspectorOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleOpenProject, saveTab, saveTabAs, screen, startNewFile]);

  const requestClose = (tab: OpenTab) => {
    if (isTabDirty(tab)) {
      setPendingClose(tab);
      return;
    }
    closeTab(tab.path);
  };

  const saveAndClose = async () => {
    if (!pendingClose) {
      return;
    }
    const saved = await saveTab(pendingClose.path);
    if (saved) {
      closeTab(pendingClose.path);
    }
    setPendingClose(null);
  };

  const saveAllAndGoHome = async () => {
    for (const tab of tabs) {
      if (isTabDirty(tab)) {
        await saveTab(tab.path);
      }
    }
    setPendingHome(false);
    goHome();
  };

  const kindLabel =
    workspace?.kind === "electron" ? "로컬 폴더" : workspace?.kind === "browser" ? "브라우저 폴더" : "메모리 프로젝트";
  const configPathLabel = workspace
    ? workspace.kind === "electron"
      ? `${workspace.root.path}/${PROJECT_CONFIG_FILE}`
      : workspace.kind === "browser"
        ? `${PROJECT_CONFIG_FILE} (브라우저 폴더)`
        : `${PROJECT_CONFIG_FILE} (메모리 · 저장 안 됨)`
    : PROJECT_CONFIG_FILE;

  const showEditor = screen === "editor" && workspace && environment;

  return (
    <>
      {!showEditor ? (
        <LauncherScreen
          recents={recents}
          busy={busy}
          status={status}
          onNewProject={() => setNewProjectOpen(true)}
          onOpenProject={() => void handleOpenProject()}
          onOpenRecent={(recent) => void handleOpenRecent(recent)}
          onRemoveRecent={(id) => setRecents((previous) => forgetProject(previous, id))}
          onBrowseExample={() => void handleBrowseExample()}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <div className="app-shell">
          <header className="topbar">
            <button className="brand brand-button" title="시작 화면으로 (프로젝트 목록)" onClick={requestGoHome}>
              <span className="brand-mark">S</span>
              <span className="brand-name">SkriptTool</span>
              <span className="brand-version">v2</span>
            </button>

            <button className="icon-btn" title="시작 화면" onClick={requestGoHome}>
              <House size={15} />
            </button>

            <div className="topbar-project" title={workspace?.root.path}>
              <Folder size={13} />
              <span className="project-name">{projectName || workspace?.root.name}</span>
              <span className="project-sep">·</span>
              <span className="project-mode">{kindLabel}</span>
            </div>

            <div className="topbar-spacer" />

            <div className="topbar-actions">
              <button className="mini-btn" onClick={() => setNewProjectOpen(true)} title="새 프로젝트 만들기">
                <FilePlus2 size={13} /> 새 프로젝트
              </button>
              {!sidebarOpen && (
                <button className="icon-btn" title="사이드바 열기 (Ctrl/Cmd+B)" onClick={() => setSidebarOpen(true)}>
                  <PanelLeft size={16} />
                </button>
              )}
              {environment && (
                <EnvironmentMenu
                  environment={environment}
                  onChange={(next, note) => void persistEnvironment(next, note)}
                  onOpenAddons={() => {
                    setFocusAddonId(null);
                    setAddonsOpen(true);
                  }}
                />
              )}
              <button
                className="icon-btn addon-button"
                title="확장(애드온) 관리 (Ctrl/Cmd+E)"
                onClick={() => {
                  setFocusAddonId(null);
                  setAddonsOpen(true);
                }}
              >
                <Boxes size={16} />
                {environment && environment.addons.length > 0 && (
                  <span className="addon-badge">{environment.addons.length}</span>
                )}
              </button>
              <button
                className={`icon-btn ${inspectorOpen ? "active" : ""}`}
                title="코드 흐름 패널 (Ctrl/Cmd+Shift+I)"
                onClick={() => setInspectorOpen((value) => !value)}
              >
                <ListTree size={16} />
              </button>
              <button className="icon-btn" title="설정" onClick={() => setSettingsOpen(true)}>
                <SettingsIcon size={16} />
              </button>
            </div>
          </header>

          <div className="app-body">
            {sidebarOpen && (
              <aside className="sidebar">
                <FileTree
                  workspace={workspace!}
                  activePath={activePath}
                  onOpenFile={(node) => void openFile(node)}
                  onOpenFolder={() => void handleOpenProject()}
                  onRefresh={() => void refresh()}
                  onCreateFile={createFile}
                  onCollapse={() => setSidebarOpen(false)}
                  creating={creatingFile}
                  onRequestCreate={() => setCreatingFile(true)}
                  onCancelCreate={() => setCreatingFile(false)}
                />
              </aside>
            )}

            <main className="workbench">
              <TabBar
                tabs={tabs}
                activePath={activePath}
                onActivate={activateTab}
                onClose={requestClose}
                onNewFile={startNewFile}
                onSave={() => void saveTab()}
                onSaveAs={() => void saveTabAs()}
                canSave={Boolean(activeTab)}
              />

              <div className={`editor-region ${inspectorOpen && activeTab ? "with-inspector" : ""}`}>
                <div className="editor-area">
                  {activeTab ? (
                    <SkriptEditor
                      tab={activeTab}
                      theme={theme}
                      settings={editorSettings}
                      diagnostics={diagnostics}
                      onContentChange={(value) => updateContent(activeTab.path, value)}
                      onCursorChange={(line, column) => setCursor({ line, column })}
                      onEditorReady={(mounted) => {
                        editorRef.current = mounted;
                      }}
                    />
                  ) : (
                    <div className="editor-empty">
                      <FilePlus2 size={20} />
                      <p>왼쪽에서 .sk 파일을 선택하거나 새 파일을 만드세요.</p>
                      <button className="ghost-btn" onClick={() => setCreatingFile(true)}>
                        새 파일
                      </button>
                    </div>
                  )}
                </div>

                {inspectorOpen && activeTab && (
                  <FlowInspector
                    fileName={activeTab.name}
                    content={activeTab.content}
                    cursorLine={cursor.line}
                    onJump={jumpToLine}
                  />
                )}
              </div>

              <DiagnosticBar
                diagnostics={diagnostics}
                onJump={jumpToLine}
                onAddAddon={handleQuickAddAddon}
                onOpenAddons={() => {
                  setFocusAddonId(null);
                  setAddonsOpen(true);
                }}
              />

              <footer className="statusbar">
                <span className="status-message">{status}</span>
                <span className="status-spacer" />
                <span className="status-item">
                  Ln {cursor.line}, Col {cursor.column}
                </span>
                <span className="status-item">{lineCount}줄</span>
                <span className={`status-item ${counts.errors > 0 ? "has-error" : ""}`}>
                  오류 {counts.errors} · 경고 {counts.warnings} · 팁 {counts.tips}
                </span>
                <button
                  className="status-item status-link"
                  onClick={() => {
                    setFocusAddonId(null);
                    setAddonsOpen(true);
                  }}
                  title="확장(애드온) 관리"
                >
                  MC {environment?.minecraftVersion} · Skript {environment?.skriptVersion} · 애드온{" "}
                  {environment?.addons.length ?? 0}
                </button>
                <span className="status-item status-theme" title="현재 테마">
                  {theme.name}
                </span>
              </footer>
            </main>
          </div>
        </div>
      )}

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={editorSettings}
        onSettingsChange={setEditorSettings}
        onStatus={setStatus}
      />

      <NewProjectDialog
        open={newProjectOpen}
        canPickLocation={canPickLocation}
        defaultName="새 프로젝트"
        onClose={() => setNewProjectOpen(false)}
        onPickLocation={async () => (window.skriptApi ? window.skriptApi.pickProjectLocation() : null)}
        onCreate={handleCreateProject}
      />

      {environment && (
        <AddonManager
          open={addonsOpen}
          environment={environment}
          configPathLabel={configPathLabel}
          focusAddonId={focusAddonId}
          onClose={() => {
            setAddonsOpen(false);
            setFocusAddonId(null);
          }}
          onChange={(next) => void persistEnvironment(next, "확장 구성을 바꿨습니다.")}
        />
      )}

      {pendingClose && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPendingClose(null);
            }
          }}
        >
          <div className="confirm-dialog" role="dialog" aria-label="저장하지 않은 변경">
            <h3>저장하지 않은 변경</h3>
            <p>
              <strong>{pendingClose.name}</strong> 파일에 저장하지 않은 변경이 있습니다.
            </p>
            <div className="dialog-actions">
              <button className="ghost-btn" onClick={() => setPendingClose(null)}>
                취소
              </button>
              <button
                className="ghost-btn danger"
                onClick={() => {
                  closeTab(pendingClose.path);
                  setPendingClose(null);
                }}
              >
                저장 안 함
              </button>
              <button className="primary-btn" onClick={() => void saveAndClose()}>
                저장 후 닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingHome && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPendingHome(false);
            }
          }}
        >
          <div className="confirm-dialog" role="dialog" aria-label="시작 화면으로 이동">
            <h3>시작 화면으로 이동</h3>
            <p>저장하지 않은 파일이 있습니다. 홈으로 돌아가기 전에 저장할까요?</p>
            <div className="dialog-actions">
              <button className="ghost-btn" onClick={() => setPendingHome(false)}>
                취소
              </button>
              <button
                className="ghost-btn danger"
                onClick={() => {
                  setPendingHome(false);
                  goHome();
                }}
              >
                저장 안 함
              </button>
              <button className="primary-btn" onClick={() => void saveAllAndGoHome()}>
                모두 저장 후 이동
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
