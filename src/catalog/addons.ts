import type { AddonPackage } from "./types";

/**
 * 확장(애드온) 카탈로그.
 * compatibility 는 "이 MC/Skript 조합에서 쓸 수 있는가"를 판단하는 데 쓰입니다.
 *
 * inGameVersions 는 확장 패널·새 프로젝트 화면에 그대로 보이는 "인게임 지원 버전"입니다.
 * compatibility 의 minecraft 목록과 어긋나지 않게 적고(가장 낮은 버전 ~ 가장 높은 버전),
 * 같은 버전 하나로 구버전과 최신 버전을 모두 커버하는 애드온(skript-yaml 등)만
 * supportsLegacyAndLatest 로 표시해 카드에서 따로 구분합니다.
 */
export const addonPackages: AddonPackage[] = [
  {
    id: "skbee",
    name: "SkBee",
    description: "NBT, 스코어보드, 탭리스트, 보스바, 조합법 같은 최신 기능을 추가합니다.",
    versions: ["3.9.0", "3.8.2", "3.5.0", "3.0.0"],
    inGameVersions: "1.20.4 ~ 1.21.8",
    category: "core",
    sample: "nbt of player / scoreboard / tablist / bossbar",
    compatibility: {
      minecraft: ["1.21.8", "1.21.5", "1.21.4", "1.21.1", "1.20.6", "1.20.4"],
      skript: ["2.13.0", "2.12.1", "2.11.0", "2.10.0", "2.9.5", "2.8.7"]
    }
  },
  {
    id: "skript-gui",
    name: "skript-gui",
    description: "코드로 GUI 인벤토리를 만들고 슬롯을 채우는 문법을 추가합니다.",
    versions: ["1.3.2", "1.3.0", "1.2.1"],
    inGameVersions: "1.20.6 ~ 1.21.8",
    category: "gui",
    sample: "create a gui / make gui slot ... with stone",
    compatibility: {
      minecraft: ["1.21.8", "1.21.5", "1.21.4", "1.21.1", "1.20.6"],
      skript: ["2.13.0", "2.12.1", "2.11.0", "2.10.0", "2.9.5"]
    }
  },
  {
    id: "skript-reflect",
    name: "skript-reflect",
    description: "자바 클래스와 메서드를 Skript에서 직접 호출합니다. 다른 애드온이 없을 때 쓰는 확장용 애드온입니다.",
    versions: ["2.5.1", "2.4.0", "2.3.0"],
    inGameVersions: "1.19.4 ~ 1.21.8",
    category: "integration",
    sample: "import org.bukkit.Bukkit / new java class ...",
    compatibility: {
      minecraft: ["1.21.8", "1.21.5", "1.21.4", "1.21.1", "1.20.6", "1.20.4", "1.19.4"],
      skript: ["2.13.0", "2.12.1", "2.11.0", "2.10.0", "2.9.5", "2.8.7", "2.7.3"]
    }
  },
  {
    id: "skript-yaml",
    name: "skript-yaml",
    description: "YAML 파일을 읽고 쓰는 문법을 추가합니다. 설정 저장에 자주 씁니다.",
    versions: ["1.5.0", "1.4.0", "1.3.2"],
    inGameVersions: "1.8 ~ 1.21.8",
    supportsLegacyAndLatest: true,
    category: "data",
    sample: "set yaml value \"path\" of {_file} to 1",
    compatibility: "all"
  },
  {
    id: "skript-db",
    name: "skript-db",
    description: "데이터베이스 연결과 쿼리 실행 문법을 추가합니다.",
    versions: ["1.2.0", "1.1.2"],
    inGameVersions: "1.19.4 ~ 1.21.8",
    category: "data",
    sample: "execute query \"SELECT * FROM ...\"",
    compatibility: {
      minecraft: ["1.21.8", "1.21.5", "1.21.4", "1.20.4", "1.19.4"],
      skript: ["2.13.0", "2.12.1", "2.10.0", "2.9.5", "2.8.7"]
    }
  },
  {
    id: "skript-placeholders",
    name: "Skript-Placeholders",
    description: "PlaceholderAPI 자리표시자를 Skript 값으로 쓸 수 있게 합니다.",
    versions: ["2.0.0", "1.1.0"],
    inGameVersions: "1.19.4 ~ 1.21.8",
    category: "integration",
    sample: "placeholder \"player_health\" from player",
    requires: ["PlaceholderAPI"],
    compatibility: {
      minecraft: ["1.21.8", "1.21.5", "1.21.4", "1.21.1", "1.20.6", "1.20.4", "1.19.4"],
      skript: ["2.13.0", "2.12.1", "2.11.0", "2.10.0", "2.9.5"]
    }
  },
  {
    id: "skript-packet",
    name: "Skript-Packet",
    description: "패킷을 직접 보내는 문법을 추가합니다. ProtocolLib가 필요합니다.",
    versions: ["1.1.0", "1.0.4"],
    inGameVersions: "1.20.4 ~ 1.21.4",
    category: "integration",
    sample: "send packet ... / packet of player",
    requires: ["ProtocolLib"],
    compatibility: {
      minecraft: ["1.21.4", "1.21.1", "1.20.6", "1.20.4"],
      skript: ["2.10.0", "2.9.5"]
    }
  },
  {
    id: "skript-advancements",
    name: "Skript-Advancements",
    description: "발전 과제(advancement)를 코드로 만들고 지급합니다.",
    versions: ["2.1.2", "2.0.0"],
    inGameVersions: "1.20.6 ~ 1.21.8",
    category: "integration",
    sample: "advancement \"story/root\" of player",
    compatibility: {
      minecraft: ["1.21.8", "1.21.5", "1.21.4", "1.20.6"],
      skript: ["2.13.0", "2.12.1", "2.11.0", "2.10.0"]
    }
  },
  {
    id: "skrayfall",
    name: "SkRayFall",
    description: "타이틀, 보스바, 홀로그램 같은 오래된 편의 문법을 모아 둔 애드온입니다.",
    versions: ["1.9.28", "1.9.25"],
    inGameVersions: "1.19.4 ~ 1.21.1",
    category: "legacy",
    sample: "send title \"...\" with subtitle \"...\"",
    compatibility: {
      minecraft: ["1.21.1", "1.20.6", "1.20.4", "1.19.4"],
      skript: ["2.11.0", "2.10.0", "2.9.5", "2.8.7"]
    }
  },
  {
    id: "skquery",
    name: "SkQuery",
    description: "고전 GUI·유틸 문법. 지금은 대부분 기본 문법이나 skript-gui로 대체되었습니다.",
    versions: ["4.1.1", "4.0.0", "3.6.0"],
    inGameVersions: "1.19.4 ~ 1.20.6",
    category: "legacy",
    sample: "open virtual chest / format slot",
    compatibility: {
      minecraft: ["1.20.6", "1.20.4", "1.19.4"],
      skript: ["2.9.5", "2.8.7", "2.7.3"]
    }
  },
  {
    id: "skellett",
    name: "Skellett",
    description: "홀로그램, 커스텀 엔티티 등 추가 기능을 제공하는 오래된 애드온입니다.",
    versions: ["2.0.10", "1.9.6"],
    inGameVersions: "1.19.4 ~ 1.20.4",
    category: "legacy",
    sample: "create a hologram / custom entity",
    compatibility: {
      minecraft: ["1.20.4", "1.19.4"],
      skript: ["2.8.7", "2.7.3"]
    }
  },
  {
    id: "tuske",
    name: "TuSKe",
    description: "구형 GUI·조합법 문법. 최신 Skript와 함께 쓰기 어렵습니다.",
    versions: ["1.8.2", "1.7.5"],
    inGameVersions: "1.19.4",
    category: "legacy",
    sample: "create a custom inventory ...",
    compatibility: {
      minecraft: ["1.19.4"],
      skript: ["2.7.3"]
    }
  }
];

export function findAddonPackage(id: string): AddonPackage | undefined {
  return addonPackages.find((addon) => addon.id === id);
}
