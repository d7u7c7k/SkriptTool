import type { Monaco } from "@monaco-editor/react";
import type { IRange, languages } from "monaco-editor";
import { findAddonPackage } from "./catalog/addons";
import { addonSnippets } from "./catalog/addonSnippets";

const LANG_ID = "skript";

/** 현재 프로젝트에 추가된 애드온 (자동완성에 반영) */
let activeAddonIds: string[] = [];

export function setCompletionEnvironment(addons: string[]) {
  activeAddonIds = [...addons];
}

/** Monaco 빠른 수정(코드 액션)에서 "확장에서 추가"를 눌렀을 때 실행할 동작 */
let addonFixHandler: ((addonId: string) => void) | null = null;

export function setAddonFixHandler(handler: ((addonId: string) => void) | null) {
  addonFixHandler = handler;
}

const eventSnippets: Array<{ label: string; insert: string; detail: string }> = [
  { label: "on join:", insert: "on join:\n  ${0:send \"&a환영합니다\" to player}", detail: "플레이어 접속" },
  { label: "on quit:", insert: "on quit:\n  ${0:# 나가는 플레이어 처리}", detail: "플레이어 퇴장" },
  { label: "on right click:", insert: "on right click:\n  ${0:# 우클릭}", detail: "우클릭" },
  {
    label: "on right click with item:",
    insert: "on right click with ${1:grass block}:\n  ${0:# 아이템 우클릭}",
    detail: "아이템을 든 채 우클릭"
  },
  { label: "on left click:", insert: "on left click:\n  ${0:# 좌클릭}", detail: "좌클릭" },
  {
    label: "on break of block:",
    insert: "on break of ${1:stone}:\n  ${0:# 블록 파괴}",
    detail: "특정 블록 파괴"
  },
  {
    label: "on place of block:",
    insert: "on place of ${1:stone}:\n  ${0:# 블록 설치}",
    detail: "특정 블록 설치"
  },
  { label: "on chat:", insert: "on chat:\n  ${0:# 채팅}", detail: "채팅" },
  { label: "on damage:", insert: "on damage:\n  ${0:# 데미지}", detail: "데미지" },
  { label: "on death:", insert: "on death:\n  ${0:# 사망}", detail: "사망" },
  { label: "on inventory click:", insert: "on inventory click:\n  ${0:# GUI 클릭}", detail: "인벤토리 클릭" },
  { label: "every X seconds:", insert: "every ${1:5} seconds:\n  ${0:# 주기 실행}", detail: "주기 반복" }
];

const structureSnippets: Array<{ label: string; insert: string; detail: string }> = [
  {
    label: "command /name:",
    insert:
      "command /${1:hello}:\n  permission: ${2:skript.command.hello}\n  description: ${3:설명}\n  trigger:\n    ${0:send \"&a안녕하세요\" to player}",
    detail: "명령어 트리거"
  },
  {
    label: "function name():",
    insert: "function ${1:giveReward}(${2:p: player}):\n  ${0:# 함수 본문}",
    detail: "함수 정의"
  },
  { label: "if condition:", insert: "if ${1:player is op}:\n  ${0:# 참일 때}", detail: "조건문" },
  {
    label: "if / else:",
    insert: "if ${1:player is op}:\n  ${2:# 참}\nelse:\n  ${0:# 거짓}",
    detail: "조건 + 그 외"
  },
  { label: "loop all players:", insert: "loop all players:\n  ${0:# loop-player}", detail: "모든 플레이어 반복" },
  { label: "loop list:", insert: "loop ${1:{_list::*}}:\n  ${0:# loop-value}", detail: "목록 반복" },
  { label: "while condition:", insert: "while ${1:condition}:\n  ${0:# 반복}", detail: "조건 반복" }
];

