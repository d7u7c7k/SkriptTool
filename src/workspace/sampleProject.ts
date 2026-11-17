export type SampleFile = {
  relativePath: string;
  content: string;
};

const hello = `# SkriptTool v2 예제 · 손으로 쓰는 첫 스크립트
# Ctrl/Cmd + S 로 저장합니다. 오른쪽 "코드 흐름" 패널에서 실행 순서를 확인하세요.

options:
  prefix: &6[서버]

on join:
  send "{@prefix} &f환영합니다, %player's name%님!" to player
  set {_visits} to 0
  add 1 to {_visits}
  send "&7이번 접속에서 %{_visits}%번 인사했어요." to player

command /인사:
  description: 인사를 건넵니다
  trigger:
    if player is op:
      send "&a관리자님, 안녕하세요!" to player
    else:
      send "&f안녕하세요, %player's name%님!" to player

function healAll(p: player):
  loop all players:
    if loop-player's health is less than 10:
      heal loop-player
      send "&a체력을 회복했습니다." to loop-player
`;

const shop = `# 예제 · 상점 GUI와 인벤토리 클릭
# {_지역변수}는 이 트리거 안에서만, {전역변수}는 서버에 저장됩니다.

command /상점:
  permission: shop.use
  description: 상점 GUI를 엽니다
  trigger:
    open chest inventory with 3 rows named "&8상점" to player
    set slot 4 of player's current inventory to golden apple
    set slot 22 of player's current inventory to diamond

on inventory click:
  if event-inventory's name is "&8상점":
    cancel event
    if index of event-slot is 4:
      give 1 golden apple to player
      send "&a황금 사과를 구매했습니다." to player
    else if index of event-slot is 22:
      give 1 diamond to player
      send "&b다이아몬드를 구매했습니다." to player
`;

const optimize = `# 예제 · 반복과 최적화
# 아래 every 5 seconds는 짧은 주기 경고를 보여 줍니다.

every 5 seconds:
  loop all players:
    if loop-player's health is less than 5:
      send "&c체력이 위험합니다!" to loop-player

on right click with compass:
  loop all players:
    if loop-player's world is player's world:
      send "&7같은 월드에 있는 플레이어: %loop-player's name%" to player
`;

const diagnosticsDemo = `# 예제 · 진단 데모 (일부러 오류와 경고를 넣은 파일입니다)
# 빨간줄 = 문법 오류, 노란줄 = 예전 문법 / 프로젝트에 없는 애드온 문법
# 아래 오류는 앱이 어떻게 잡아 주는지 보여 주기 위한 예시입니다.

on join:
  send "&a환영합니다, %player's name%님" to player

on rightclick:
  send "&7우클릭을 감지했습니다." to player

on break of stone
  send "&7돌을 캤습니다." to player

command /nbt:
  trigger:
    set {_data} to nbt of player
    send "&bNBT: %{_data}%" to player

# SkBee를 확장에서 추가하면 아래 두 줄의 노란줄이 사라집니다.
set action bar of player to "&e안녕하세요"
format slot 0 of player with stone
`;

export const sampleProject: SampleFile[] = [
  { relativePath: "hello.sk", content: hello },
  { relativePath: "shop.sk", content: shop },
  { relativePath: "examples/optimize.sk", content: optimize },
  { relativePath: "examples/diagnostics.sk", content: diagnosticsDemo }
];
