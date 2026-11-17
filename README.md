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
| `Ctrl/Cmd + O` | 폴더 열기 |
| `Ctrl/Cmd + N` | 새 `.sk` 파일 |
| `Ctrl/Cmd + B` | 사이드바 접기/펼치기 |
| `Ctrl/Cmd + Shift + I` | 코드 흐름 패널 토글 |

## 구조

```
electron/
  main.cts                 창 생성, 폴더/파일 IPC, 경로 검증
  preload.cts              contextBridge로 skriptApi 노출
src/
  theme/                   CSS 변수 + Monaco 테마, 프리셋/커스텀, localStorage
  workspace/               폴더 트리, 탭, Electron/브라우저/인메모리 파일 어댑터
  diagnostics/             정적 진단 규칙과 접이식 진단 바
  inspector/               트리거 파싱 · 실행 흐름 · 변수 요약
  editor/                  Monaco 에디터 래퍼(마커/테마 연동)
  settings/                테마·에디터 설정 화면
  environment/             MC / Skript / 애드온 환경 선택
  catalog/                 버전·애드온 호환 데이터
  skriptLanguage.ts        Skript 문법 하이라이트, 자동완성, hover
```

## 브라우저 모드

Electron 없이 `npm run preview`로 열면 예제 워크스페이스로 시작합니다.
Chromium 계열 브라우저에서는 `폴더 열기`로 실제 폴더를 연결할 수 있고(File System Access API),
지원하지 않는 브라우저에서는 메모리 워크스페이스에 파일을 만들고 저장할 수 있습니다(새로고침 시 초기화).
