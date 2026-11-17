import type { Diagnostic, DiagnosticCategory, DiagnosticSeverity } from "./types";

type FrameKind = "event" | "command" | "function" | "periodic" | "condition" | "loop" | "section" | "options";

type Frame = {
  kind: FrameKind;
  indent: number;
  line: number;
  header: string;
  hasContent: boolean;
  triggerSeen: boolean;
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

/**
 * 순수 정적 분석 진단기.
 * 서버를 실행하지 않고, 문법·최적화·교육 포인트를 줄 단위로 찾아냅니다.
 */
export function analyzeDiagnostics(content: string): Diagnostic[] {
  const rawLines = content.split(/\r\n|\r|\n/);
  const diagnostics: Diagnostic[] = [];
  const frames: Frame[] = [];
  const reportedGlobalVars = new Set<string>();
  let tabIndentLine: number | null = null;
  let spaceIndentLine: number | null = null;

  const add = (
    line: number,
    severity: DiagnosticSeverity,
    category: DiagnosticCategory,
    message: string,
    extra?: { tip?: string; example?: string }
  ) => {
    diagnostics.push({
      id: `skript-${line}-${diagnostics.length + 1}`,
      line,
      severity,
      category,
      message,
      tip: extra?.tip,
      example: extra?.example
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
    if (/^\t/.test(raw)) {
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
      }
    }

    const inPeriodic = frames.some((frame) => frame.kind === "periodic");
    const inLoop = frames.some((frame) => frame.kind === "loop");
    const parent = frames.length > 0 ? frames[frames.length - 1] : null;
    const parentIsCommand = parent?.kind === "command";

    // 1. 블록 제목의 콜론 누락
    const missingColonTarget = /^(on|every|command|function|options|if|else if|unless|else|loop|while)\b/i.test(code);
    if (missingColonTarget && !code.includes(":")) {
      add(line, "error", "syntax", "블록 제목 줄 끝에 ':'가 필요합니다.", {
        tip: "Skript는 콜론(:)과 들여쓰기로 블록 범위를 정합니다.",
        example: code.startsWith("command") ? "command /hello:" : `on join:`
      });
    }

    // 2. 매 틱 / 아주 짧은 주기 반복
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

    // 3. 넓은 범위 loop
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

    // 4. 반복문 안의 wait
    if (/^wait\s+/i.test(code) && inLoop) {
      add(line, "tip", "learn", "반복문 안의 wait은 반복 전체를 그 지점에서 멈춥니다.", {
        tip: "플레이어마다 따로 기다리게 하려면 함수로 분리하거나, 한 번에 wait 1 tick으로 묶는 편이 안전합니다.",
        example: "wait 1 tick"
      });
    }

    // 5. 전역 변수 vs 지역 변수
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

    // 6. 구버전 / 비권장 표기
    if (/\brightclick\b/i.test(code)) {
      add(line, "warning", "learn", "rightclick 대신 right click 표기를 사용하세요.", {
        tip: "구버전 표기는 최신 Skript에서 인식되지 않을 수 있습니다.",
        example: "on right click with grass block:"
      });
    }
    if (/\bleftclick\b/i.test(code)) {
      add(line, "warning", "learn", "leftclick 대신 left click 표기를 사용하세요.", {
        tip: "이벤트 이름은 띄어 쓴 단어 조합으로 읽습니다.",
        example: "on left click:"
      });
    }
    if (/@tool\b/i.test(code)) {
      add(line, "warning", "learn", "@tool 마커는 v2에서 지원하지 않습니다.", {
        tip: "마커를 실제 Skript 코드로 바꿔 직접 작성하세요. 흐름 인스펙터가 어떤 순서로 실행되는지 알려줍니다.",
        example: 'send "&a안녕하세요" to player'
      });
    }

    // 7. 따옴표 / 중괄호 / % 짝
    if (countOccurrences(withoutComment, '"') % 2 === 1) {
      add(line, "error", "syntax", "따옴표가 닫히지 않았습니다.", {
        tip: "문자열은 큰따옴표로 감쌉니다. 색상 코드(&a 등)는 따옴표 안에 둡니다.",
        example: 'send "&a환영합니다" to player'
      });
    }

    const unfilledStrings = removeStrings(withoutComment);
    if (countOccurrences(unfilledStrings, "{") !== countOccurrences(unfilledStrings, "}")) {
      add(line, "error", "syntax", "변수 중괄호 { }의 짝이 맞지 않습니다.", {
        tip: "변수는 {변수명} 형태로 감쌉니다. 지역 변수는 {_이름}입니다.",
        example: "set {_count} to 1"
      });
    }
    if (countOccurrences(unfilledStrings, "%") % 2 === 1) {
      add(line, "error", "syntax", "타입 표현식의 % 짝이 맞지 않습니다.", {
        tip: "%표현식% 형태로 값이나 조건 안에 다른 값을 넣습니다.",
        example: 'send "현재 체력: %player\'s health%" to player'
      });
    }

    // 8. loop 전용 값의 범위
    if (/\bloop-(player|value|entity|block|item|number|index)\b/i.test(code) && !inLoop) {
      add(line, "warning", "learn", "loop- 값은 loop 블록 안에서만 사용할 수 있습니다.", {
        tip: "loop-player, loop-value 같은 값은 반복문이 한 바퀴 돌 때마다 바뀌는 현재 대상입니다.",
        example: "loop all players:\n  send loop-player's name to player"
      });
    }

    // 9. command의 trigger: 표시
    if (parentIsCommand && parent && /^trigger\s*:$/i.test(code)) {
      parent.triggerSeen = true;
    }

    // 10. 블록 시작
    if (isBlockHeader(code)) {
      const kind = headerKind(code) ?? "section";
      frames.push({
        kind,
        indent,
        line,
        header: code.replace(/:$/, ""),
        hasContent: false,
        triggerSeen: false
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
    .slice(0, 200);
}

function severityRank(severity: DiagnosticSeverity): number {
  return severity === "error" ? 0 : severity === "warning" ? 1 : 2;
}
