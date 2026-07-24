import type { Monaco } from "@monaco-editor/react";
import { toolRegistry } from "./tools/registry";

/** Replace range covering an in-progress `@tool…` token so `@` is not duplicated. */
function getToolTokenRange(linePrefix: string, lineNumber: number, positionColumn: number, wordEndColumn: number) {
  const match = linePrefix.match(/@(?:tool(?::[A-Za-z0-9_]*)?)?$/);
  if (match) {
    return {
      startLineNumber: lineNumber,
      endLineNumber: lineNumber,
      startColumn: positionColumn - match[0].length,
      endColumn: Math.max(positionColumn, wordEndColumn)
    };
  }

  return {
    startLineNumber: lineNumber,
    endLineNumber: lineNumber,
    startColumn: positionColumn,
    endColumn: wordEndColumn
  };
}

export function registerSkriptLanguage(monaco: Monaco) {
  if (monaco.languages.getLanguages().some((language) => language.id === "skript")) {
    return;
  }

  monaco.languages.register({ id: "skript", extensions: [".sk"], aliases: ["Skript", "skript"] });

  monaco.languages.setMonarchTokensProvider("skript", {
    defaultToken: "",
    tokenPostfix: ".sk",
    keywords: [
      "on",
      "command",
      "trigger",
      "if",
      "else",
      "loop",
      "while",
      "set",
      "add",
      "remove",
      "delete",
      "send",
      "broadcast",
      "cancel",
      "wait",
      "stop",
      "return",
      "function",
      "options"
    ],
    tokenizer: {
      root: [
        [/#.*$/, "comment"],
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/"/, "string", "@string"],
        [/\{[A-Za-z0-9_.:-]+\}/, "variable"],
        [/%[A-Za-z0-9_ -]+%/, "type.identifier"],
        [/[{}()[\]]/, "@brackets"],
        [/\b\d+(\.\d+)?\b/, "number"],
        [/[a-zA-Z_][\w-]*/, { cases: { "@keywords": "keyword", "@default": "identifier" } }]
      ],
      string: [
        [/[^\\"]+/, "string"],
        [/\\./, "string.escape"],
        [/"/, "string", "@pop"]
      ]
    }
  });

  monaco.languages.setLanguageConfiguration("skript", {
    comments: { lineComment: "#" },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"]
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "\"", close: "\"" }
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "\"", close: "\"" }
    ]
  });

  monaco.languages.registerCompletionItemProvider("skript", {
    triggerCharacters: ["@", ":", "/"],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const snippet = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
      const defaultRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };

      // `@` / `@tool` / `@tool:` / `@tool:se…` — replace from `@` so we never get `@@tool`
      const inToolToken = /@(?:tool(?::[A-Za-z0-9_]*)?)?$/.test(linePrefix);
      if (inToolToken) {
        const range = getToolTokenRange(linePrefix, position.lineNumber, position.column, word.endColumn);
        const afterColon = /@tool:/.test(linePrefix);

        if (afterColon) {
          return {
            suggestions: toolRegistry.map((tool) => ({
              label: tool.label,
              kind: monaco.languages.CompletionItemKind.Module,
              detail: tool.detail,
              documentation: `삽입: ${tool.marker}\n오른쪽 Tool 탭에서 편집한 뒤 Apply로 코드를 생성합니다.`,
              insertText: tool.marker,
              range
            }))
          };
        }

        return {
          suggestions: [
            {
              label: "tool",
              kind: monaco.languages.CompletionItemKind.Keyword,
              detail: "초보자용 도구 (@tool:…)",
              documentation: "@tool: 뒤에 send, inventory 등 전용 커맨드를 선택하세요.",
              insertText: "@tool:",
              command: { id: "editor.action.triggerSuggest", title: "Suggest tool commands" },
              range
            },
            ...toolRegistry.map((tool) => ({
              label: tool.marker,
              kind: monaco.languages.CompletionItemKind.Snippet,
              detail: tool.detail,
              documentation: "마커만 삽입됩니다. 완성 코드는 Tool 탭 Apply 후에 생성됩니다.",
              insertText: tool.marker,
              range
            }))
          ]
        };
      }

      return {
        suggestions: [
          {
            label: "@tool:",
            kind: monaco.languages.CompletionItemKind.Keyword,
            detail: "초보자용 도구 열기",
            documentation: "전용 커맨드(send, inventory 등)를 선택한 뒤 오른쪽 탭에서 편집합니다.",
            insertText: "@tool:",
            command: { id: "editor.action.triggerSuggest", title: "Suggest tool commands" },
            range: defaultRange
          },
          ...toolRegistry.map((tool) => ({
            label: tool.marker,
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: tool.detail,
            documentation: "마커만 삽입됩니다. 완성 코드는 Tool 탭 Apply 후에 생성됩니다.",
            insertText: tool.marker,
            range: defaultRange
          })),
          {
            label: "on right click with item",
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: "Skript event",
            insertText: "on right click with ${1:grass block}:\n  ${0:@tool:inventory}",
            insertTextRules: snippet,
            range: defaultRange
          },
          {
            label: "command",
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: "Skript command block",
            insertText: "command /${1:name}:\n  trigger:\n    ${0:@tool:send}",
            insertTextRules: snippet,
            range: defaultRange
          },
          {
            label: "open chest inventory",
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: "Open a chest GUI",
            insertText: "open chest inventory with ${1:1} row named \"${2:Title}\" to player",
            insertTextRules: snippet,
            range: defaultRange
          },
          {
            label: "set slot",
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: "Set item in current inventory",
            insertText: "set slot ${1:0} of player's current inventory to ${2:golden apple}",
            insertTextRules: snippet,
            range: defaultRange
          },
          {
            label: "send message",
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: "Send message to player (raw)",
            insertText: "send \"${1:message}\" to player",
            insertTextRules: snippet,
            range: defaultRange
          },
          {
            label: "broadcast",
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: "Broadcast message",
            insertText: "broadcast \"${1:message}\"",
            insertTextRules: snippet,
            range: defaultRange
          },
          {
            label: "if permission",
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: "Permission check",
            insertText: "if player has permission \"${1:permission.node}\":\n  ${0:@tool:send}",
            insertTextRules: snippet,
            range: defaultRange
          },
          {
            label: "function",
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: "Skript function",
            insertText: "function ${1:name}(${2:p: player}):\n  ${0:@tool:send}",
            insertTextRules: snippet,
            range: defaultRange
          }
        ]
      };
    }
  });
}
