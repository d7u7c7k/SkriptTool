import Editor, { type OnMount } from "@monaco-editor/react";
import {
  Bug,
  CheckCircle2,
  Code2,
  FileCode2,
  FolderOpen,
  GitBranch,
  Play,
  Save,
  Search,
  Settings,
  TerminalSquare
} from "lucide-react";
import { useMemo, useState } from "react";
import { registerSkriptLanguage } from "./skriptLanguage";

const starterScript = `options:
  prefix: &6[SkriptTool]

command /hello:
  trigger:
    send "{@prefix} &fHello, %player%!" to player

on join:
  broadcast "&a%player% joined the server."
`;

type OpenFile = {
  name: string;
  path?: string;
  content: string;
  dirty: boolean;
};

export function App() {
  const [file, setFile] = useState<OpenFile>({
    name: "welcome.sk",
    content: starterScript,
    dirty: false
  });
  const [status, setStatus] = useState("Ready");

  const lineCount = useMemo(() => file.content.split(/\r\n|\r|\n/).length, [file.content]);

  const handleEditorMount: OnMount = (_editor, monaco) => {
    registerSkriptLanguage(monaco);
  };

  async function openFile() {
    if (!window.skriptApi) {
      setStatus("Electron API is unavailable in browser preview");
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
      setStatus("Electron API is unavailable in browser preview");
      return;
    }

    const saved = await window.skriptApi.saveSkript({ path: file.path, content: file.content });
    if (!saved) {
      return;
    }

    setFile((current) => ({ ...current, name: saved.name, path: saved.path, dirty: false }));
    setStatus(`Saved ${saved.name}`);
  }

  return (
    <main className="app-shell">
      <aside className="activity-bar" aria-label="Primary navigation">
        <button className="activity active" title="Explorer">
          <FileCode2 size={21} />
        </button>
        <button className="activity" title="Search">
          <Search size={21} />
        </button>
        <button className="activity" title="Run">
          <Play size={21} />
        </button>
        <button className="activity" title="Problems">
          <Bug size={21} />
        </button>
        <button className="activity bottom" title="Settings">
          <Settings size={21} />
        </button>
      </aside>

      <aside className="sidebar">
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
        </section>
      </aside>

      <section className="workbench">
        <header className="titlebar">
          <div className="tab active-tab">
            <FileCode2 size={15} />
            <span>{file.name}</span>
            {file.dirty && <span className="unsaved">●</span>}
          </div>
          <div className="toolbar">
            <button title="Open Skript file" onClick={openFile}>
              <FolderOpen size={17} />
            </button>
            <button title="Save Skript file" onClick={saveFile}>
              <Save size={17} />
            </button>
            <button title="Run diagnostics" onClick={() => setStatus("Diagnostics completed")}>
              <CheckCircle2 size={17} />
            </button>
          </div>
        </header>

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
              scrollBeyondLastLine: false,
              renderWhitespace: "selection"
            }}
          />
        </div>

        <section className="panel">
          <div className="panel-tabs">
            <button className="panel-tab active-panel">
              <TerminalSquare size={15} />
              Terminal
            </button>
            <button className="panel-tab">
              <Bug size={15} />
              Problems
            </button>
          </div>
          <div className="terminal-output">
            <span className="prompt">$</span> Skript Tool initialized. Open a .sk file or start editing.
          </div>
        </section>

        <footer className="statusbar">
          <span>
            <GitBranch size={14} /> main
          </span>
          <span>{status}</span>
          <span>Skript</span>
          <span>{lineCount} lines</span>
          <span>UTF-8</span>
        </footer>
      </section>
    </main>
  );
}