const effectSnippets: Array<{ label: string; insert: string; detail: string }> = [
  { label: "send message to player", insert: "send \"${1:&a메시지}\" to ${2:player}", detail: "메시지 보내기" },
  { label: "broadcast message", insert: "broadcast \"${1:메시지}\"", detail: "전체 방송" },
  { label: "set variable", insert: "set {${1:_value}} to ${2:0}", detail: "변수 저장" },
  { label: "add to variable", insert: "add ${1:1} to {${2:_count}}", detail: "변수에 더하기" },
  { label: "remove from variable", insert: "remove ${1:1} from {${2:_count}}", detail: "변수에서 빼기" },
  { label: "wait", insert: "wait ${1:1} ${2:second}", detail: "대기" },
  { label: "cancel event", insert: "cancel event", detail: "이벤트 취소" },
  { label: "give item", insert: "give ${1:diamond} to ${2:player}", detail: "아이템 지급" },
  {
    label: "open chest inventory",
    insert: "open chest inventory with ${1:1} row named \"${2:제목}\" to player",
    detail: "GUI 열기"
  },
  { label: "teleport", insert: "teleport ${1:player} to ${2:location}", detail: "이동" }
];

function snippetRange(range: IRange, linePrefix: string): IRange {
  if (linePrefix.endsWith("{")) {
    return {
      startLineNumber: range.startLineNumber,
      endLineNumber: range.endLineNumber,
      startColumn: range.endColumn,
      endColumn: range.endColumn
    };
  }
  return range;
}
export function registerSkriptLanguage(monaco: Monaco) {
  if (monaco.languages.getLanguages().some((language) => language.id === LANG_ID)) {
    return;
  }

  monaco.languages.register({ id: LANG_ID, extensions: [".sk"], aliases: ["Skript", "skript"] });

  const language: languages.IMonarchLanguage = {
    defaultToken: "",
    tokenPostfix: ".sk",
    ignoreCase: true,
    brackets: [
      { open: "{", close: "}", token: "delimiter.bracket" },
      { open: "[", close: "]", token: "delimiter.bracket" },
      { open: "(", close: ")", token: "delimiter.bracket" }
    ],
    events: ["on", "every", "command", "function", "options", "trigger"],
    conditions: [
      "if",
      "unless",
      "is",
      "isn't",
      "are",
      "has",
      "have",
      "contains",
      "exists",
      "matches",
      "between",
      "greater",
      "less",
      "than",
      "or",
      "and",
      "not"
    ],
    effects: [
      "send",
      "broadcast",
      "message",
      "set",
      "add",
      "remove",
      "delete",
      "reset",
      "cancel",
      "wait",
      "execute",
      "apply",
      "call",
      "open",
      "close",
      "give",
      "take",
      "kill",
      "damage",
      "heal",
      "feed",
      "clear",
      "make",
      "spawn",
      "strike",
      "play",
      "show",
      "hide",
      "kick",
      "ban",
      "teleport",
      "equip",
      "enchant",
      "ignite",
      "extinguish"
    ],
    keywords: [
      "loop",
      "while",
      "else",
      "do",
      "to",
      "from",
      "in",
      "with",
      "of",
      "at",
      "by",
      "then",
      "exit",
      "continue",
      "stop",
      "return",
      "aliases",
      "permission",
      "description",
      "usage",
      "executable",
      "cooldown",
      "bypass",
      "storage",
      "local"
    ],
    tokenizer: {
      root: [
        [/#.*$/, "comment"],
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/"/, { token: "string.quoted", next: "@string" }],
        [/\{_[^{}\n]*\}/, "variable.local"],
        [/\{[^{}\n]*\}/, "variable.global"],
        [/%[^%\n]+%/, "type"],
        [/&[0-9a-fk-or](?![0-9a-zA-Z])/i, "color"],
        [/\b\d+(\.\d+)?\b/, "number"],
        [/[{}()[\]]/, "@brackets"],
        [/[,:]/, "delimiter"],
        [/==|!=|>=|<=|>|<|\+|-|\*|\/|=/, "operator"],
        [
          /[a-zA-Z_][\w-]*/,
          {
            cases: {
              "@events": "keyword.event",
              "@conditions": "keyword.condition",
              "@effects": "keyword.effect",
              "@keywords": "keyword",
              "@default": "identifier"
            }
          }
        ],
        [/[ \t]+/, "white"],
        [/%/, "operator"]
      ],
      string: [
        [/[^\\"]+/, "string"],
        [/\\./, "string.escape"],
        [/"/, { token: "string.quoted", next: "@pop" }]
      ]
    }
  };

  monaco.languages.setMonarchTokensProvider(LANG_ID, language);

  monaco.languages.setLanguageConfiguration(LANG_ID, {
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
      { open: '"', close: '"', notIn: ["string", "comment"] }
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' }
    ],
    indentationRules: {
      increaseIndentPattern: /^\s*(on|every|command|function|options|if|else if|else|unless|loop|while|trigger)\b.*:\s*$/i,
      decreaseIndentPattern: /^\s*$/
    }
  });

  monaco.languages.registerCompletionItemProvider(LANG_ID, {
    triggerCharacters: ["{", "%", ":"],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };
      const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const snippet = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
      const kind = monaco.languages.CompletionItemKind;
      const suggestions: languages.CompletionItem[] = [];

      if (linePrefix.endsWith("{")) {
        const braceRange = snippetRange(range, linePrefix);
        suggestions.push(
          {
            label: "{_지역변수}",
            kind: kind.Variable,
            detail: "지역 변수 — 이 트리거가 끝나면 사라집니다",
            documentation: {
              value: "**{_이름}**\n\n이 트리거/함수 안에서만 쓰는 값입니다. 같은 이름을 다른 트리거에서 써도 서로 영향을 주지 않아 초보자에게 안전합니다."
            },
            insertText: linePrefix.endsWith("{") ? "_${1:이름}}" : "{_${1:이름}}",
            insertTextRules: snippet,
            range: braceRange
          },
          {
            label: "{전역변수}",
            kind: kind.Variable,
            detail: "전역 변수 — 서버 재시작 후에도 유지",
            documentation: {
              value: "**{이름}**\n\n모든 트리거가 공유하고 variables.csv에 저장됩니다. 꼭 오래 남겨야 하는 값에만 쓰세요."
            },
            insertText: linePrefix.endsWith("{") ? "${1:이름}}" : "{${1:이름}}",
            insertTextRules: snippet,
            range: braceRange
          }
        );
        return { suggestions };
      }

      const addGroup = (items: Array<{ label: string; insert: string; detail: string }>, group: string) => {
        for (const item of items) {
          suggestions.push({
            label: item.label,
            kind: kind.Snippet,
            detail: `${group} · ${item.detail}`,
            insertText: item.insert,
            insertTextRules: snippet,
            range
          });
        }
      };

      addGroup(eventSnippets, "이벤트");
      addGroup(structureSnippets, "구조");
      addGroup(effectSnippets, "효과");

      // 프로젝트에 추가된 애드온의 문법만 자동완성에 넣습니다.
      for (const addonId of activeAddonIds) {
        const snippets = addonSnippets[addonId];
        if (!snippets || snippets.length === 0) {
          continue;
        }
        const addonName = findAddonPackage(addonId)?.name ?? addonId;
        addGroup(snippets, `확장 · ${addonName}`);
      }

      return { suggestions };
    }
  });

  const keywordDocs: Record<string, string> = {
    on: "**on … :**\n\n이벤트 트리거입니다. 게임에서 그 상황이 일어나면 아래 블록을 실행합니다. 예: `on join:`",
    every: "**every … :**\n\n주기 트리거입니다. `every 5 seconds:`처럼 시간 단위를 붙입니다. 주기가 짧을수록 서버 부하가 커집니다.",
    command: "**command /이름:**\n\n명령어 트리거입니다. `trigger:` 아래에 실행할 코드를 쓰고, `permission:`으로 권한을 제한할 수 있습니다.",
    function: "**function 이름(인자):**\n\n함수 정의입니다. 다른 곳에서 `이름()`으로 호출합니다. 함수는 호출한 트리거의 흐름 안에서 실행됩니다.",
    trigger: "**trigger:**\n\ncommand 블록에서 실제 실행 코드가 시작되는 섹션입니다.",
    if: "**if 조건:**\n\n조건이 참일 때만 아래 블록을 실행합니다. 여러 조건은 `and` / `or`로 연결합니다.",
    unless: "**unless 조건:**\n\n조건이 거짓일 때 아래 블록을 실행합니다. `if not`과 같은 뜻입니다.",
    loop: "**loop 대상:**\n\n대상을 하나씩 반복합니다. 반복 중 현재 값은 `loop-value`, 플레이어면 `loop-player`입니다. 반복이 많을수록 서버 비용이 커집니다.",
    while: "**while 조건:**\n\n조건이 참인 동안 계속 반복합니다. 조건이 언젠가 거짓이 되도록 꼭 값을 바꿔 주세요.",
    send: "**send \"메시지\" to 대상**\n\n메시지를 보냅니다. 색상 코드는 `&a`, `&c`처럼 문자열 안에 씁니다.",
    set: "**set 대상 to 값**\n\n값을 저장합니다. 변수라면 `{_지역}`(이 트리거 안에서만) 또는 `{전역}`을 구분해서 쓰세요.",
    add: "**add 값 to 대상**\n\n숫자에 더하거나 목록에 항목을 추가합니다.",
    wait: "**wait 시간**\n\n지정한 시간만큼 이 트리거를 멈춥니다. 반복문 안에서 쓰면 반복 전체가 멈춘다는 점을 기억하세요.",
    cancel: "**cancel event**\n\n발생한 이벤트를 취소해 원래 게임 동작을 막습니다.",
    "loop-player": "**loop-player**\n\n`loop all players:` 안에서 현재 반복 중인 플레이어입니다.",
    "loop-value": "**loop-value**\n\n`loop 목록:` 안에서 현재 반복 중인 값입니다."
  };

  monaco.languages.registerHoverProvider(LANG_ID, {
    provideHover: (model, position) => {
      const line = model.getLineContent(position.lineNumber);
      const variableRegex = /\{_?[^{}\n]*\}/g;
      let match = variableRegex.exec(line);
      while (match) {
        const start = match.index + 1;
        const end = match.index + match[0].length + 1;
        if (position.column >= start && position.column <= end) {
          const name = match[0].slice(1, -1);
          const isLocal = name.startsWith("_");
          return {
            range: new monaco.Range(position.lineNumber, start, position.lineNumber, end),
            contents: [
              {
                value: isLocal
                  ? `**{${name}}** · 지역 변수\n\n이 트리거/함수가 끝나면 사라집니다. 다른 트리거와 이름이 겹쳐도 안전합니다.`
                  : `**{${name}}** · 전역 변수\n\n서버를 재시작해도 남고 모든 트리거가 공유합니다. 이 트리거 안에서만 쓸 값이면 \`{_${name}}\`를 쓰세요.`
              }
            ]
          };
        }
        match = variableRegex.exec(line);
      }

      const word = model.getWordAtPosition(position);
      if (!word) {
        return null;
      }
      const doc = keywordDocs[word.word.toLowerCase()];
      if (!doc) {
        return null;
      }
      return {
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        },
        contents: [{ value: doc }]
      };
    }
  });

  // 애드온 누락 진단의 빠른 수정: "확장에서 SkBee 추가"
  monaco.editor.registerCommand("skripttool.addAddon", (_accessor, addonId: unknown) => {
    if (typeof addonId === "string" && addonId) {
      addonFixHandler?.(addonId);
    }
  });

  monaco.languages.registerCodeActionProvider(LANG_ID, {
    provideCodeActions: (_model, _range, context) => {
      const seen = new Set<string>();
      const actions: languages.CodeAction[] = [];
      for (const marker of context.markers) {
        const code = typeof marker.code === "string" ? marker.code : marker.code?.value;
        if (!code || !code.startsWith("addon:")) {
          continue;
        }
        const addonId = code.slice("addon:".length);
        if (seen.has(addonId)) {
          continue;
        }
        seen.add(addonId);
        const addonName = findAddonPackage(addonId)?.name ?? addonId;
        actions.push({
          title: `확장에서 ${addonName} 추가`,
          kind: "quickfix",
          diagnostics: [marker],
          command: {
            id: "skripttool.addAddon",
            title: `${addonName} 추가`,
            arguments: [addonId]
          }
        });
      }
      return { actions, dispose: () => undefined };
    }
  });
}
