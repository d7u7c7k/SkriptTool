import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import {
  Bug,
  CheckCircle2,
  FileCode2,
  FolderOpen,
  Package,
  Play,
  Save,
  Search,
  Settings,
  TerminalSquare,
  Wand2
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { createDefaultEnvironment, type EnvironmentConfig } from "./catalog";
import { ExtensionsPanel } from "./catalog/ExtensionsPanel";
import { registerSkriptLanguage } from "./skriptLanguage";
import {
  applyGeneratedAtMarker,
  defaultInventoryBuilder,
  defaultSendBuilder,
  generateInventoryLines,
  generateSendLines,
  InventoryToolPanel,
  inventoryLayouts,
  openToolFromEditorLine,
  SendToolPanel,
  ToolDock,
  type InventoryBuilder,
  type SendBuilder,
  type ToolId
} from "./tools";

const starterScript = `options:
  prefix: &6[SkriptTool]

on right click with grass block:
  @tool:inventory

command /hello:
  trigger:
    @tool:send
`;

type OpenFile = {
  name: string;
  path?: string;
  handle?: FileSystemFileHandle;
  content: string;
  dirty: boolean;
};

type ActiveView = "explorer" | "setup" | "functions" | "search" | "run" | "problems" | "settings";
type PanelView = "terminal" | "problems";
type Severity = "error" | "warning" | "info";

type Diagnostic = {
  line: number;
  severity: Severity;
  message: string;
  tip: string;
  example: string;
};

function diagnoseSkript(content: string): Diagnostic[] {
  return content.split(/\r\n|\r|\n/).flatMap((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    const diagnostics: Diagnostic[] = [];

    if (/^@tool(?::|\s+)inventory\s*$/i.test(trimmed)) {
      diagnostics.push({
        line: lineNumber,
        severity: "info",
        message: "@tool:inventory — 오른쪽 Tool 탭에서 GUI를 편집하세요.",
        tip: "슬롯에 아이템을 배치한 뒤 Apply로 코드를 생성합니다.",
        example: 'open chest inventory with 1 row named "상점" to player'
      });
    }

    if (/^@tool(?::|\s+)send\s*$/i.test(trimmed)) {
      diagnostics.push({
        line: lineNumber,
        severity: "info",
        message: "@tool:send — 오른쪽 Tool 탭에서 메시지를 작성하세요.",
        tip: "채팅/타이틀/액션바를 고른 뒤 Apply로 코드를 생성합니다.",
        example: 'send "&a안녕하세요" to player'
      });
    }

    if (/^on\s+rightclick\s+with\b/i.test(trimmed)) {
      diagnostics.push({
        line: lineNumber,
        severity: "warning",
        message: "버전에 따라 rightclick 표기가 인식되지 않을 수 있습니다.",
        tip: "Skript 버전별로 이벤트 표기가 다르게 동작할 수 있으니 right click 표기를 권장합니다.",
        example: "on right click with grass block:"
      });
    }

    if (/to\s+player"\s*$/i.test(trimmed)) {
      diagnostics.push({
        line: lineNumber,
        severity: "error",
        message: "줄 끝에 불필요한 따옴표가 있습니다.",
        tip: "player 뒤의 따옴표를 제거해야 합니다.",
        example: 'open chest inventory with 1 row named "상점" to player'
      });
    }

    if (/set\s+slot\s+\d+\s+of\s+player's\s+current\s+inventory/i.test(trimmed)) {
      diagnostics.push({
        line: lineNumber,
        severity: "warning",
        message: "인벤토리 슬롯 번호는 보통 0부터 시작합니다.",
        tip: "사용자에게 보이는 5번째 칸이면 실제 slot 4가 맞을 수 있습니다.",
        example: "set slot 4 of player's current inventory to golden apple"
      });
    }

    return diagnostics;
  });
}

export function App() {
  const [file, setFile] = useState<OpenFile>({
    name: "welcome.sk",
    content: starterScript,
    dirty: false
  });
  const [activeView, setActiveView] = useState<ActiveView>("explorer");
  const [panelView, setPanelView] = useState<PanelView>("problems");
  const [status, setStatus] = useState("Ready");
  const [environment, setEnvironment] = useState<EnvironmentConfig>(() => createDefaultEnvironment());
  const [builder, setBuilder] = useState<InventoryBuilder>(defaultInventoryBuilder);
  const [sendBuilder, setSendBuilder] = useState<SendBuilder>(defaultSendBuilder);
  const [selectedSlots, setSelectedSlots] = useState<number[]>([4]);
  const [selectedItem, setSelectedItem] = useState("golden apple");
  const [toolDockOpen, setToolDockOpen] = useState(true);
  const [activeTool, setActiveTool] = useState<ToolId>("send");
  const [markerLine, setMarkerLine] = useState<number | undefined>(undefined);
  const [markerIndent, setMarkerIndent] = useState("");

  const fallbackFileInput = useRef<HTMLInputElement>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);

  const diagnostics = useMemo(() => diagnoseSkript(file.content), [file.content]);
  const lineCount = useMemo(() => file.content.split(/\r\n|\r|\n/).length, [file.content]);
  const diagnosticsCount = useMemo(
    () => ({
      error: diagnostics.filter((item) => item.severity === "error").length,
      warning: diagnostics.filter((item) => item.severity === "warning").length
    }),
    [diagnostics]
  );

  const inventoryLayout = inventoryLayouts[builder.inventoryType] ?? inventoryLayouts.chest;
  const inventorySlotCount = builder.inventoryType === "chest" ? builder.rows * 9 : inventoryLayout.slots;

  useEffect(() => {
    setSelectedSlots((current) => current.filter((slot) => slot < inventorySlotCount));
    setBuilder((current) => ({
      ...current,
      slots: Object.fromEntries(Object.entries(current.slots).filter(([slot]) => Number(slot) < inventorySlotCount))
    }));
  }, [inventorySlotCount]);

  useEffect(() => {
    const monaco = monacoRef.current;
    const currentEditor = editorRef.current;
    const model = currentEditor?.getModel();

    if (!monaco || !currentEditor || !model) {
      return;
    }

    monaco.editor.setModelMarkers(
      model,
      "skript-tool",
      diagnostics.map((item) => ({
        startLineNumber: item.line,
        endLineNumber: item.line,
        startColumn: 1,
        endColumn: model.getLineMaxColumn(item.line),
        message: `${item.message}\nTIP: ${item.tip}\n예시: ${item.example}`,
        severity:
          item.severity === "error"
            ? monaco.MarkerSeverity.Error
            : item.severity === "warning"
              ? monaco.MarkerSeverity.Warning
              : monaco.MarkerSeverity.Info
      }))
    );

    decorationsRef.current = currentEditor.deltaDecorations(
      decorationsRef.current,
      diagnostics.map((item) => ({
        range: new monaco.Range(item.line, 1, item.line, 1),
        options: {
          isWholeLine: true,
          className: item.severity === "error" ? "line-error" : item.severity === "warning" ? "line-warning" : "line-info"
        }
      }))
    );
  }, [diagnostics]);

  const handleEditorMount: OnMount = (mountedEditor, monaco) => {
    editorRef.current = mountedEditor;
    monacoRef.current = monaco;
    registerSkriptLanguage(monaco);
    mountedEditor.onDidChangeCursorPosition((event) => {
      const lineContent = mountedEditor.getModel()?.getLineContent(event.position.lineNumber) ?? "";
      const request = openToolFromEditorLine(lineContent, event.position.lineNumber);
      if (request) {
        setActiveTool(request.toolId);
        setMarkerLine(request.markerLine);
        setMarkerIndent(request.indent);
        setToolDockOpen(true);
        if (request.toolId === "send") {
          setSendBuilder(defaultSendBuilder);
        }
        setStatus(`Opened @tool:${request.toolId}`);
      }
    });
  };

  async function openFile() {
    if (!window.skriptApi) {
      fallbackFileInput.current?.click();
      return;
    }

    const opened = await window.skriptApi.openSkript();
    if (!opened) {
      return;
    }

    setFile({ name: opened.name, path: opened.path, content: opened.content, dirty: false });
    setStatus(`Opened ${opened.name}`);
  }

  async function saveFile() {
    if (!window.skriptApi) {
      const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name.endsWith(".sk") ? file.name : `${file.name}.sk`;
      anchor.click();
      URL.revokeObjectURL(url);
      setFile((current) => ({ ...current, dirty: false }));
      setStatus(`Saved ${file.name}`);
      return;
    }

    const saved = await window.skriptApi.saveSkript({ path: file.path, content: file.content });
    if (!saved) {
      return;
    }

    setFile((current) => ({ ...current, name: saved.name, path: saved.path, dirty: false }));
    setStatus(`Saved ${saved.name}`);
  }

  async function handleFallbackOpen(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";

    if (!selectedFile) {
      return;
    }

    const content = await selectedFile.text();
    setFile({ name: selectedFile.name, content, dirty: false });
    setStatus(`Opened ${selectedFile.name}`);
  }

  function applyInventoryBuilder() {
    setFile((current) => ({
      ...current,
      content: applyGeneratedAtMarker(current.content, "inventory", generateInventoryLines(builder), {
        preferredLine: markerLine,
        lockedIndent: markerIndent
      }),
      dirty: true
    }));
    setPanelView("problems");
    setStatus("Applied inventory GUI to code");
  }

  function applySendBuilder() {
    setFile((current) => ({
      ...current,
      content: applyGeneratedAtMarker(current.content, "send", generateSendLines(sendBuilder), {
        preferredLine: markerLine,
        lockedIndent: markerIndent
      }),
      dirty: true
    }));
    setSendBuilder(defaultSendBuilder);
    setPanelView("problems");
    setStatus("Applied send tool to code");
  }

  function renderSidebar() {
    if (activeView === "setup") {
      return <ExtensionsPanel environment={environment} onChange={setEnvironment} onStatus={setStatus} />;
    }

    if (activeView === "problems") {
      return (
        <>
          <div className="sidebar-header">
            <span>PROBLEMS</span>
            <button title="Run diagnostics" onClick={() => setStatus("Diagnostics refreshed")}>
              <CheckCircle2 size={16} />
            </button>
          </div>
          <section className="workspace-block">
            {diagnostics.length === 0 ? (
              <div className="empty-note">No problems</div>
            ) : (
              diagnostics.map((item, index) => (
                <button
                  className={`problem-row ${item.severity}`}
                  key={`${item.line}-${index}`}
                  onClick={() => {
                    editorRef.current?.revealLineInCenter(item.line);
                    editorRef.current?.setPosition({ lineNumber: item.line, column: 1 });
                  }}
                >
                  <span>Line {item.line}</span>
                  <strong>{item.message}</strong>
                </button>
              ))
            )}
          </section>
        </>
      );
    }

    if (activeView === "search") {
      return (
        <>
          <div className="sidebar-header">
            <span>SEARCH</span>
          </div>
          <section className="workspace-block form-stack">
            <input placeholder="Search in current file" onChange={(event) => setStatus(`Search: ${event.target.value}`)} />
            <div className="empty-note">현재 파일 검색 UI 자리입니다.</div>
          </section>
        </>
      );
    }

    if (activeView === "run") {
      return (
        <>
          <div className="sidebar-header">
            <span>RUN</span>
            <button title="Run diagnostics" onClick={() => setPanelView("problems")}>
              <Play size={16} />
            </button>
          </div>
          <section className="workspace-block form-stack">
            <button className="wide-command" onClick={() => setPanelView("problems")}>
              Run diagnostics
            </button>
            <button className="wide-command" onClick={() => setStatus("Server console integration is planned")}>
              Server console
            </button>
          </section>
        </>
      );
    }

    if (activeView === "settings") {
      return (
        <>
          <div className="sidebar-header">
            <span>SETTINGS</span>
          </div>
          <section className="workspace-block form-stack">
            <div className="setting-line">
              <span>Editor</span>
              <strong>Monaco</strong>
            </div>
            <div className="setting-line">
              <span>Packaging</span>
              <strong>NSIS exe</strong>
            </div>
          </section>
        </>
      );
    }

    if (activeView === "functions") {
      return (
        <>
          <div className="sidebar-header">
            <span>TOOLS</span>
          </div>
          <section className="workspace-block form-stack">
            <button
              className="wide-command"
              onClick={() => {
                setSendBuilder(defaultSendBuilder);
                setActiveTool("send");
                setToolDockOpen(true);
              }}
            >
              Open Send tool
            </button>
            <button
              className="wide-command"
              onClick={() => {
                setActiveTool("inventory");
                setToolDockOpen(true);
              }}
            >
              Open Inventory tool
            </button>
            <div className="empty-note">에디터에 @tool: 을 입력한 뒤 자동완성으로도 열 수 있습니다.</div>
          </section>
        </>
      );
    }

    return (
      <>
        <div className="sidebar-header">
          <span>EXPLORER</span>
          <button title="Open Skript file" onClick={openFile}>
            <FolderOpen size={16} />
          </button>
        </div>
        <section className="workspace-block">
          <div className="workspace-title">SKRIPT WORKSPACE</div>
          <button className="file-row selected" onClick={() => setStatus(`Focused ${file.name}`)}>
            <FileCode2 size={16} />
            <span>{file.name}</span>
            {file.dirty && <span className="dirty-dot" aria-label="Unsaved changes" />}
          </button>
          <div className="environment-summary">
            <span>MC {environment.minecraftVersion}</span>
            <span>Skript {environment.skriptVersion}</span>
            <span>{environment.addons.length} addons</span>
          </div>
        </section>
      </>
    );
  }

  return (
    <main className="app-shell">
      <input ref={fallbackFileInput} className="hidden-file-input" type="file" accept=".sk,text/plain" onChange={handleFallbackOpen} />

      <aside className="activity-bar" aria-label="Primary navigation">
        <button className={`activity ${activeView === "explorer" ? "active" : ""}`} title="Explorer" onClick={() => setActiveView("explorer")}>
          <FileCode2 size={21} />
        </button>
        <button className={`activity ${activeView === "setup" ? "active" : ""}`} title="Extensions" onClick={() => setActiveView("setup")}>
          <Package size={21} />
        </button>
        <button
          className={`activity ${activeView === "functions" ? "active" : ""}`}
          title="Tools"
          onClick={() => {
            setActiveView("functions");
            setToolDockOpen(true);
          }}
        >
          <Wand2 size={21} />
        </button>
        <button className={`activity ${activeView === "search" ? "active" : ""}`} title="Search" onClick={() => setActiveView("search")}>
          <Search size={21} />
        </button>
        <button className={`activity ${activeView === "run" ? "active" : ""}`} title="Run" onClick={() => setActiveView("run")}>
          <Play size={21} />
        </button>
        <button className={`activity ${activeView === "problems" ? "active" : ""}`} title="Problems" onClick={() => setActiveView("problems")}>
          <Bug size={21} />
        </button>
        <button className={`activity bottom ${activeView === "settings" ? "active" : ""}`} title="Settings" onClick={() => setActiveView("settings")}>
          <Settings size={21} />
        </button>
      </aside>

      <aside className="sidebar">{renderSidebar()}</aside>

      <section className="workbench">
        <header className="titlebar">
          <div className="tab active-tab">
            <FileCode2 size={15} />
            <span>{file.name}</span>
            {file.dirty && <span className="unsaved">*</span>}
          </div>
          <div className="toolbar">
            <button title="Open Skript file" onClick={openFile}>
              <FolderOpen size={17} />
            </button>
            <button title="Save Skript file" onClick={saveFile}>
              <Save size={17} />
            </button>
            <button
              title="Run diagnostics"
              onClick={() => {
                setActiveView("problems");
                setPanelView("problems");
                setStatus("Diagnostics refreshed");
              }}
            >
              <CheckCircle2 size={17} />
            </button>
          </div>
        </header>

        <div className={`main-area ${toolDockOpen ? "" : "dock-closed"}`}>
          <div className="editor-area">
            <Editor
              height="100%"
              language="skript"
              theme="vs-dark"
              value={file.content}
              onMount={handleEditorMount}
              onChange={(value) => setFile((current) => ({ ...current, content: value ?? "", dirty: true }))}
              options={{
                fontFamily: "JetBrains Mono, Consolas, 'Courier New', monospace",
                fontSize: 14,
                minimap: { enabled: true },
                smoothScrolling: true,
                tabSize: 2,
                wordWrap: "on",
                automaticLayout: true,
                tabCompletion: "on",
                suggestOnTriggerCharacters: true,
                acceptSuggestionOnEnter: "on",
                scrollBeyondLastLine: false,
                renderWhitespace: "selection"
              }}
            />
          </div>

          {toolDockOpen && (
            <ToolDock
              activeTool={activeTool}
              onActiveToolChange={(toolId) => {
                setActiveTool(toolId);
                if (toolId === "send") {
                  setSendBuilder(defaultSendBuilder);
                }
                setStatus(`Switched to @tool:${toolId}`);
              }}
              onClose={() => setToolDockOpen(false)}
            >
              {activeTool === "send" ? (
                <SendToolPanel builder={sendBuilder} onChange={setSendBuilder} onApply={applySendBuilder} />
              ) : (
                <InventoryToolPanel
                  builder={builder}
                  selectedSlots={selectedSlots}
                  selectedItem={selectedItem}
                  minecraftVersion={environment.minecraftVersion}
                  onBuilderChange={setBuilder}
                  onSelectedSlotsChange={setSelectedSlots}
                  onSelectedItemChange={setSelectedItem}
                  onStatus={setStatus}
                  onApply={applyInventoryBuilder}
                />
              )}
            </ToolDock>
          )}
        </div>

        <section className="panel">
          <div className="panel-tabs">
            <button className={`panel-tab ${panelView === "terminal" ? "active-panel" : ""}`} onClick={() => setPanelView("terminal")}>
              <TerminalSquare size={15} />
              Terminal
            </button>
            <button className={`panel-tab ${panelView === "problems" ? "active-panel" : ""}`} onClick={() => setPanelView("problems")}>
              <Bug size={15} />
              Problems {diagnostics.length}
            </button>
          </div>
          {panelView === "terminal" ? (
            <div className="terminal-output">
              <div>$ skript-tool --status</div>
              <div>Ready · {status}</div>
            </div>
          ) : (
            <div className="problems-panel">
              {diagnostics.length === 0 ? (
                <div className="empty-note">No problems detected.</div>
              ) : (
                diagnostics.map((item, index) => (
                  <div className={`problem-detail ${item.severity}`} key={`panel-${item.line}-${index}`}>
                    <strong>
                      Line {item.line}: {item.message}
                    </strong>
                    <span>TIP: {item.tip}</span>
                    <code>{item.example}</code>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        <footer className="statusbar">
          <span>{status}</span>
          <span>
            Ln {lineCount} · Err {diagnosticsCount.error} · Warn {diagnosticsCount.warning}
          </span>
          <span>
            MC {environment.minecraftVersion} · Skript {environment.skriptVersion}
          </span>
        </footer>
      </section>
    </main>
  );
}
