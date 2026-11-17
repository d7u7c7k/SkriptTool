/** 애드온이 추가되어 있을 때만 자동완성에 보이는 스니펫. */
export type AddonSnippet = { label: string; insert: string; detail: string };

export const addonSnippets: Record<string, AddonSnippet[]> = {
  skbee: [
    { label: "nbt of ...", insert: "nbt of ${1:player}", detail: "NBT 조회 (SkBee)" },
    { label: "set nbt of ... to ...", insert: "set nbt of ${1:player} to ${2:{_nbt}}", detail: "NBT 설정 (SkBee)" },
    { label: "scoreboard", insert: "set {_board} to scoreboard objective ${1:\"coins\"}", detail: "스코어보드 (SkBee)" },
    { label: "tablist header", insert: "set tablist header of ${1:player} to \"${2:&6서버}\"", detail: "탭리스트 (SkBee)" },
    { label: "bossbar", insert: "set {_bar} to bossbar \"${1:&c보스}\" with progress 1", detail: "보스바 (SkBee)" }
  ],
  "skript-gui": [
    { label: "create a gui", insert: "create a gui with ${1:3} rows named \"${2:&8GUI}\":", detail: "GUI 만들기 (skript-gui)" },
    {
      label: "make gui slot",
      insert: "make gui slot ${1:0} of {_gui} with ${2:stone} to be ${3:unstealable}",
      detail: "GUI 슬롯 채우기 (skript-gui)"
    },
    { label: "open gui", insert: "open {_gui} to ${1:player}", detail: "GUI 열기 (skript-gui)" }
  ],
  "skript-reflect": [
    { label: "import java class", insert: "import ${1:org.bukkit.Bukkit}", detail: "자바 클래스 import (skript-reflect)" },
    { label: "new java object", insert: "set {_x} to new ${1:java.util.ArrayList}()", detail: "자바 객체 생성 (skript-reflect)" }
  ],
  "skript-yaml": [
    {
      label: "load yaml",
      insert: "load yaml \"${1:config.yml}\" as \"${2:cfg}\"",
      detail: "YAML 파일 열기 (skript-yaml)"
    },
    {
      label: "set yaml value",
      insert: "set yaml value \"${1:path}\" of file \"${2:cfg}\" to ${3:1}",
      detail: "YAML 값 저장 (skript-yaml)"
    }
  ],
  "skript-db": [
    { label: "execute query", insert: "execute query \"${1:SELECT * FROM table}\"", detail: "DB 쿼리 (skript-db)" }
  ],
  "skript-placeholders": [
    { label: "placeholder from player", insert: "placeholder \"${1:player_name}\" from ${2:player}", detail: "PAPI 값 (Skript-Placeholders)" }
  ],
  "skript-packet": [
    { label: "send packet", insert: "send packet ${1:{_packet}} to ${2:player}", detail: "패킷 전송 (Skript-Packet)" }
  ],
  "skript-advancements": [
    {
      label: "advancement of player",
      insert: "if advancement \"${1:story/root}\" of ${2:player} is not granted:",
      detail: "발전 과제 (Skript-Advancements)"
    }
  ],
  skrayfall: [
    {
      label: "send title",
      insert: "send title \"${1:&6제목}\" with subtitle \"${2:&f부제목}\" to ${3:player}",
      detail: "타이틀 (SkRayFall)"
    }
  ],
  skquery: [
    { label: "open virtual chest", insert: "open virtual chest inventory with ${1:3} rows named \"${2:&8GUI}\" to ${3:player}", detail: "가상 GUI (SkQuery)" }
  ],
  skellett: [
    { label: "create a hologram", insert: "create a hologram at ${1:player's location} with text \"${2:&e안내}\"", detail: "홀로그램 (Skellett)" }
  ],
  tuske: [
    { label: "create a custom inventory", insert: "create a custom inventory named \"${1:&8GUI}\" with ${2:3} rows", detail: "커스텀 GUI (TuSKE)" }
  ]
};
