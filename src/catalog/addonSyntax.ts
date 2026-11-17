/**
 * 애드온이 제공하는 대표 문법 패턴.
 * 프로젝트에 해당 애드온이 없는데 이 패턴이 코드에 나오면 노란줄(경고)로 안내합니다.
 */
export type AddonSyntaxRule = {
  /** 같은 애드온 안에서 유일한 규칙 ID */
  id: string;
  /** 확장 패널·진단에서 보여 줄 대표 문법 */
  sample: string;
  /** 줄 전체에서 찾을 패턴 (문자열·주석은 제거한 코드에 적용) */
  pattern: RegExp;
  /** 안내에 덧붙일 설명 */
  detail?: string;
};

export const addonSyntax: Record<string, AddonSyntaxRule[]> = {
  skbee: [
    { id: "skbee-nbt", sample: "nbt of player", pattern: /\bnbt (?:of|from)\b/i, detail: "NBT 값은 SkBee의 표현식입니다." },
    { id: "skbee-set-nbt", sample: "set nbt of player to ...", pattern: /\b(?:set|add|remove)\s+nbt\b/i },
    { id: "skbee-scoreboard", sample: "scoreboard objective ...", pattern: /\bscore ?board(?:s)?\b/i },
    { id: "skbee-tablist", sample: "tablist header", pattern: /\btab ?list\b/i },
    { id: "skbee-bossbar", sample: "bossbar \"...\"", pattern: /\bboss ?bars?\b/i },
    { id: "skbee-bound", sample: "bound {_loc} to {_world}", pattern: /\bbound (?:of|to)\b/i },
    { id: "skbee-recipe", sample: "recipe for ...", pattern: /\brecipe (?:for|of)\b/i },
    { id: "skbee-item-component", sample: "item component of ...", pattern: /\bitem components?\b/i }
  ],
  "skript-reflect": [
    { id: "reflect-import", sample: "import org.bukkit.Bukkit", pattern: /^\s*import\s+[\w.]+/i, detail: "자바 클래스 import는 skript-reflect 전용 문법입니다." },
    { id: "reflect-new", sample: "new java class ...", pattern: /\bnew\s+[\w.]+\s*\(/i },
    { id: "reflect-keyword", sample: "reflect ...", pattern: /\breflect\b/i },
    { id: "reflect-java", sample: "java class ...", pattern: /\bjava (?:class|type|method|field)\b/i }
  ],
  "skript-gui": [
    { id: "gui-create", sample: "create a gui ...", pattern: /\bcreate (?:a )?gui\b/i },
    { id: "gui-slot", sample: "make gui slot 0 of {_gui} with stone:", pattern: /\bmake gui slot\b/i },
    { id: "gui-open", sample: "open {_gui} to player", pattern: /\bopen (?:the )?gui\b/i },
    { id: "gui-add", sample: "add ... to gui", pattern: /\badd .{0,40}\bto gui\b/i }
  ],
  skquery: [
    { id: "skquery-virtual", sample: "open virtual chest ...", pattern: /\bopen virtual\b/i },
    { id: "skquery-unstealable", sample: "unstealable", pattern: /\bunstealable\b/i }
  ],
  "skript-yaml": [
    { id: "yaml-value", sample: "set yaml value \"path\" of {_file} to ...", pattern: /\byaml (?:value|node|list)\b/i },
    { id: "yaml-load", sample: "load yaml \"config.yml\" as \"cfg\"", pattern: /\b(?:load|save) yaml\b/i }
  ],
  "skript-db": [
    { id: "db-query", sample: "execute query \"SELECT ...\"", pattern: /\bexecute (?:a )?(?:query|statement|update)\b/i },
    { id: "db-connection", sample: "connection to ...", pattern: /\bconnection (?:to|named)\b/i }
  ],
  "skript-placeholders": [
    { id: "papi-placeholder", sample: "placeholder \"player_name\" from player", pattern: /\bplaceholders?\b/i }
  ],
  "skript-packet": [
    { id: "packet", sample: "send packet ...", pattern: /\bpackets?\b/i },
    { id: "packet-protocollib", sample: "ProtocolLib", pattern: /\bprotocol ?lib\b/i }
  ],
  "skript-advancements": [
    { id: "advancement", sample: "advancement \"story/root\" of player", pattern: /\badvancements?\b/i }
  ],
  skrayfall: [
    { id: "rayfall-title", sample: "send title \"...\" with subtitle \"...\"", pattern: /\b(?:send|display) titles?\b/i },
    { id: "rayfall-subtitle", sample: "subtitle \"...\"", pattern: /\bsubtitles?\b/i }
  ],
  skellett: [
    { id: "skellett-hologram", sample: "create a hologram ...", pattern: /\bholograms?\b/i },
    { id: "skellett-custom-entity", sample: "custom entity ...", pattern: /\bcustom (?:entity|mob|npc)\b/i }
  ],
  tuske: [
    { id: "tuske-inventory", sample: "create a custom inventory ...", pattern: /\bcustom inventory\b/i },
    { id: "tuske-keyword", sample: "tuske ...", pattern: /\btuske\b/i }
  ]
};

/** 애드온 ID → 이 애드온이 걸리는 문법 목록 (없으면 빈 배열) */
export function syntaxForAddon(addonId: string): AddonSyntaxRule[] {
  return addonSyntax[addonId] ?? [];
}
