import { activeLegacyRules, addonSyntax, atLeast, findAddonPackage, getAddonAvailability } from "../catalog";
import type { EnvironmentConfig } from "../catalog";
import type { Diagnostic, DiagnosticCategory, DiagnosticSeverity } from "./types";

type FrameKind = "event" | "command" | "function" | "periodic" | "condition" | "loop" | "section" | "options";

type Frame = {
  kind: FrameKind;
  indent: number;
  line: number;
  header: string;
  hasContent: boolean;
  triggerSeen: boolean;
  /** 이 블록의 첫 자식 줄이 쓴 들여쓰기 문자 */
  childIndent: "tab" | "space" | null;
};

const TRIGGER_KINDS: FrameKind[] = ["event", "command", "function", "periodic"];

/** 문자열 안의 #은 주석이 아니므로, 따옴표 밖의 #부터 잘라냅니다. */
function stripComment(line: string): string {
  let inString = false;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString && char === "#") {
      return line.slice(0, index);
    }
  }
  return line;
}

function measureIndent(raw: string): number {
  const match = /^[ \t]*/.exec(raw);
  const prefix = match ? match[0] : "";
  let indent = 0;
  for (const char of prefix) {
    indent += char === "\t" ? 4 : 1;
  }
  return indent;
}

function indentChar(raw: string): "tab" | "space" {
  return raw.startsWith("\t") ? "tab" : "space";
}

function removeStrings(text: string): string {
  return text.replace(/"(?:\\.|[^"\\])*"/g, '""');
}

function countOccurrences(text: string, needle: string): number {
  let count = 0;
  let index = text.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(needle, index + needle.length);
  }
  return count;
}

/** 이스케이프(\")를 고려해 닫히지 않은 문자열이 있는지 확인합니다. */
function hasUnclosedString(line: string): boolean {
  let inString = false;
  let escaped = false;
  for (const char of line) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
    }
  }
  return inString;
}

const OPENERS: Array<{ open: string; close: string; label: string; example: string }> = [
  { open: "{", close: "}", label: "변수 중괄호 { }", example: "set {_count} to 1" },
  { open: "(", close: ")", label: "괄호 ( )", example: "send \"체력: %player's health%\" to player" },
  { open: "[", close: "]", label: "대괄호 [ ]", example: "command /상점:  # 대괄호를 쓸 때는 짝을 맞추세요" }
];

function headerKind(code: string): FrameKind | null {
  if (/^on\s+/i.test(code)) {
    return "event";
  }
  if (/^every\s+/i.test(code)) {
    return "periodic";
  }
  if (/^command\s+/i.test(code)) {
    return "command";
  }
  if (/^function\s+/i.test(code)) {
    return "function";
  }
  if (/^options\s*:$/i.test(code)) {
    return "options";
  }
  if (/^(if|else if|unless|else)\b/i.test(code)) {
    return "condition";
  }
  if (/^(loop|while)\b/i.test(code)) {
    return "loop";
  }
  return null;
}

function isBlockHeader(code: string): boolean {
  if (!code.endsWith(":")) {
    return false;
  }
  return Boolean(headerKind(code)) || /^[a-z][a-z ]*:$/i.test(code);
}

export type DiagnosticContext = {
  /** 프로젝트 환경. 없으면 구버전/애드온 검사를 건너뜁니다. */
  environment?: EnvironmentConfig;
};

/**
 * 순수 정적 분석 진단기.
 * 서버를 실행하지 않고, 문법·버전·애드온·최적화 포인트를 줄 단위로 찾아냅니다.
 *
 * - 빨간줄(error): 기본 문법 오류 (콜론·괄호·따옴표·% 짝, trigger 누락, 들여쓰기 오류)
 * - 노란줄(warning): 예전 문법, 프로젝트에 없는 애드온 문법, 최적화 문제
 * - 파란 힌트(tip): 학습 포인트
 */
