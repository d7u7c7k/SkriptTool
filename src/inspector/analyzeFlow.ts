export type TriggerKind = "event" | "command" | "function" | "periodic";

export type TriggerBlock = {
  id: string;
  kind: TriggerKind;
  /** 콜론을 뺀 원본 제목 */
  header: string;
  /** 목록에 보여줄 짧은 이름 */
  name: string;
  label: string;
  line: number;
  bodyStartLine: number;
  endLine: number;
};

export type FlowStepType = "event" | "condition" | "loop" | "variable" | "action" | "wait" | "control";

export type FlowStep = {
  id: string;
  line: number;
  depth: number;
  type: FlowStepType;
  title: string;
  detail: string;
  code: string;
};

export type VariableScope = "local" | "global";

export type VariableSummary = {
  name: string;
  scope: VariableScope;
  firstLine: number;
  writes: number;
  reads: number;
  uses: number;
};

export type SkriptAnalysis = {
  triggers: TriggerBlock[];
  variables: VariableSummary[];
  lineCount: number;
};

const triggerLabels: Record<TriggerKind, string> = {
  event: "이벤트",
  command: "명령어",
  function: "함수",
  periodic: "주기"
};

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

function detectKind(code: string): TriggerKind | null {
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
  return null;
}

function makeTrigger(kind: TriggerKind, header: string, line: number, bodyStartLine: number, endLine: number): TriggerBlock {
  let name = header;
  if (kind === "command") {
    const match = /^command\s+\/?([^\s:]+)/i.exec(header);
    name = match ? `/${match[1].replace(/^\//, "")}` : header;
  } else if (kind === "function") {
    const match = /^function\s+([^\s(]+)/i.exec(header);
    name = match ? `${match[1]}()` : header;
  } else if (kind === "event") {
    name = header.replace(/^on\s+/i, "");
  } else {
    name = header.replace(/^every\s+/i, "");
  }

  return {
    id: `trigger-${line}`,
    kind,
    header,
    name,
    label: triggerLabels[kind],
    line,
    bodyStartLine,
    endLine
  };
}

export function analyzeSkript(content: string): SkriptAnalysis {
  const lines = content.split(/\r\n|\r|\n/);
  const triggers: TriggerBlock[] = [];

  lines.forEach((raw, index) => {
    const code = stripComment(raw).trim();
    if (!code || measureIndent(raw) !== 0) {
      return;
    }
    const kind = detectKind(code);
    if (!kind) {
      return;
    }
    const trimmed = code.replace(/:\s*$/, "").trim();

    let end = lines.length;
    for (let probe = index + 1; probe < lines.length; probe += 1) {
      const probeCode = stripComment(lines[probe]).trim();
      if (!probeCode) {
        continue;
      }
      if (measureIndent(lines[probe]) === 0) {
        end = probe;
        break;
      }
    }

    triggers.push(makeTrigger(kind, trimmed, index + 1, index + 2, end));
  });

  return {
    triggers,
    variables: summarizeVariables(content),
    lineCount: lines.length
  };
}

export function findTriggerAtLine(triggers: TriggerBlock[], line: number): TriggerBlock | undefined {
  return triggers.find((trigger) => line >= trigger.line && line <= trigger.endLine);
}

export function summarizeVariables(content: string, range?: { start: number; end: number }): VariableSummary[] {
  const lines = content.split(/\r\n|\r|\n/);
  const start = range ? Math.max(0, range.start - 1) : 0;
  const end = range ? Math.min(lines.length, range.end) : lines.length;
  const map = new Map<string, VariableSummary>();

  for (let index = start; index < end; index += 1) {
    const code = stripComment(lines[index]);
    if (!code.trim()) {
      continue;
    }
    const isWrite = /^\s*(set|add|remove|delete|reset|increase|decrease)\b/i.test(code);
    const regex = /\{([^{}]+)\}/g;
    let match = regex.exec(code);
    while (match) {
      const name = match[1].trim();
      match = regex.exec(code);
      if (!name || name.startsWith("@")) {
        continue;
      }
      const scope: VariableScope = name.startsWith("_") ? "local" : "global";
      const current = map.get(name);
      if (current) {
        current.uses += 1;
        if (isWrite) {
          current.writes += 1;
        } else {
          current.reads += 1;
        }
      } else {
        map.set(name, {
          name,
          scope,
          firstLine: index + 1,
          writes: isWrite ? 1 : 0,
          reads: isWrite ? 0 : 1,
          uses: 1
        });
      }
    }
  }

  return [...map.values()].sort((left, right) => left.firstLine - right.firstLine);
}

function colorize(text: string): string {
  return text.replace(/&[0-9a-fk-orx]/gi, "").replace(/\s+/g, " ").trim();
}

function trimColon(code: string): string {
  return code.replace(/:\s*$/, "").trim();
}

function describeEvent(header: string): string {
  const name = header.replace(/^on\s+/i, "").trim().toLowerCase();
  if (/^join$/.test(name)) {
    return "플레이어가 서버에 접속했을 때";
  }
  if (/^(quit|disconnect)$/.test(name)) {
    return "플레이어가 서버에서 나갔을 때";
  }
  if (/^(right click|rightclick)/.test(name)) {
    return "플레이어가 우클릭했을 때";
  }
  if (/^(left click|leftclick)/.test(name)) {
    return "플레이어가 좌클릭했을 때";
  }
  if (/break (of )?(a |the )?block|break block/.test(name)) {
    return "플레이어가 블록을 캤을 때";
  }
  if (/place (of )?(a |the )?block|place block/.test(name)) {
    return "플레이어가 블록을 설치했을 때";
  }
  if (/^chat$/.test(name)) {
    return "플레이어가 채팅을 보냈을 때";
  }
  if (/inventory click/.test(name)) {
    return "플레이어가 인벤토리를 클릭했을 때";
  }
  if (/^death/.test(name)) {
    return "엔티티가 죽었을 때";
  }
  if (/^damage/.test(name)) {
    return "엔티티가 데미지를 받았을 때";
  }
  if (/^(load|server load)/.test(name)) {
    return "서버/스크립트가 로드될 때";
  }
  if (/^move/.test(name)) {
    return "플레이어나 엔티티가 움직였을 때";
  }
  return `\`${name}\` 이벤트가 발생했을 때`;
}

export function describeTrigger(trigger: TriggerBlock): { title: string; detail: string } {
  if (trigger.kind === "command") {
    return {
      title: "명령어 실행",
      detail: `누군가 \`${trigger.name}\` 명령어를 실행하면 trigger: 블록이 실행됩니다. permission: 이 있으면 권한을 먼저 검사합니다.`
    };
  }
  if (trigger.kind === "function") {
    return {
      title: "함수 호출",
      detail: `다른 트리거나 스크립트에서 \`${trigger.name}\`을 호출하면 함수 본문이 실행됩니다. 함수는 호출한 쪽의 흐름 안에서 실행됩니다.`
    };
  }
  if (trigger.kind === "periodic") {
    return {
      title: "주기 실행",
      detail: `\`${trigger.name}\`마다 자동으로 실행됩니다. 주기가 짧을수록 서버 부하가 커지니 안에 무거운 반복을 넣지 않도록 주의하세요.`
    };
  }
  return {
    title: "이벤트 발생",
    detail: `${describeEvent(trigger.header)} 이 블록이 시작됩니다. 아래 단계를 위에서 아래로 실행합니다.`
  };
}

function scopeLabel(name: string): string {
  return name.startsWith("_") ? `지역 변수 {${name}}` : `전역 변수 {${name}}`;
}

function variableName(text: string): string | null {
  const match = /\{([^{}]+)\}/.exec(text);
  return match ? match[1].trim() : null;
}

type Explained = { type: FlowStepType; title: string; detail: string };

function explainFlowLine(code: string): Explained {
  const plain = trimColon(code);

  if (/^if\b/i.test(plain)) {
    const body = plain.replace(/^if\s+/i, "");
    return {
      type: "condition",
      title: "조건 검사",
      detail: `\`${body}\` 가 참일 때만 아래 블록을 실행합니다. 거짓이면 이 블록을 건너뜁니다.`
    };
  }
  if (/^else if\b/i.test(plain)) {
    const body = plain.replace(/^else if\s+/i, "");
    return {
      type: "condition",
      title: "다른 조건 검사",
      detail: `앞 조건이 거짓일 때 \`${body}\` 를 검사합니다. 참이면 아래 블록을 실행합니다.`
    };
  }
  if (/^unless\b/i.test(plain)) {
    const body = plain.replace(/^unless\s+/i, "");
    return {
      type: "condition",
      title: "반대 조건 검사",
      detail: `\`${body}\` 가 아니라면(거짓일 때) 아래 블록을 실행합니다.`
    };
  }
  if (/^else\b/i.test(plain)) {
    return {
      type: "condition",
      title: "그 외",
      detail: "위 조건이 모두 거짓일 때 실행됩니다."
    };
  }

  if (/^loop\s+all\s+players\b/i.test(plain)) {
    return {
      type: "loop",
      title: "반복 · 모든 플레이어",
      detail: "모든 플레이어를 한 명씩 꺼내 아래 블록을 반복합니다. 반복 중 현재 플레이어는 loop-player입니다."
    };
  }
  if (/^loop\s+all\s+entities\b/i.test(plain)) {
    return {
      type: "loop",
      title: "반복 · 모든 엔티티",
      detail: "모든 엔티티를 하나씩 꺼내 반복합니다. 현재 대상은 loop-entity입니다."
    };
  }
  if (/^loop\s+all\s+blocks\b/i.test(plain)) {
    return {
      type: "loop",
      title: "반복 · 모든 블록",
      detail: "모든 블록을 하나씩 꺼내 반복합니다. 현재 대상은 loop-block입니다."
    };
  }
  if (/^loop\s+all\s+items\b/i.test(plain)) {
    return {
      type: "loop",
      title: "반복 · 모든 아이템",
      detail: "모든 아이템을 하나씩 꺼내 반복합니다. 현재 대상은 loop-item입니다."
    };
  }
  if (/^loop\b/i.test(plain)) {
    const subject = plain.replace(/^loop\s+/i, "");
    return {
      type: "loop",
      title: "반복",
      detail: `\`${subject}\` 의 항목을 하나씩 반복합니다. 반복 중 현재 값은 loop-value입니다.`
    };
  }
  if (/^while\b/i.test(plain)) {
    const condition = plain.replace(/^while\s+/i, "");
    return {
      type: "loop",
      title: "반복 · 조건 유지",
      detail: `\`${condition}\` 가 참인 동안 아래 블록을 계속 반복합니다. 조건이 거짓이 되면 빠져나옵니다.`
    };
  }

  const setMatch = /^set\s+(.+?)\s+to\s+(.+)$/i.exec(plain);
  if (setMatch) {
    const target = setMatch[1].trim();
    const value = setMatch[2].trim();
    const name = variableName(target);
    return {
      type: "variable",
      title: name ? "변수 저장" : "값 변경",
      detail: name ? `${scopeLabel(name)}에 \`${value}\` 을 저장합니다.` : `\`${target}\` 값을 \`${value}\` 으로 바꿉니다.`
    };
  }
  const addMatch = /^(add|remove)\s+(.+?)\s+(to|from)\s+(.+)$/i.exec(plain);
  if (addMatch) {
    const isAdd = addMatch[1].toLowerCase() === "add";
    const name = variableName(addMatch[4]);
    return {
      type: "variable",
      title: "변수 수정",
      detail: name
        ? `${scopeLabel(name)}${isAdd ? "에" : "에서"} \`${addMatch[2]}\` 을 ${isAdd ? "더합니다" : "뺍니다"}.`
        : `\`${addMatch[4]}\` ${isAdd ? "에" : "에서"} \`${addMatch[2]}\` 을 ${isAdd ? "더합니다" : "뺍니다"}.`
    };
  }
  const deleteMatch = /^(delete|reset)\s+(.+)$/i.exec(plain);
  if (deleteMatch) {
    const name = variableName(deleteMatch[2]);
    return {
      type: "variable",
      title: "변수 삭제",
      detail: name ? `${scopeLabel(name)}를 ${deleteMatch[1].toLowerCase() === "delete" ? "삭제합니다" : "초기화합니다"}.` : `\`${deleteMatch[2]}\` 을 초기화합니다.`
    };
  }

  if (/^wait\s+/i.test(plain)) {
    const duration = plain.replace(/^wait\s+/i, "");
    return {
      type: "wait",
      title: "대기",
      detail: `\`${duration}\` 동안 기다립니다. 기다리는 동안 이 트리거는 다음 줄로 넘어가지 않습니다.`
    };
  }

  if (/^cancel( event)?$/i.test(plain)) {
    return {
      type: "control",
      title: "이벤트 취소",
      detail: "발생한 이벤트를 취소해 원래 게임 동작을 막습니다."
    };
  }
  if (/^stop$/i.test(plain)) {
    return { type: "control", title: "실행 중지", detail: "이 지점에서 트리거 실행을 즉시 멈춥니다." };
  }
  if (/^return\b/i.test(plain)) {
    return {
      type: "control",
      title: "값 반환",
      detail: "함수를 끝내고 호출한 쪽에 값을 돌려줍니다."
    };
  }
  if (/^exit loop$/i.test(plain)) {
    return { type: "control", title: "반복 탈출", detail: "가장 가까운 반복문을 즉시 빠져나갑니다." };
  }
  if (/^continue$/i.test(plain)) {
    return { type: "control", title: "다음 반복", detail: "이번 반복을 건너뛰고 다음 항목으로 넘어갑니다." };
  }

  const sendMatch = /^send\s+(.+?)(?:\s+to\s+(.+))?$/i.exec(plain);
  if (sendMatch) {
    const message = colorize(sendMatch[1]).replace(/^"|"$/g, "");
    const target = sendMatch[2]?.trim();
    return {
      type: "action",
      title: "메시지 전송",
      detail: target ? `\`${target}\` 에게 "${message}" 메시지를 보냅니다.` : `"${message}" 메시지를 보냅니다.`
    };
  }
  const broadcastMatch = /^broadcast\s+(.+)$/i.exec(plain);
  if (broadcastMatch) {
    return {
      type: "action",
      title: "전체 방송",
      detail: `서버의 모든 플레이어에게 "${colorize(broadcastMatch[1]).replace(/^"|"$/g, "")}" 를 방송합니다.`
    };
  }

  if (/^(give|take)\b/i.test(plain)) {
    return {
      type: "action",
      title: /^give/i.test(plain) ? "아이템 지급" : "아이템 회수",
      detail: `\`${plain}\` — 대상의 인벤토리에서 아이템을 ${/^give/i.test(plain) ? "지급" : "회수"}합니다.`
    };
  }
  if (/^teleport\b/i.test(plain)) {
    return { type: "action", title: "이동", detail: `\`${plain}\` — 대상의 위치를 바꿉니다.` };
  }
  if (/^(damage|kill|heal|feed)\b/i.test(plain)) {
    return {
      type: "action",
      title: "엔티티 상태 변경",
      detail: `\`${plain}\` — 대상의 체력/상태를 바꿉니다.`
    };
  }
  if (/^apply\b/i.test(plain)) {
    return { type: "action", title: "효과 적용", detail: `\`${plain}\` — 포션 효과를 적용합니다.` };
  }
  if (/^(open|close)\b/i.test(plain)) {
    return {
      type: "action",
      title: /^open/i.test(plain) ? "GUI 열기" : "GUI 닫기",
      detail: `\`${plain}\` — 인벤토리/GUI를 ${/^open/i.test(plain) ? "엽니다" : "닫습니다"}.`
    };
  }
  if (/^execute\b/i.test(plain)) {
    return { type: "action", title: "명령 실행", detail: `\`${plain}\` — 다른 명령을 대신 실행합니다.` };
  }
  if (/^play\b/i.test(plain)) {
    return { type: "action", title: "효과 재생", detail: `\`${plain}\` — 사운드나 파티클을 재생합니다.` };
  }
  if (/^(show|hide)\b/i.test(plain)) {
    return {
      type: "action",
      title: "표시 전환",
      detail: `\`${plain}\` — 대상을 ${/^show/i.test(plain) ? "보이게" : "숨깁니다"}.`
    };
  }
  if (/^(set|add|remove)\b/i.test(plain)) {
    return { type: "variable", title: "값 수정", detail: `\`${plain}\` — 값을 바꿉니다.` };
  }

  return {
    type: "action",
    title: "실행",
    detail: `\`${plain}\` 줄을 실행합니다.`
  };
}

const COMMAND_META = /^(permission|permission message|description|aliases|usage|executable by|cooldown|cooldown message|cooldown bypass|cooldown storage|prefix)\s*:/i;

export function buildFlow(content: string, trigger: TriggerBlock): FlowStep[] {
  const lines = content.split(/\r\n|\r|\n/);
  const described = describeTrigger(trigger);
  const steps: FlowStep[] = [
    {
      id: `flow-${trigger.line}`,
      line: trigger.line,
      depth: 0,
      type: "event",
      title: described.title,
      detail: described.detail,
      code: `${trigger.header}:`
    }
  ];

  const indentLevels = [0];

  for (let index = trigger.bodyStartLine - 1; index < trigger.endLine && index < lines.length; index += 1) {
    const raw = lines[index];
    const code = stripComment(raw).trim();
    if (!code) {
      continue;
    }
    if (/^trigger\s*:$/i.test(code)) {
      continue;
    }
    if (trigger.kind === "command" && COMMAND_META.test(code)) {
      continue;
    }

    const indent = measureIndent(raw);
    while (indentLevels.length > 1 && indent <= indentLevels[indentLevels.length - 1]) {
      indentLevels.pop();
    }
    if (indent > indentLevels[indentLevels.length - 1]) {
      indentLevels.push(indent);
    }
    const depth = Math.min(indentLevels.length - 1, 6);
    const explained = explainFlowLine(code);

    steps.push({
      id: `flow-${index + 1}`,
      line: index + 1,
      depth,
      type: explained.type,
      title: explained.title,
      detail: explained.detail,
      code
    });
  }

  return steps;
}
