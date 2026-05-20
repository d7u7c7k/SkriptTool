import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import {
  Bug,
  CheckCircle2,
  Code2,
  FileCode2,
  FolderOpen,
  GitBranch,
  PackagePlus,
  Play,
  Save,
  Search,
  Settings,
  TerminalSquare,
  Trash2,
  X,
  Wand2
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { registerSkriptLanguage } from "./skriptLanguage";

const starterScript = `options:
  prefix: &6[SkriptTool]

on rightclick with grass block:
  @tool inventory

command /hello:
  trigger:
    send "{@prefix} &fHello, %player%!" to player
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

type Addon = {
  id: number;
  name: string;
  version: string;
};

type EnvironmentConfig = {
  minecraftVersion: string;
  skriptVersion: string;
  addons: Addon[];
};

type InventoryBuilder = {
  inventoryType: string;
  rows: number;
  title: string;
  slots: Record<number, string>;
};

type SendBuilder = {
  mode: "message" | "title" | "subtitle" | "actionbar";
  target: "player" | "all players" | "console";
  content: string;
  subtitle: string;
  fadeIn: number;
  stay: number;
  fadeOut: number;
};

type Diagnostic = {
  line: number;
  severity: Severity;
  message: string;
  tip: string;
  example: string;
};

const addonCatalog = ["SkBee", "SkQuery", "Skellett", "skript-reflect", "TuSKe", "SkRayFall"];
const minecraftVersions = ["1.21.4", "1.21.1", "1.20.6", "1.20.4", "1.19.4"];
const skriptVersions = ["2.10.0", "2.9.5", "2.8.7", "2.7.3"];

const inventoryTypes: Record<string, string> = {
  chest: "chest inventory",
  anvil: "anvil inventory",
  enchanting: "enchanting table inventory",
  shulker: "shulker box inventory"
};

const inventoryLayouts: Record<string, { title: string; slots: number; columns: number }> = {
  chest: { title: "Large Chest", slots: 27, columns: 9 },
  shulker: { title: "Shulker Box", slots: 27, columns: 9 },
  anvil: { title: "Anvil", slots: 3, columns: 3 },
  enchanting: { title: "Enchanting Table", slots: 2, columns: 2 }
};

const itemCatalog = [
  { id: "golden apple", label: "Golden Apple", className: "item-golden-apple" },
  { id: "diamond sword", label: "Diamond Sword", className: "item-diamond-sword" },
  { id: "grass block", label: "Grass Block", className: "item-grass-block" },
  { id: "emerald", label: "Emerald", className: "item-emerald" },
  { id: "barrier", label: "Barrier", className: "item-barrier" },
  { id: "paper", label: "Paper", className: "item-paper" }
];

function diagnoseSkript(content: string): Diagnostic[] {
  return content.split(/\r\n|\r|\n/).flatMap((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    const diagnostics: Diagnostic[] = [];

    if (trimmed === "@tool inventory") {
      diagnostics.push({
        line: lineNumber,
        severity: "info",
        message: "@tool inventory 블록이 인벤토리 에디터와 연결됩니다.",
        tip: "오른쪽 인벤토리 에디터에서 슬롯을 선택하고 아이템을 배치한 뒤 적용하세요.",
        example: 'open chest inventory with 1 row named "상점" to player'
      });
    }

    if (trimmed === "@tool send") {
      diagnostics.push({
        line: lineNumber,
        severity: "info",
        message: "@tool send 블록이 메시지 도구와 연결됩니다.",
        tip: "오른쪽 Send Tool에서 대상, 메시지 방식, 내용을 설정한 뒤 적용하세요.",
        example: 'send "안녕하세요" to player'
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

function insertInventoryFunction(content: string, builder: InventoryBuilder) {
  const inventoryName = inventoryTypes[builder.inventoryType] ?? "chest inventory";
  const rowsPart = builder.inventoryType === "chest" ? ` with ${builder.rows} row${builder.rows > 1 ? "s" : ""}` : "";
  const slotLines = Object.entries(builder.slots)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([slot, item]) => `set slot ${slot} of player's current inventory to ${item}`);
  const generated = [`open ${inventoryName}${rowsPart} named "${builder.title}" to player`, ...slotLines];

  const lines = content.split(/\r\n|\r|\n/);
  const targetIndex = lines.findIndex((line) => line.trim() === "@tool inventory" || line.includes("함수(inventory)"));

  if (targetIndex === -1) {
    return `${content.trimEnd()}\n\nfunction open_${builder.title.replace(/\W+/g, "_").toLowerCase()}(p: player):\n  ${generated.join("\n  ")}\n`;
  }

  const indent = lines[targetIndex].match(/^\s*/)?.[0] ?? "";
  lines.splice(targetIndex, 1, ...generated.map((line) => `${indent}${line}`));
  return lines.join("\n");
}

