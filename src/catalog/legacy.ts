import { atLeast } from "./versions";

/**
 * 선택한 Skript 버전에서 더 이상 권장되지 않거나 제거된 "예전 문법".
 * `since` 이상 버전을 프로젝트에서 쓰면 노란줄(경고)로 안내합니다.
 */
export type LegacyRule = {
  id: string;
  pattern: RegExp;
  /** 이 Skript 버전부터 비권장/폐기 */
  since: string;
  /** 이 버전부터 제거되어 동작하지 않음 (알 수 없으면 생략) */
  removedIn?: string;
  /** 한 줄 요약 */
  message: string;
  /** 지금은 이렇게 쓰세요 */
  alternative: string;
  example?: string;
};

export const legacyRules: LegacyRule[] = [
  {
    id: "rightclick",
    pattern: /\bon\s+rightclick\b/i,
    since: "2.6.0",
    message: "`on rightclick`은 예전 표기입니다.",
    alternative: "이벤트 이름을 띄어 쓴 `on right click`을 사용하세요.",
    example: "on right click:"
  },
  {
    id: "leftclick",
    pattern: /\bon\s+leftclick\b/i,
    since: "2.6.0",
    message: "`on leftclick`은 예전 표기입니다.",
    alternative: "이벤트 이름을 띄어 쓴 `on left click`을 사용하세요.",
    example: "on left click:"
  },
  {
    id: "format-slot",
    pattern: /\bformat slot\b/i,
    since: "2.6.0",
    message: "`format slot`은 구형 SkQuery GUI 문법입니다.",
    alternative: "Skript 기본 GUI(`open chest inventory`)나 skript-gui의 `make gui slot`을 쓰세요.",
    example: 'open chest inventory with 3 rows named "&8상점" to player'
  },
  {
    id: "set-action-bar",
    pattern: /\bset action ?bar (?:of|to)\b/i,
    since: "2.4.0",
    message: "`set action bar of ...`는 구형 표기입니다.",
    alternative: "`send action bar \"...\" to player`로 바꾸세요.",
    example: 'send action bar "&e체력 3" to player'
  },
  {
    id: "loop-entity",
    pattern: /\bloop-(?:entity|entities)\b/i,
    since: "2.7.0",
    message: "`loop-entity`는 구형 반복 변수 표기입니다.",
    alternative: "플레이어라면 `loop-player`, 그 밖의 대상은 `loop-value`를 쓰세요.",
    example: "loop all players:\n  send loop-player's name to player"
  },
  {
    id: "unstealable",
    pattern: /\bunstealable\b/i,
    since: "2.6.0",
    message: "`unstealable`은 구형 SkQuery GUI 문법입니다.",
    alternative: "GUI 슬롯은 클릭 이벤트에서 `cancel event`로 막는 방식이 지금의 표준입니다.",
    example: "on inventory click:\n  cancel event"
  },
  {
    id: "damage-cause",
    pattern: /\bdamage cause (?:is|=)\b/i,
    since: "2.8.0",
    message: "`damage cause`는 최신 Skript에서 `damage cause of event` 형태를 권장합니다.",
    alternative: "`if damage cause of event is ...`처럼 대상을 붙여 쓰세요.",
    example: "if damage cause of event is fall:"
  }
];

export function activeLegacyRules(skriptVersion: string): LegacyRule[] {
  return legacyRules.filter((rule) => atLeast(skriptVersion, rule.since));
}

/** 이 버전에서 이미 제거된 문법인지 (메시지를 더 강하게) */
export function isRemoved(rule: LegacyRule, skriptVersion: string): boolean {
  return Boolean(rule.removedIn) && atLeast(skriptVersion, rule.removedIn as string);
}
