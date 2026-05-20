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
}
