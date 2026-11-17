# SkriptTool v2

Minecraft Skript를 **손으로 쓰면서 배우는** 데스크톱 에디터입니다.
AI가 코드를 대신 생성하지 않습니다. 대신 지금 쓴 코드가 **어떤 흐름으로 실행되는지**, 어디가 서버에 부담인지를 옆에서 짚어 줍니다.

## v2에서 달라진 점

- **다크 미니멀 기본 디자인** — VS Code를 흉내 낸 7개 탭·양옆 가득한 패널 구조를 버리고, 파일 트리 + 탭 + 에디터 + 접이식 진단 바 + 토글형 흐름 패널만 남겼습니다.
- **커스텀 테마** — `Midnight Dark`(기본), `Deep Slate`, `Forest Charcoal`, `Clean Light` 프리셋과 배경/패널/강조색/텍스트/에디터 폰트를 직접 조절하는 커스텀 테마. 설정은 `localStorage`에 저장됩니다.
- **AI 코드 생성 제거** — `src/aiService.ts`와 외부 AI 호출을 삭제했습니다. 남은 도우미는 순수 정적 파서/분석기뿐입니다.
- **`@tool` 마커 폐기** — `@tool:inventory`, `@tool:send` 강제 마커와 ToolDock을 제거하고, 프로젝트 폴더의 `.sk` 파일을 자유롭게 손코딩하는 구조로 바꿨습니다.
- **프로젝트 폴더 & 멀티 탭** — Electron IPC로 폴더 열기 / `.sk` 트리 / 새 파일 생성 / 저장 / 다른 이름으로 저장. 브라우저 모드에서는 File System Access API, 그것도 없으면 인메모리 예제 워크스페이스로 동작합니다.
- **교육·최적화 진단** — 매 틱 반복, 짧은 주기의 `loop all players`, 반복문 안 `wait`, 전역/지역 변수, `rightclick` 같은 구버전 표기, 탭/스페이스 혼용을 실시간으로 표시합니다.
- **코드 흐름 인스펙터** — 현재 파일의 트리거(`on`, `command`, `function`, `every`)와 선택한 트리거의 실행 단계(이벤트 → 조건 → 반복 → 실행/변수)를 한국어로 보여 주고, 변수 사용을 지역/전역으로 나눠 요약합니다. 항목을 누르면 해당 줄로 이동합니다.

## 시작 화면 · 프로젝트 · 확장 (v2.1)

### 시작 화면 (Launcher)
앱을 열면 에디터로 바로 들어가지 않고 Adobe Premiere/Photoshop 스타일의 시작 화면이 먼저 나옵니다.

- **새 프로젝트 만들기** — 이름 → 저장 위치 → Minecraft/Skript 버전 → 애드온 순서의 2단계 모달
- **프로젝트 열기** — `.skripttool.json`이 있으면 저장된 버전·애드온 환경을 그대로 불러옵니다
- **최근 프로젝트** — `localStorage`에 저장되며, 누르면 바로 열립니다 (경로가 사라졌으면 목록에서 자동 제거)
- **예제 워크스페이스로 둘러보기** — 버전·애드온 진단을 바로 볼 수 있는 메모리 프로젝트
- 에디터 상단바에서도 홈 / 새 프로젝트 / 확장으로 바로 이동할 수 있습니다.

### `.skripttool.json`
프로젝트 폴더의 설정 파일입니다. 파일 트리에는 표시되지 않습니다.

```json
{
  "configVersion": 1,
  "name": "서버 상점",
  "minecraftVersion": "1.21.4",
  "skriptVersion": "2.13.0",
  "addons": ["skbee", "skript-gui"],
  "createdAt": "2026-11-17T11:31:04.536Z",
  "updatedAt": "2026-11-17T11:31:15.266Z"
}
```

