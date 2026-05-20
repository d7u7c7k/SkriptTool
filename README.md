# Skript Tool

Minecraft Skript 개발자를 위한 VS Code 스타일 데스크톱 개발 도구입니다.

## 현재 포함된 기능

- Electron 기반 설치형 데스크톱 앱 구조
- React + TypeScript UI
- Monaco Editor 기반 Skript 편집기
- `.sk` 파일 열기/저장
- 빠른 환경 세팅: Minecraft 버전, Skript 버전, 애드온 이름/버전
- 시각적 인벤토리 에디터: Minecraft GUI 형태로 슬롯을 보고 아이템을 드래그해서 배치
- GUI별 슬롯 규칙: Chest는 rows 설정, Shulker Box/Anvil/Enchanting Table은 고정 슬롯
- 함수 빌더: `@tool inventory`를 인벤토리 에디터에서 만든 실제 Skript 코드로 변환
- 메시지 도구: `@tool send`를 기본 메시지, title, subtitle, actionbar 코드로 변환
- Skript 자동완성: 입력 중 문법 후보 표시, Tab/Enter로 스니펫 삽입
- 기본 문법 진단: 오류는 빨간색, 경고는 노란색, 정보는 파란색 라인으로 표시
- Problems 패널에서 TIP과 예시 확인

## 개발 실행

```bash
npm install
npm run dev
```

현재 PC에 `ELECTRON_RUN_AS_NODE=1` 환경변수가 있어도 `npm run dev`는 실행 직전에 해당 값을 제거합니다.

## 빌드 확인

```bash
npm run build
```

## Windows 설치 파일 만들기

```bash
npm run dist
```

완성된 설치 파일은 `release/` 폴더에 생성됩니다.

## 다음 개발 후보

- 프로젝트 폴더 열기와 실제 파일 트리
- Skript/애드온 버전별 문법 데이터베이스
- 자동완성 문법 데이터 확장, 스니펫, hover 문서
- 인벤토리 에디터 고도화: 실제 Minecraft 아이템 텍스처, 드래그 선택, 저장 가능한 GUI 프리셋
- 함수 빌더 종류 확대: command, cooldown, database, permission
- Minecraft 서버 로그/콘솔 연동
- GitHub 릴리스 기반 자동 업데이트