function insertSendTool(content: string, builder: SendBuilder) {
  const target = builder.target;
  const generated =
    builder.mode === "message"
      ? [`send "${builder.content}" to ${target}`]
      : builder.mode === "actionbar"
        ? [`send action bar "${builder.content}" to ${target}`]
        : builder.mode === "subtitle"
          ? [`send subtitle "${builder.content}" to ${target}`]
          : [
              `send title "${builder.content}" with subtitle "${builder.subtitle}" to ${target} for ${builder.fadeIn} ticks, ${builder.stay} ticks and ${builder.fadeOut} ticks`
            ];

  const lines = content.split(/\r\n|\r|\n/);
  const targetIndex = lines.findIndex((line) => line.trim() === "@tool send");

  if (targetIndex === -1) {
    return `${content.trimEnd()}\n${generated.join("\n")}\n`;
  }

  const indent = lines[targetIndex].match(/^\s*/)?.[0] ?? "";
  lines.splice(targetIndex, 1, ...generated.map((line) => `${indent}${line}`));
  return lines.join("\n");
}

function getSlotItemClass(item?: string) {
  return itemCatalog.find((catalogItem) => catalogItem.id === item)?.className ?? "";
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
  const [environment, setEnvironment] = useState<EnvironmentConfig>({
    minecraftVersion: "1.21.4",
    skriptVersion: "2.10.0",
    addons: [
      { id: 1, name: "SkBee", version: "3.9.0" },
      { id: 2, name: "skript-reflect", version: "2.5.1" }
    ]
  });
  const [builder, setBuilder] = useState<InventoryBuilder>({
    inventoryType: "chest",
    rows: 3,
    title: "상점",
    slots: {
      4: "golden apple"
    }
  });
  const [sendBuilder, setSendBuilder] = useState<SendBuilder>({
    mode: "message",
    target: "player",
    content: "안녕하세요",
    subtitle: "어서오세요",
    fadeIn: 10,
    stay: 70,
    fadeOut: 20
  });
  const [selectedSlots, setSelectedSlots] = useState<number[]>([4]);
  const [selectedItem, setSelectedItem] = useState("golden apple");
  const [toolDockOpen, setToolDockOpen] = useState(true);
  const [activeTool, setActiveTool] = useState<"inventory" | "send">("inventory");

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
  const inventoryColumnCount = inventoryLayout.columns;
  const inventoryRowCount = Math.ceil(inventorySlotCount / inventoryColumnCount);

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
      const line = mountedEditor.getModel()?.getLineContent(event.position.lineNumber).trim();

      if (line === "@tool send") {
        setActiveTool("send");
        setToolDockOpen(true);
      }

      if (line === "@tool inventory" || line === "함수(inventory)") {
        setActiveTool("inventory");
        setToolDockOpen(true);
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

  function addAddon(name = "SkBee") {
    setEnvironment((current) => ({
      ...current,
      addons: [...current.addons, { id: Date.now(), name, version: "" }]
    }));
  }

  function updateAddon(id: number, key: "name" | "version", value: string) {
    setEnvironment((current) => ({
      ...current,
      addons: current.addons.map((addon) => (addon.id === id ? { ...addon, [key]: value } : addon))
    }));
  }

  function removeAddon(id: number) {
    setEnvironment((current) => ({
      ...current,
      addons: current.addons.filter((addon) => addon.id !== id)
    }));
  }

  function toggleSlot(slot: number) {
    setSelectedSlots((current) => (current.includes(slot) ? current.filter((item) => item !== slot) : [...current, slot].sort((a, b) => a - b)));
  }

  function setSlotItem(slot: number, item: string) {
    setBuilder((current) => ({
      ...current,
      slots: {
        ...current.slots,
        [slot]: item
      }
    }));
    setSelectedSlots((current) => (current.includes(slot) ? current : [slot]));
    setStatus(`Placed ${item} in slot ${slot}`);
  }

  function moveSlotItem(fromSlot: number, toSlot: number) {
    if (fromSlot === toSlot) {
      return;
    }

    setBuilder((current) => {
      const item = current.slots[fromSlot];

      if (!item) {
        return current;
      }

      const nextSlots = { ...current.slots, [toSlot]: item };
      delete nextSlots[fromSlot];
      return { ...current, slots: nextSlots };
    });
    setSelectedSlots([toSlot]);
    setStatus(`Moved item to slot ${toSlot}`);
  }

  function clearSlot(slot: number) {
    setBuilder((current) => {
      const nextSlots = { ...current.slots };
      delete nextSlots[slot];
      return { ...current, slots: nextSlots };
    });
    setStatus(`Cleared slot ${slot}`);
  }

  function clearSelectedSlots() {
    setBuilder((current) => {
      const nextSlots = { ...current.slots };
      selectedSlots.forEach((slot) => delete nextSlots[slot]);
      return { ...current, slots: nextSlots };
    });
    setStatus(`Cleared ${selectedSlots.length} slot(s)`);
  }

  function applyInventoryBuilder() {
    setFile((current) => ({
      ...current,
      content: insertInventoryFunction(current.content, builder),
      dirty: true
    }));
    setPanelView("problems");
    setStatus("Applied inventory GUI to code");
  }

  function applySendBuilder() {
    setFile((current) => ({
      ...current,
      content: insertSendTool(current.content, sendBuilder),
      dirty: true
    }));
    setPanelView("problems");
    setStatus("Applied send tool to code");
  }

  function renderSidebar() {
    if (activeView === "setup") {
      return (
        <>
          <div className="sidebar-header">
            <span>ENVIRONMENT</span>
            <button title="Add addon" onClick={() => addAddon()}>
              <PackagePlus size={16} />
            </button>
          </div>
          <section className="workspace-block form-stack">
            <label>
              <span>Minecraft</span>
              <select
                value={environment.minecraftVersion}
                onChange={(event) => setEnvironment((current) => ({ ...current, minecraftVersion: event.target.value }))}
              >
                {minecraftVersions.map((version) => (
                  <option key={version}>{version}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Skript</span>
              <select
                value={environment.skriptVersion}
                onChange={(event) => setEnvironment((current) => ({ ...current, skriptVersion: event.target.value }))}
              >
                {skriptVersions.map((version) => (
                  <option key={version}>{version}</option>
                ))}
              </select>
            </label>
            <div className="workspace-title">ADDONS</div>
            {environment.addons.map((addon) => (
              <div className="addon-row" key={addon.id}>
                <select value={addon.name} onChange={(event) => updateAddon(addon.id, "name", event.target.value)}>
                  {addonCatalog.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
                <input value={addon.version} placeholder="version" onChange={(event) => updateAddon(addon.id, "version", event.target.value)} />
                <button title="Remove addon" onClick={() => removeAddon(addon.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </section>
        </>
      );
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
        <button className={`activity ${activeView === "setup" ? "active" : ""}`} title="Environment" onClick={() => setActiveView("setup")}>
          <Code2 size={21} />
        </button>
        <button
          className={`activity ${activeView === "functions" ? "active" : ""}`}
          title="Inventory editor"
          onClick={() => {
            setActiveView("functions");
            setActiveTool("inventory");
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
          <aside className="function-dock inventory-dock">
            <div className="dock-header">
              <span className="dock-title">
                <Wand2 size={16} />
                Tool Editor
              </span>
              <button className="dock-close" title="Close tool editor" onClick={() => setToolDockOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="tool-tabs">
              <button className={activeTool === "inventory" ? "active" : ""} onClick={() => setActiveTool("inventory")}>
                Inventory
              </button>
              <button className={activeTool === "send" ? "active" : ""} onClick={() => setActiveTool("send")}>
                Send
              </button>
            </div>

            {activeTool === "inventory" ? (
            <>
            <div className="inventory-controls">
              <label>
                <span>GUI</span>
                <select value={builder.inventoryType} onChange={(event) => setBuilder((current) => ({ ...current, inventoryType: event.target.value }))}>
                  <option value="chest">Large Chest</option>
                  <option value="anvil">Anvil</option>
                  <option value="enchanting">Enchanting Table</option>
                  <option value="shulker">Shulker Box</option>
                </select>
              </label>
              {builder.inventoryType === "chest" && (
                <label>
                  <span>Rows</span>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={builder.rows}
                    onChange={(event) => setBuilder((current) => ({ ...current, rows: Number(event.target.value) }))}
                  />
                </label>
              )}
              <label>
                <span>Title</span>
                <input value={builder.title} onChange={(event) => setBuilder((current) => ({ ...current, title: event.target.value }))} />
              </label>
            </div>

            <div className="minecraft-window">
              <div className="minecraft-title">{builder.inventoryType === "chest" ? "Large Chest" : inventoryLayout.title}</div>
              <div
                className="minecraft-grid"
                style={{
                  gridTemplateColumns: `repeat(${inventoryColumnCount}, 30px)`,
                  gridTemplateRows: `repeat(${inventoryRowCount}, 30px)`
                }}
              >
                {Array.from({ length: inventorySlotCount }, (_, slot) => {
                  const item = builder.slots[slot];
                  const selected = selectedSlots.includes(slot);
                  return (
                    <button
                      className={`minecraft-slot ${selected ? "selected" : ""}`}
                      key={slot}
                      title={`Slot ${slot}${item ? `: ${item}` : ""}`}
                      onClick={() => toggleSlot(slot)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        clearSlot(slot);
                      }}
                      onDragStart={(event) => {
                        if (!item) {
                          event.preventDefault();
                          return;
                        }
                        event.dataTransfer.setData("application/x-skript-item", item);
                        event.dataTransfer.setData("application/x-skript-slot", String(slot));
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={(event) => {
                        if (event.dataTransfer.dropEffect === "none") {
                          clearSlot(slot);
                        }
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = event.dataTransfer.getData("application/x-skript-slot") ? "move" : "copy";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const sourceSlot = event.dataTransfer.getData("application/x-skript-slot");
                        const droppedItem = event.dataTransfer.getData("application/x-skript-item");

                        if (sourceSlot) {
                          moveSlotItem(Number(sourceSlot), slot);
                          return;
                        }

                        if (droppedItem) {
                          setSlotItem(slot, droppedItem);
                        }
                      }}
                      draggable={Boolean(item)}
                    >
                      {item && <span className={`item-sprite ${getSlotItemClass(item)}`} />}
                    </button>
                  );
                })}
              </div>
              <div className="minecraft-title player-title">Inventory</div>
              <div className="minecraft-grid player-grid">
                {Array.from({ length: 27 }, (_, slot) => (
                  <span className="minecraft-slot readonly-slot" key={`player-${slot}`} />
                ))}
              </div>
              <div className="minecraft-grid hotbar-grid">
                {Array.from({ length: 9 }, (_, slot) => (
                  <span className="minecraft-slot readonly-slot" key={`hotbar-${slot}`} />
                ))}
              </div>
            </div>

            <div className="selected-summary">{selectedSlots.length} slot(s) selected</div>

            <div className="item-palette">
              {itemCatalog.map((item) => (
                <button
                  className={`palette-item ${selectedItem === item.id ? "active" : ""}`}
                  key={item.id}
                  onClick={() => setSelectedItem(item.id)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("application/x-skript-item", item.id);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  title={item.label}
                  draggable
                >
                  <span className={`item-sprite ${item.className}`} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <div className="inventory-actions">
              <button className="apply-button" onClick={applyInventoryBuilder}>
                Apply to code
              </button>
              <span className="drag-hint">Drag an item into a slot. Right-click a slot to clear it.</span>
            </div>
            </>
            ) : (
            <div className="send-tool">
              <label>
                <span>Type</span>
                <select
                  value={sendBuilder.mode}
                  onChange={(event) => setSendBuilder((current) => ({ ...current, mode: event.target.value as SendBuilder["mode"] }))}
                >
                  <option value="message">Message</option>
                  <option value="title">Title</option>
                  <option value="subtitle">Subtitle</option>
                  <option value="actionbar">Action Bar</option>
                </select>
              </label>
              <label>
                <span>Target</span>
                <select
                  value={sendBuilder.target}
                  onChange={(event) => setSendBuilder((current) => ({ ...current, target: event.target.value as SendBuilder["target"] }))}
                >
                  <option value="player">player</option>
                  <option value="all players">all players</option>
                  <option value="console">console</option>
                </select>
              </label>
              <label>
                <span>{sendBuilder.mode === "title" ? "Title" : "Content"}</span>
                <textarea value={sendBuilder.content} onChange={(event) => setSendBuilder((current) => ({ ...current, content: event.target.value }))} />
              </label>
              {sendBuilder.mode === "title" && (
                <>
                  <label>
                    <span>Subtitle</span>
                    <textarea value={sendBuilder.subtitle} onChange={(event) => setSendBuilder((current) => ({ ...current, subtitle: event.target.value }))} />
                  </label>
                  <div className="send-timing">
                    <label>
                      <span>Fade in</span>
                      <input
                        type="number"
                        min="0"
                        value={sendBuilder.fadeIn}
                        onChange={(event) => setSendBuilder((current) => ({ ...current, fadeIn: Number(event.target.value) }))}
                      />
                    </label>
                    <label>
                      <span>Stay</span>
                      <input
                        type="number"
                        min="1"
                        value={sendBuilder.stay}
                        onChange={(event) => setSendBuilder((current) => ({ ...current, stay: Number(event.target.value) }))}
                      />
                    </label>
                    <label>
                      <span>Fade out</span>
                      <input
                        type="number"
                        min="0"
                        value={sendBuilder.fadeOut}
                        onChange={(event) => setSendBuilder((current) => ({ ...current, fadeOut: Number(event.target.value) }))}
                      />
                    </label>
                  </div>
                </>
              )}
              <div className="send-preview">
                <span>{sendBuilder.mode}</span>
                <strong>{sendBuilder.content}</strong>
                {sendBuilder.mode === "title" && <small>{sendBuilder.subtitle}</small>}
              </div>
              <button className="apply-button" onClick={applySendBuilder}>
                Apply to code
              </button>
            </div>
            )}
          </aside>
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
              <span className="prompt">$</span> Skript Tool initialized. Build installers with npm run dist.
            </div>
          ) : (
            <div className="problems-output">
              {diagnostics.length === 0 ? (
                <span>No problems detected.</span>
              ) : (
                diagnostics.map((item, index) => (
                  <button
                    className={`problem-entry ${item.severity}`}
                    key={`${item.line}-${index}`}
                    onClick={() => {
                      editorRef.current?.revealLineInCenter(item.line);
                      editorRef.current?.setPosition({ lineNumber: item.line, column: 1 });
                    }}
                  >
                    <strong>Line {item.line}</strong>
                    <span>{item.message}</span>
                    <small>{item.tip}</small>
                  </button>
                ))
              )}
            </div>
          )}
        </section>

        <footer className="statusbar">
          <span>
            <GitBranch size={14} /> main
          </span>
          <span>{status}</span>
          <span>
            Errors {diagnosticsCount.error} / Warnings {diagnosticsCount.warning}
          </span>
          <span>Skript</span>
          <span>{lineCount} lines</span>
          <span>UTF-8</span>
        </footer>
      </section>
    </main>
  );
}