새 프로젝트는 `main.sk`와 이 파일을 함께 만들고, 버전이나 애드온이 바뀔 때마다 즉시 다시 저장합니다.
설정이 없는 폴더를 열면 기본값으로 열고 `.skripttool.json`을 새로 저장합니다.

### 확장(애드온) 관리 (Ctrl/Cmd+E)
- 현재 프로젝트의 MC/Skript 버전과 호환되는 애드온만 추가할 수 있습니다. 비호환 애드온은 사유(지원 버전 범위)와 함께 흐리게 표시됩니다.
- 추가/제거는 즉시 `.skripttool.json`에 반영되고, 진단·자동완성·Monaco 빠른 수정이 같은 순간에 갱신됩니다.
- 모든 애드온 카드(새 프로젝트 모달 포함)에 **인게임 지원 버전** 배지(`인게임 MC 1.19.4 ~ 1.21.8`)를 항상 표시합니다. 호환/비호환 모두 보입니다.
- `skript-yaml`처럼 구버전 MC와 최신 MC를 같은 버전으로 커버하는 애드온에는 **`구버전~최신 지원`** 배지와 "같은 버전 하나로 구버전 MC 1.8 서버부터 최신 MC 1.21.8 서버까지 쓸 수 있습니다" 안내를 함께 보여 줍니다.

### 공용 마크 리소스 라이브러리 (v2.3)
인게임 마크의 아이템·블록 텍스처를 **앱 공용 데이터 폴더에 버전별로 한 번만** 풀어 두고 모든 프로젝트가 재사용합니다. 프로젝트 폴더에는 아무것도 복사하지 않습니다.

- **저장 위치** — `<앱 데이터>/shared-mc-library/<버전>/textures/{item,block}/*.png` + `index.json`(버전·출처·텍스처 수·용량·생성 시각). Windows는 `%APPDATA%\SkriptTool\shared-mc-library`, macOS는 `~/Library/Application Support/SkriptTool/shared-mc-library` 아래입니다. 정확한 경로는 설정 화면에 표시됩니다.
- **자동 탐색 순서** — ① 설치된 마크의 `versions/<현재 프로젝트 MC 버전>/<버전>.jar` → ② 정확히 없으면 `versions/`의 최신 설치 버전 `.jar` → ③ `versions/`가 비어 있으면 `resourcepacks/`의 최신 팩(`.zip`/폴더). 테스트용으로 `SKRIPTTOOL_MC_HOME` 환경변수로 마크 경로를 바꿀 수 있습니다.
- **중복 방지** — 같은 버전 캐시가 `index.json`과 텍스처까지 온전하면 다시 풀지 않고 즉시 재사용합니다(UI에 `공용 캐시 재사용` 표시).
- **직접 선택** — 「리소스팩 / JAR 직접 선택」으로 `.jar`, 리소스팩 `.zip`, 압축을 푼 팩 폴더를 고를 수 있습니다. 고른 파일은 읽기만 합니다.
- **안전 추출** — `assets/minecraft/textures/item|block` 아래의 진짜 PNG만 저장하고, 절대 경로·`..`·드라이브 문자·비-PNG 파일은 건너뜁니다(Zip Slip 차단).
- **관리** — 설정 화면에서 버전별 목록·총 용량·저장 경로를 보고, 필요 없는 버전은 개별 삭제할 수 있습니다. 상단바 블록 아이콘, 상태바의 `공용 리소스 라이브러리`, 환경 팝오버에서 바로 열립니다.
- **브라우저 모드** — PC 폴더 접근이 필요하므로 Electron 전용입니다. 브라우저에서는 안내 문구만 보여 주고 다른 기능은 그대로 동작합니다.