export function analyzeDiagnostics(content: string, context: DiagnosticContext = {}): Diagnostic[] {
  const environment = context.environment;
  const skriptVersion = environment?.skriptVersion ?? null;
  const installedAddons = new Set(environment?.addons ?? []);

  const rawLines = content.split(/\r\n|\r|\n/);
  const diagnostics: Diagnostic[] = [];
  const frames: Frame[] = [];
  const reportedGlobalVars = new Set<string>();
  const seen = new Set<string>();
  let tabIndentLine: number | null = null;
  let spaceIndentLine: number | null = null;

  const add = (
    line: number,
    severity: DiagnosticSeverity,
    category: DiagnosticCategory,
    message: string,
    extra?: { tip?: string; example?: string; addonId?: string; addonName?: string; fix?: Diagnostic["fix"] }
  ) => {
    const key = `${line}:${category}:${message}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    diagnostics.push({
      id: `skript-${line}-${diagnostics.length + 1}`,
      line,
      severity,
      category,
      message,
      tip: extra?.tip,
      example: extra?.example,
      addonId: extra?.addonId,
      addonName: extra?.addonName,
      fix: extra?.fix
    });
  };

  const closeFrame = (frame: Frame) => {
    if (frame.kind === "command" && !frame.triggerSeen) {
      add(frame.line, "error", "syntax", "command 블록에 trigger: 섹션이 없습니다.", {
        tip: "명령어가 실제로 할 일은 trigger: 아래에 작성합니다.",
        example: "command /hello:\n  trigger:\n    send \"안녕하세요\" to player"
      });
    }
    if (frame.hasContent === false && TRIGGER_KINDS.includes(frame.kind)) {
      add(frame.line, "warning", "learn", `${frame.header} 블록에 실행할 내용이 없습니다.`, {
        tip: "트리거는 이벤트가 발생했을 때 실행할 코드를 담는 블록입니다. 들여쓰기한 줄을 추가하세요.",
        example: "on join:\n  send \"서버에 오신 것을 환영합니다\" to player"
      });
    }
  };

  rawLines.forEach((raw, index) => {
    const line = index + 1;
    const withoutComment = stripComment(raw);
    const code = withoutComment.trim();
    if (!code) {
      return;
    }

    const indent = measureIndent(raw);
    const char = indentChar(raw);
    if (char === "tab") {
      tabIndentLine = tabIndentLine ?? line;
    } else if (/^ {2,}/.test(raw)) {
      spaceIndentLine = spaceIndentLine ?? line;
    }

    while (frames.length > 0 && indent <= frames[frames.length - 1].indent) {
      const frame = frames.pop();
      if (frame) {
        closeFrame(frame);
      }
    }
    for (const frame of frames) {
      if (indent > frame.indent) {
        frame.hasContent = true;
        if (!frame.childIndent && indent > 0) {
          frame.childIndent = char;
        } else if (frame.childIndent && frame.childIndent !== char && indent > frame.indent) {
          add(line, "error", "syntax", "블록 안에서 탭과 스페이스 들여쓰기가 섞였습니다.", {
            tip: "Skript는 들여쓰기로 블록 범위를 정합니다. 한 블록 안에서는 2칸 스페이스(또는 탭) 하나로 통일하세요.",
            example: "on join:\n  send \"안녕\" to player"
          });
        }
      }
    }

    const inPeriodic = frames.some((frame) => frame.kind === "periodic");
    const inLoop = frames.some((frame) => frame.kind === "loop");
    const parent = frames.length > 0 ? frames[frames.length - 1] : null;
    const parentIsCommand = parent?.kind === "command";
    const matchingText = removeStrings(withoutComment);

    // 1. 블록 제목의 콜론 누락
    const missingColonTarget = /^(on|every|command|function|options|if|else if|unless|else|loop(?!-)|while)\b/i.test(code);
    if (missingColonTarget && !code.includes(":")) {
      add(line, "error", "syntax", "블록 제목 줄 끝에 ':'가 필요합니다.", {
        tip: "Skript는 콜론(:)과 들여쓰기로 블록 범위를 정합니다.",
        example: code.startsWith("command") ? "command /hello:" : "on join:"
      });
    }

    // 2. 위에 블록 제목 없이 들여쓴 줄
    if (frames.length === 0 && indent > 0) {
      add(line, "error", "syntax", "위에 블록 제목이 없는데 들여쓰여 있습니다.", {
        tip: "들여쓴 줄은 바로 위 블록 제목(:)에 속합니다. 블록 제목을 먼저 쓰고 그 아래를 들여쓰세요.",
        example: "on join:\n  send \"안녕\" to player"
      });
    }

    // 3. 매 틱 / 아주 짧은 주기 반복
    const tickMatch = /^every\s+(\d+(?:\.\d+)?)?\s*ticks?\s*:/i.exec(code);
    if (tickMatch) {
      const amount = tickMatch[1] ? Number.parseFloat(tickMatch[1]) : 1;
      if (amount <= 2) {
        add(line, "warning", "optimize", "매 틱(초당 20회) 반복은 서버에 큰 부하를 줍니다.", {
          tip: "모든 플레이어를 대상으로 하거나 무거운 연산을 넣으면 TPS가 떨어집니다. 주기를 늘리고, 필요한 조건을 먼저 검사하세요.",
          example: "every 5 seconds:\n  loop all players:\n    if {_needRefresh::%loop-player's uuid%} is true:"
        });
      } else if (amount <= 4) {
        add(line, "tip", "optimize", "아주 짧은 주기입니다. 꼭 필요한 작업인지 확인해 보세요.", {
          tip: "틱 단위 대신 초 단위로 묶으면 같은 일을 훨씬 적은 횟수로 처리할 수 있습니다.",
          example: "every 5 seconds:"
        });
      }
    }

    const secondsMatch = /^every\s+(\d+(?:\.\d+)?)\s*seconds?\s*:/i.exec(code);
    if (secondsMatch) {
      const amount = Number.parseFloat(secondsMatch[1]);
      if (amount <= 2) {
        add(line, "tip", "optimize", "1~2초 주기 반복입니다. 대상 수를 줄이면 부하가 크게 줄어듭니다.", {
          tip: "반복 주기 안에서는 무거운 명령(모든 엔티티 검색, 전체 블록 순회)을 피하세요.",
          example: "every 10 seconds:"
        });
      }
    }

    if (/^on\s+every\s+ticks?\b/i.test(code)) {
      add(line, "warning", "learn", "on every tick 대신 every tick: 표기를 사용하세요.", {
        tip: "주기 반복은 on이 아니라 every로 시작합니다.",
        example: "every tick:\n  # 매 틱 실행할 코드"
      });
    }

    // 4. 넓은 범위 loop
    const broadLoop = /^loop\s+(all\s+players|players|all\s+entities|all\s+blocks|all\s+worlds|all\s+items)\b/i.exec(code);
    if (broadLoop) {
      const target = broadLoop[1].toLowerCase().replace(/\s+/g, " ");
      const label = target.includes("players") ? "모든 플레이어" : "넓은 범위의 대상";
      if (inPeriodic) {
        add(line, "warning", "optimize", `짧은 주기 이벤트 안에서 ${label}를 순회합니다.`, {
          tip: "주기가 짧을수록 이 loop는 매번 비싼 작업이 됩니다. 대상을 조건으로 먼저 줄이거나, 이벤트 기반으로 바꾸세요.",
          example: "if player's world is \"world\":\n  # 필요한 플레이어만 대상으로"
        });
      } else {
        add(line, "tip", "optimize", `${label}를 한 명씩 순회합니다.`, {
          tip: "대상이 많을수록 비용이 커집니다. 루프 안에서 모든 엔티티/블록을 다시 검색하지 말고, 필요한 값은 루프 밖에서 한 번만 구하세요.",
          example: "loop all players:\n  if loop-player is online:"
        });
      }
    }

    // 5. 반복문 안의 wait
    if (/^wait\s+/i.test(code) && inLoop) {
      add(line, "tip", "learn", "반복문 안의 wait은 반복 전체를 그 지점에서 멈춥니다.", {
        tip: "플레이어마다 따로 기다리게 하려면 함수로 분리하거나, 한 번에 wait 1 tick으로 묶는 편이 안전합니다.",
        example: "wait 1 tick"
      });
    }

    // 6. 전역 변수 vs 지역 변수
    const variableRegex = /\{([^{}]+)\}/g;
    let variableMatch = variableRegex.exec(code);
    while (variableMatch) {
      const name = variableMatch[1].trim();
      variableMatch = variableRegex.exec(code);
      if (!name || name.startsWith("_") || name.startsWith("@") || name.includes("%") || reportedGlobalVars.has(name)) {
        continue;
      }
      if (reportedGlobalVars.size >= 5) {
        continue;
      }
      reportedGlobalVars.add(name);
      add(line, "tip", "learn", `전역 변수 {${name}}를 사용합니다.`, {
        tip: "전역 변수는 서버를 재시작해도 남고 모든 트리거가 공유합니다. 이 트리거 안에서만 쓸 값이라면 지역 변수 {_" + name + "}를 쓰세요.",
        example: `set {_${name}} to 0`
      });
    }

    // 7. v2에서 지원하지 않는 마커
    if (/@tool\b/i.test(matchingText)) {
      add(line, "warning", "learn", "@tool 마커는 v2에서 지원하지 않습니다.", {
        tip: "마커를 실제 Skript 코드로 바꿔 직접 작성하세요. 흐름 인스펙터가 어떤 순서로 실행되는지 알려줍니다.",
        example: 'send "&a안녕하세요" to player'
      });
    }

    // 8. 따옴표 / 중괄호 / 괄호 / % 짝
    if (hasUnclosedString(withoutComment)) {
      add(line, "error", "syntax", "따옴표가 닫히지 않았습니다.", {
        tip: "문자열은 큰따옴표로 감쌉니다. 색상 코드(&a 등)는 따옴표 안에 둡니다.",
        example: 'send "&a환영합니다" to player'
      });
    }

    for (const pair of OPENERS) {
      if (countOccurrences(matchingText, pair.open) !== countOccurrences(matchingText, pair.close)) {
        add(line, "error", "syntax", `${pair.label}의 짝이 맞지 않습니다.`, {
          tip: `여는 ${pair.open} 와 닫는 ${pair.close} 개수가 같아야 합니다.`,
          example: pair.example
        });
      }
    }
    if (countOccurrences(matchingText, "%") % 2 === 1) {
      add(line, "error", "syntax", "타입 표현식의 % 짝이 맞지 않습니다.", {
        tip: "%표현식% 형태로 값이나 조건 안에 다른 값을 넣습니다.",
        example: "send \"현재 체력: %player's health%\" to player"
      });
    }

    // 9. loop 전용 값의 범위
    if (/\bloop-(player|value|block|item|number|index)\b/i.test(code) && !inLoop) {
      add(line, "warning", "learn", "loop- 값은 loop 블록 안에서만 사용할 수 있습니다.", {
        tip: "loop-player, loop-value 같은 값은 반복문이 한 바퀴 돌 때마다 바뀌는 현재 대상입니다.",
        example: "loop all players:\n  send loop-player's name to player"
      });
    }

    // 10. 선택한 Skript 버전에서 폐기된 예전 문법 → 노란줄
    if (skriptVersion) {
      for (const rule of activeLegacyRules(skriptVersion)) {
        if (!rule.pattern.test(matchingText)) {
          continue;
        }
        const removed = atLeast(skriptVersion, rule.removedIn ?? "99.0.0");
        add(line, "warning", "legacy", `${rule.message} (Skript ${rule.since}+${removed ? ", 제거됨" : ""})`, {
          tip: rule.alternative,
          example: rule.example
        });
      }
    }

    // 11. 프로젝트에 없는 애드온 전용 문법 → 노란줄 + 확장 안내
    if (environment) {
      for (const [addonId, rules] of Object.entries(addonSyntax)) {
        if (installedAddons.has(addonId)) {
          continue;
        }
        const addon = findAddonPackage(addonId);
        if (!addon) {
          continue;
        }
        const hit = rules.find((rule) => rule.pattern.test(matchingText));
        if (!hit) {
          continue;
        }
        const availability = getAddonAvailability(addon, environment.minecraftVersion, environment.skriptVersion);
        if (availability.compatible) {
          add(line, "warning", "addon", `\`${hit.sample}\` 문법은 ${addon.name} 애드온이 필요합니다.`, {
            tip: `${addon.description} 확장(애드온) 관리에서 ${addon.name}를 추가하면 이 경고가 사라지고 자동완성에도 나타납니다.`,
            addonId,
            addonName: addon.name,
            fix: { kind: "add-addon", addonId, addonName: addon.name, label: `${addon.name} 추가` }
          });
        } else {
          add(
            line,
            "warning",
            "addon",
            `\`${hit.sample}\` 문법은 ${addon.name} 애드온이 필요하지만, 지금 버전 조합과 호환되지 않습니다.`,
            {
              tip: `${addon.name}: ${availability.reasons.join(" · ")}. MC/Skript 버전을 바꾸면 추가할 수 있습니다.`,
              addonId,
              addonName: addon.name
            }
          );
        }
      }
    }

    // 12. command의 trigger: 표시
    if (parentIsCommand && parent && /^trigger\s*:$/i.test(code)) {
      parent.triggerSeen = true;
    }

    // 13. 블록 시작
    if (isBlockHeader(code)) {
      const kind = headerKind(code) ?? "section";
      frames.push({
        kind,
        indent,
        line,
        header: code.replace(/:$/, ""),
        hasContent: false,
        triggerSeen: false,
        childIndent: null
      });

      if (kind === "periodic" && /^every\s+/i.test(code) && !/tick|second|minute|hour|day/i.test(code)) {
        add(line, "tip", "learn", "every 뒤에는 시간 단위를 붙여 주세요.", {
          tip: "Skript는 tick, second, minute, hour, day 단위를 이해합니다.",
          example: "every 30 seconds:"
        });
      }
    }
  });

  while (frames.length > 0) {
    const frame = frames.pop();
    if (frame) {
      closeFrame(frame);
    }
  }

  if (tabIndentLine !== null && spaceIndentLine !== null) {
    add(Math.min(tabIndentLine, spaceIndentLine), "warning", "style", "탭과 스페이스 들여쓰기가 섞여 있습니다.", {
      tip: "Skript는 들여쓰기로 블록을 구분합니다. 한 파일에서는 2칸 스페이스(또는 탭) 하나로 통일하세요.",
      example: "on join:\n  send \"안녕\" to player   # 2칸 스페이스"
    });
  }

  return diagnostics
    .sort((left, right) => left.line - right.line || severityRank(left.severity) - severityRank(right.severity))
    .slice(0, 300);
}

function severityRank(severity: DiagnosticSeverity): number {
  return severity === "error" ? 0 : severity === "warning" ? 1 : 2;
}
