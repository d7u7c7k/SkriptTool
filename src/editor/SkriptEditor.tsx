import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Diagnostic } from "../diagnostics/types";
import type { EditorSettings } from "../settings/types";
import { applyMonacoTheme, monacoThemeId } from "../theme/monacoTheme";
import type { ThemeDefinition } from "../theme/types";
import { registerSkriptLanguage } from "../skriptLanguage";
import type { OpenTab } from "../workspace/types";

type Props = {
  tab: OpenTab;
  theme: ThemeDefinition;
  settings: EditorSettings;
  diagnostics: Diagnostic[];
  onContentChange: (value: string) => void;
  onCursorChange: (line: number, column: number) => void;
  onEditorReady?: (mounted: editor.IStandaloneCodeEditor) => void;
};

const markerSeverity = (monaco: Monaco, severity: Diagnostic["severity"]) => {
  if (severity === "error") {
    return monaco.MarkerSeverity.Error;
  }
  if (severity === "warning") {
    return monaco.MarkerSeverity.Warning;
  }
  // 팁은 밑줄 없이 hover에서만 보이도록 Hint를 씁니다.
  return monaco.MarkerSeverity.Hint;
};

export function SkriptEditor({ tab, theme, settings, diagnostics, onContentChange, onCursorChange, onEditorReady }: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const diagnosticsRef = useRef(diagnostics);
  const decorationsRef = useRef<string[]>([]);
  const cursorHandlerRef = useRef(onCursorChange);
  const themeId = useMemo(() => monacoThemeId(theme), [theme]);

  diagnosticsRef.current = diagnostics;
  cursorHandlerRef.current = onCursorChange;

  const applyMarkers = useCallback(() => {
    const monaco = monacoRef.current;
    const mounted = editorRef.current;
    if (!monaco || !mounted) {
      return;
    }
    const model = mounted.getModel();
    if (!model) {
      return;
    }

    const current = diagnosticsRef.current;
    const lastLine = model.getLineCount();
    const clampLine = (line: number) => Math.min(Math.max(1, line), lastLine);
    monaco.editor.setModelMarkers(
      model,
      "skript-v2",
      current.map((item) => ({
        startLineNumber: clampLine(item.line),
        endLineNumber: clampLine(item.line),
        startColumn: 1,
        endColumn: Math.max(2, model.getLineMaxColumn(clampLine(item.line))),
        message: [item.message, item.tip ? `TIP: ${item.tip}` : "", item.example ? `예시: ${item.example}` : ""]
          .filter(Boolean)
          .join("\n"),
        severity: markerSeverity(monaco, item.severity),
        source: "SkriptTool",
        code: item.addonId ? `addon:${item.addonId}` : item.category
      }))
    );

    decorationsRef.current = mounted.deltaDecorations(
      decorationsRef.current,
      current
        .filter((item) => item.severity !== "tip")
        .map((item) => ({
          range: new monaco.Range(clampLine(item.line), 1, clampLine(item.line), 1),
          options: {
            isWholeLine: true,
            className: item.severity === "error" ? "diag-line-error" : "diag-line-warning"
          }
        }))
    );
  }, []);

  useEffect(() => {
    applyMarkers();
  }, [applyMarkers, diagnostics, tab.path]);

  useEffect(() => {
    const monaco = monacoRef.current;
    if (monaco) {
      applyMonacoTheme(monaco, theme);
    }
  }, [theme]);

  const handleMount: OnMount = (mounted, monaco) => {
    editorRef.current = mounted;
    monacoRef.current = monaco;
    onEditorReady?.(mounted);
    applyMarkers();

    const cursorSubscription = mounted.onDidChangeCursorPosition((event) => {
      cursorHandlerRef.current(event.position.lineNumber, event.position.column);
    });
    const modelSubscription = mounted.onDidChangeModel(() => {
      applyMarkers();
    });
    mounted.onDidDispose(() => {
      cursorSubscription.dispose();
      modelSubscription.dispose();
    });
  };

  return (
    <Editor
      path={tab.path}
      language="skript"
      theme={themeId}
      value={tab.content}
      beforeMount={(monaco) => {
        registerSkriptLanguage(monaco);
        applyMonacoTheme(monaco, theme);
      }}
      onMount={handleMount}
      onChange={(value) => onContentChange(value ?? "")}
      loading={<div className="editor-loading">에디터를 준비하는 중…</div>}
      options={{
        automaticLayout: true,
        fontFamily: theme.editor.fontFamily,
        fontSize: theme.editor.fontSize,
        lineHeight: theme.editor.lineHeight,
        tabSize: settings.tabSize,
        insertSpaces: true,
        wordWrap: settings.wordWrap ? "on" : "off",
        minimap: { enabled: settings.showMinimap, renderCharacters: false },
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        renderLineHighlight: "line",
        renderWhitespace: "selection",
        scrollBeyondLastLine: false,
        padding: { top: 16, bottom: 32 },
        lineNumbersMinChars: 3,
        glyphMargin: false,
        folding: true,
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        stickyScroll: { enabled: false },
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
        quickSuggestions: { other: true, comments: false, strings: false },
        suggestOnTriggerCharacters: true,
        tabCompletion: "on",
        acceptSuggestionOnEnter: "smart",
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
        fixedOverflowWidgets: true,
        contextmenu: true,
        ariaLabel: "Skript 코드 에디터"
      }}
    />
  );
}