### 문법 진단 색상
| 표시 | 의미 | 예 |
| --- | --- | --- |
| 빨간줄 (Error) | 기본 문법 오류 | `:` 누락, 괄호/중괄호/따옴표/`%` 짝 불일치, `command`의 `trigger:` 누락, 블록 안 들여쓰기 혼용 |
| 노란줄 (Warning) | 선택한 Skript 버전에서 폐기된 예전 문법 | `on rightclick`, `set action bar of ...`, `loop-entity`, `format slot` |
| 노란줄 (Warning) | 프로젝트에 없는 애드온 전용 문법 | `nbt of`, `import ...`, `make gui slot`, `create a gui`, `open virtual`, `yaml value` … |
| 파란 힌트 (Hint) | 학습·최적화 팁 | `every tick` 부하, 넓은 `loop`, 반복문 안 `wait`, 전역 변수 |

애드온 문법 경고는 진단 바에서 **원클릭으로 그 애드온을 추가**하거나 Monaco 전구(빠른 수정)에서 바로 처리할 수 있습니다.

## 실행

```bash
npm install
npm run dev
```

현재 PC에 `ELECTRON_RUN_AS_NODE=1` 환경변수가 있어도 `npm run dev`는 실행 직전에 해당 값을 제거합니다.

## 빌드 확인

```bash
npm run build
```

`tsc` → `vite build` → `tsc -p electron/tsconfig.json` 순서로 타입 검사와 번들을 모두 확인합니다.

## Windows 설치 파일

```bash
npm run dist
```

완성된 설치 파일은 `release/` 폴더에 생성됩니다.

## 단축키

| 단축키 | 동작 |
| --- | --- |
| `Ctrl/Cmd + S` | 현재 탭 저장 |
| `Ctrl/Cmd + Shift + S` | 다른 이름으로 저장 |
| `Ctrl/Cmd + O` | 프로젝트 열기 |
| `Ctrl/Cmd + N` | 새 `.sk` 파일 (시작 화면에서는 새 프로젝트) |
| `Ctrl/Cmd + E` | 확장(애드온) 관리 |
| `Ctrl/Cmd + B` | 사이드바 접기/펼치기 |
| `Ctrl/Cmd + Shift + I` | 코드 흐름 패널 토글 |

## 구조

```
electron/
  main.cts                 창 생성, 프로젝트 생성/열기·설정 파일·파일 IPC, 경로 검증, mcLibrary IPC
  minecraftLibrary.cts     공용 마크 리소스 라이브러리(마크 경로 탐색·JAR/리소스팩 추출·캐시 관리)
  preload.cts              contextBridge로 skriptApi 노출
src/
  launcher/                시작 화면과 새 프로젝트 모달
  project/                 .skripttool.json 직렬화·복구, 최근 프로젝트, 기본 스크립트 템플릿
  addons/                  확장(애드온) 관리 패널
  theme/                   CSS 변수 + Monaco 테마, 프리셋/커스텀, localStorage
  workspace/               폴더 트리, 탭, Electron/브라우저/인메모리 파일 어댑터
  diagnostics/             정적 진단 규칙과 접이식 진단 바
  inspector/               트리거 파싱 · 실행 흐름 · 변수 요약
  editor/                  Monaco 에디터 래퍼(마커/테마 연동)
  settings/                테마·에디터 설정 화면, 공용 마크 리소스 라이브러리 섹션
  environment/             MC / Skript 버전 선택 팝오버
  catalog/                 버전·애드온 카탈로그, 호환성 판정, 애드온/구버전 문법 패턴
  skriptLanguage.ts        Skript 문법 하이라이트, 자동완성, hover, 확장 빠른 수정
```

## 브라우저 모드

Electron 없이 `npm run preview`로 열면 시작 화면이 나오고, `예제 워크스페이스로 둘러보기`로 바로 편집할 수 있습니다.
Chromium 계열 브라우저에서는 `프로젝트 열기`로 실제 폴더를 연결할 수 있고(File System Access API),
지원하지 않는 브라우저에서는 `새 프로젝트`가 메모리 프로젝트로 만들어집니다 — 이때 `.skripttool.json`은 저장되지 않습니다.
