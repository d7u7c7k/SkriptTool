import type { Monaco } from "@monaco-editor/react";

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
    triggerCharacters: ["@", " ", "/"],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };
      const snippet = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

      if (/@tool\s+\w*$/.test(linePrefix)) {
        return {
          suggestions: [
            {
              label: "inventory",
              kind: monaco.languages.CompletionItemKind.Module,
              detail: "@tool inventory - visual inventory editor",
              insertText: "inventory",
              range
            },
            {
              label: "send",
              kind: monaco.languages.CompletionItemKind.Module,
              detail: "@tool send - message/title/actionbar builder",
              insertText: "send",
              range
            }
          ]
        };
      }

      return {
        suggestions: [
          {
            label: "@tool",
            kind: monaco.languages.CompletionItemKind.Keyword,
            detail: "Open tool suggestions",
            insertText: "@tool ",
            command: { id: "editor.action.triggerSuggest", title: "Suggest tool types" },
            range
          },
          {
            label: "@tool inventory",
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: "Open the visual inventory editor",
            insertText: "@tool inventory",
            range
          },
          {
            label: "@tool send",
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: "Open the send tool",
            insertText: "@tool send",
            range
          },
          {
            label: "on right click with item",
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: "Skript event",
            insertText: "on right click with ${1:grass block}:\n  ${0:@tool inventory}",
            insertTextRules: snippet,
            range
          },
          {
            label: "command",
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: "Skript command block",
            insertText: "command /${1:name}:\n  trigger:\n    ${0:send \"Hello\" to player}",
            insertTextRules: snippet,
            range
          },
          {
            label: "open chest inventory",
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: "Open a chest GUI",
            insertText: "open chest inventory with ${1:1} row named \"${2:Title}\" to player",
            insertTextRules: snippet,
            range
          },
          {
            label: "set slot",
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: "Set item in current inventory",
            insertText: "set slot ${1:0} of player's current inventory to ${2:golden apple}",
            insertTextRules: snippet,
            range
          },
          {
            label: "send",
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: "Send message to player",
            insertText: "send \"${1:message}\" to player",
            insertTextRules: snippet,
            range
          },
          {
            label: "broadcast",
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: "Broadcast message",
            insertText: "broadcast \"${1:message}\"",
            insertTextRules: snippet,
            range
          },
          {
            label: "if permission",
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: "Permission check",
            insertText: "if player has permission \"${1:permission.node}\":\n  ${0:send \"Allowed\" to player}",
            insertTextRules: snippet,
            range
          },
          {
            label: "function",
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: "Skript function",
            insertText: "function ${1:name}(${2:p: player}):\n  ${0:send \"Done\" to {_p}}",
            insertTextRules: snippet,
            range
          }
        ]
      };
    }
  });
}
