import type { EnvironmentConfig } from "../catalog";

/**
 * 새 프로젝트에 함께 만드는 `main.sk` 기본 내용.
 * 바로 실행해도 문법 오류가 없도록 최소한의 예제만 넣습니다.
 */
export function newProjectMainScript(projectName: string, environment: EnvironmentConfig): string {
  return `# ${projectName} · main.sk
# Minecraft ${environment.minecraftVersion} · Skript ${environment.skriptVersion}
# Ctrl/Cmd + S 로 저장합니다. 오른쪽 "코드 흐름"에서 실행 순서를 확인하세요.

on join:
  send "&6[${projectName}] &f환영합니다, %player's name%님!" to player

command /안녕:
  description: 인사를 건넵니다
  trigger:
    send "&a안녕하세요, %player's name%님!" to player
`;
}

export function newProjectReadme(projectName: string, environment: EnvironmentConfig): string {
  const addons = environment.addons.length > 0 ? environment.addons.join(", ") : "없음";
  return `# ${projectName}

SkriptTool v2 프로젝트입니다.

- Minecraft: ${environment.minecraftVersion}
- Skript: ${environment.skriptVersion}
- 애드온: ${addons}

이 폴더의 \`.skripttool.json\`이 프로젝트 설정입니다. SkriptTool에서 확장(애드온)을 추가하거나
버전을 바꾸면 이 파일이 함께 갱신됩니다.
`;
}
