import {
  FilePlus2,
  Folder,
  FolderOpen,
  ListTree,
  PanelLeft,
  Settings as SettingsIcon,
  Sparkles
} from "lucide-react";
import type { editor } from "monaco-editor";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDefaultEnvironment, type EnvironmentConfig } from "./catalog";
import { analyzeDiagnostics } from "./diagnostics/analyze";
import { DiagnosticBar } from "./diagnostics/DiagnosticBar";
import { countDiagnostics } from "./diagnostics/types";
import { SkriptEditor } from "./editor/SkriptEditor";
import { EnvironmentMenu } from "./environment/EnvironmentMenu";
import { normalizeEnvironment } from "./environment/normalize";
import { FlowInspector } from "./inspector/FlowInspector";
import { usePersistentState } from "./lib/usePersistentState";
import { SettingsPanel } from "./settings/SettingsPanel";
import { defaultEditorSettings, sanitizeEditorSettings, type EditorSettings } from "./settings/types";
import { useTheme } from "./theme/ThemeProvider";
import { FileTree } from "./workspace/FileTree";
import { TabBar } from "./workspace/TabBar";
import { isTabDirty, type OpenTab } from "./workspace/types";
import { useWorkspace } from "./workspace/useWorkspace";

function normalizeSettings(value: unknown): EditorSettings | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return sanitizeEditorSettings(value as Partial<EditorSettings>);
}

function WelcomeScreen({ onNewFile, onOpenFolder }: { onNewFile: () => void; onOpenFolder: () => void }) {
  return (
    <div className="welcome">
      <div className="welcome-mark">S</div>
      <h1>손으로 쓰는 Skript</h1>
      <p className="welcome-sub">
        AI가 대신 써 주지 않습니다. 대신 <strong>어떤 흐름으로 실행되는지</strong> 옆에서 짚어 줍니다.
      </p>
      <div className="welcome-actions">
        <button className="primary-btn" onClick={onNewFile}>
          <FilePlus2 size={15} /> 새 스크립트
        </button>
        <button className="ghost-btn" onClick={onOpenFolder}>
          <FolderOpen size={15} /> 폴더 열기
        </button>
      </div>
      <div className="welcome-grid">
        <div>
          <h4>
            <ListTree size={14} /> 코드 흐름
          </h4>
          <p>트리거 → 조건 → 반복 → 실행 순서를 한국어로 보여 줍니다.</p>
        </div>
        <div>
          <h4>
            <Sparkles size={14} /> 실시간 진단
          </h4>
          <p>매 틱 반복, 넓은 loop, 전역 변수 남용을 미리 알려 줍니다.</p>
        </div>
        <div>
          <h4>
            <SettingsIcon size={14} /> 커스텀 테마
          </h4>
          <p>배경·패널·강조색·폰트를 바꾸고 저장할 수 있습니다.</p>
        </div>
      </div>
      <div className="welcome-shortcuts">
        <span>
          <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>S</kbd> 저장
        </span>
        <span>
          <kbd>Shift</kbd> + <kbd>S</kbd> 다른 이름으로
        </span>
        <span>
          <kbd>O</kbd> 폴더 열기
        </span>
        <span>
          <kbd>B</kbd> 사이드바
        </span>
        <span>
          <kbd>Shift</kbd> + <kbd>I</kbd> 코드 흐름
        </span>
      </div>
    </div>
  );
}

export function App() {
  const { theme } = useTheme();
  const defaultEnvironment = useMemo(() => createDefaultEnvironment(), []);
  const [environment, setEnvironment] = usePersistentState<EnvironmentConfig>(
    "skripttool.environment.v2",
    defaultEnvironment,
    normalizeEnvironment
  );
  const [editorSettings, setEditorSettings] = usePersistentState<EditorSettings>(
    "skripttool.editor.v2",
    defaultEditorSettings,
    normalizeSettings
  );

  const [status, setStatus] = useState("예제 워크스페이스로 시작합니다 · 오른쪽 코드 흐름을 확인하세요");
  const { workspace, tabs, activeTab, activePath, openFile, openFolder, refresh, createFile, saveTab, saveTabAs, updateContent, closeTab, activateTab } =
    useWorkspace(setStatus);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creatingFile, setCreatingFile] = useState(false);
  const [pendingClose, setPendingClose] = useState<OpenTab | null>(null);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const diagnostics = useMemo(() => (activeTab ? analyzeDiagnostics(activeTab.content) : []), [activeTab]);
  const counts = useMemo(() => countDiagnostics(diagnostics), [diagnostics]);
  const lineCount = useMemo(() => (activeTab ? activeTab.content.split(/\r\n|\r|\n/).length : 0), [activeTab]);

  useEffect(() => {
    setCursor({ line: 1, column: 1 });
  }, [activePath]);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        if (event.shiftKey) {
          void saveTabAs();
        } else {
          void saveTab();
        }
      } else if (key === "o") {
        event.preventDefault();
        void openFolder();
      } else if (key === "n") {
        event.preventDefault();
        startNewFile();
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
  }, [openFolder, saveTab, saveTabAs, startNewFile]);

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

  const kindLabel = workspace.kind === "electron" ? "로컬 폴더" : workspace.kind === "browser" ? "브라우저 폴더" : "예제 워크스페이스";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">S</span>
          <span className="brand-name">SkriptTool</span>
          <span className="brand-version">v2</span>
        </div>

        <div className="topbar-project" title={workspace.root.path}>
          <Folder size={13} />
          <span className="project-name">{workspace.root.name}</span>
          <span className="project-sep">·</span>
          <span className="project-mode">{kindLabel}</span>
        </div>

        <div className="topbar-spacer" />

        <div className="topbar-actions">
          {!sidebarOpen && (
            <button className="icon-btn" title="사이드바 열기 (Ctrl/Cmd+B)" onClick={() => setSidebarOpen(true)}>
              <PanelLeft size={16} />
            </button>
          )}
          <EnvironmentMenu environment={environment} onChange={setEnvironment} onStatus={setStatus} />
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
              workspace={workspace}
              activePath={activePath}
              onOpenFile={(node) => void openFile(node)}
              onOpenFolder={() => void openFolder()}
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
                <WelcomeScreen onNewFile={startNewFile} onOpenFolder={() => void openFolder()} />
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

          <DiagnosticBar diagnostics={diagnostics} onJump={jumpToLine} />

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
            <span className="status-item">
              MC {environment.minecraftVersion} · Skript {environment.skriptVersion}
            </span>
            <span className="status-item status-theme" title="현재 테마">
              {theme.name}
            </span>
          </footer>
        </main>
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={editorSettings}
        onSettingsChange={setEditorSettings}
        onStatus={setStatus}
      />

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
    </div>
  );
}
