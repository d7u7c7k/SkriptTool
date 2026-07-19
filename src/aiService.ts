export type AIProvider = "simulator" | "gemini" | "openai" | "ollama";

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  customEndpoint: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const SYSTEM_PROMPT = `You are an expert Minecraft Skript developer and assistant.
Your goal is to help the user write clean, efficient, and modern Skript code for Minecraft servers.
Follow these guidelines:
1. Always write valid Skript syntax.
2. Use modern Skript conventions (e.g., "on right click" instead of "on rightclick").
3. Remember that inventory slot indices start at 0.
4. When generating code, wrap it in markdown code blocks using \`\`\`skript or \`\`\`sk.
5. Keep explanations concise and focused on Minecraft Skript.
6. If the user asks about addons, support popular ones like SkBee, SkQuery, and skript-reflect.`;

// A smart simulator that generates realistic Skript code based on keywords
function runSimulator(prompt: string, fileContent?: string): string {
  const lower = prompt.toLowerCase();
  
  let code = "";
  let explanation = "";

  if (lower.includes("command") || lower.includes("명령어")) {
    const cmdName = prompt.match(/\/([a-zA-Z0-9_]+)/)?.[1] || "test";
    code = `command /${cmdName} [<text>]:
  permission: skript.admin
  permission message: &c이 명령어를 사용할 권한이 없습니다.
  trigger:
    if arg-1 is not set:
      send "&e사용법: /${cmdName} [메시지]" to player
    else:
      send "&a[알림] &f%arg-1%" to player
      play sound "entity.player.levelup" with volume 0.5 to player`;
    explanation = `요청하신 명령어 \`/${cmdName}\`를 생성했습니다.
- \`permission\`을 통해 관리자 권한(\`skript.admin\`)이 있는 유저만 실행할 수 있도록 제한했습니다.
- 첫 번째 인자(\`arg-1\`)가 입력되지 않았을 때의 예외 처리를 포함했습니다.
- 명령어 실행 시 레벨업 효과음(\`entity.player.levelup\`)을 재생하여 피드백을 주었습니다.`;
  } else if (lower.includes("gui") || lower.includes("인벤토리") || lower.includes("메뉴")) {
    code = `command /menu:
  trigger:
    open chest inventory with 3 rows named "&e&l메인 메뉴" to player
    set slot 11 of player's current inventory to diamond sword named "&b&l전투 구역" with lore "&7클릭 시 스폰으로 이동합니다."
    set slot 13 of player's current inventory to golden apple named "&6&l상점" with lore "&7다양한 아이템을 구매하세요."
    set slot 15 of player's current inventory to barrier named "&c&l닫기"

on inventory click:
  if name of event-inventory is "&e&l메인 메뉴":
    cancel event
    if index of event-slot is 11:
      close player's inventory
      teleport player to spawn
      send "&a스폰으로 이동했습니다!" to player
    else if index of event-slot is 13:
      close player's inventory
      execute player command "/shop"
    else if index of event-slot is 15:
      close player's inventory`;
    explanation = `기본적인 가상 인벤토리 GUI 메뉴 스크립트입니다.
- \`/menu\` 명령어로 3줄(27슬롯) 크기의 상자를 엽니다.
- 각 슬롯(11, 13, 15)에 아이템을 배치하고 클릭 이벤트를 감지합니다.
- \`cancel event\`를 사용하여 유저가 GUI 안의 아이템을 꺼내가지 못하도록 방지했습니다.`;
  } else if (lower.includes("join") || lower.includes("접속") || lower.includes("환영")) {
    code = `on join:
  set join message to "&a[+] &7%player%님이 서버에 접속하셨습니다!"
  send "&e&l[WELCOME] &f%player%님, 서버 접속을 환영합니다!" to player
  launch ball firework colored red, yellow and white at player
  
on quit:
  set quit message to "&c[-] &7%player%님이 서버에서 퇴장하셨습니다!"`;
  } else if (lower.includes("death") || lower.includes("죽음") || lower.includes("킬")) {
    code = `on death of player:
  if attacker is a player:
    add 1 to {kills::%attacker's uuid%}
    send "&a[Kill] &f%victim%님을 처치했습니다! (누적 킬: %{kills::%attacker's uuid%}%킬)" to attacker
  add 1 to {deaths::%victim's uuid%}
  send "&c[Death] &f%attacker%님에게 처치당했습니다. (누적 데스: %{deaths::%victim's uuid%}%데스)" to victim`;
  } else if (lower.includes("item") || lower.includes("아이템") || lower.includes("지급")) {
    code = `command /givekit:
  trigger:
    give 1 of diamond sword of sharpness 5 named "&b&l전설의 검" to player
    give 64 of cooked beef to player
    send "&a기본 키트가 지급되었습니다!" to player`;
  } else {
    // Default fallback response
    code = `options:
  prefix: &6[SkriptTool AI]

command /helper:
  trigger:
    send "{@prefix} &f무엇을 도와드릴까요?" to player`;
    explanation = `안녕하세요! SkriptTool AI 비서입니다.
마인크래프트 Skript 작성 중 궁금한 점이나 필요한 기능이 있다면 언제든 물어보세요!
예시:
- "접속 시 환영 메시지 띄우는 스크립트 짜줘"
- "특정 아이템을 우클릭했을 때 작동하는 명령어"
- "돈 시스템 변수 저장하는 법 알려줘"`;
  }

  let response = `### 🤖 SkriptTool AI Simulator (오프라인 모드)

요청하신 내용에 대한 Skript 예시 코드입니다.

\`\`\`skript
${code}
\`\`\`

${explanation}

*(참고: 현재 AI 설정이 'Simulator'로 되어 있어 미리 정의된 템플릿으로 답변했습니다. 실제 LLM을 사용하려면 **Settings** 탭에서 Gemini 또는 OpenAI API 키를 등록해 주세요!)*`;

  if (fileContent) {
    response += `\n\n**현재 파일 분석 결과:**
현재 열려있는 파일의 크기는 약 ${fileContent.length}자 이며, 총 ${fileContent.split('\n').length}줄로 구성되어 있습니다.`;
  }

  return response;
}

export async function callAIService(
  prompt: string,
  config: AIConfig,
  chatHistory: ChatMessage[] = [],
  fileContent?: string
): Promise<string> {
  if (config.provider === "simulator") {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    return runSimulator(prompt, fileContent);
  }

  const contextMessage = fileContent 
    ? `\n\n[Active File Content for Context]:\n\`\`\`skript\n${fileContent}\n\`\`\``
    : "";

  const fullUserPrompt = prompt + contextMessage;

  try {
    if (config.provider === "gemini") {
      const apiKey = config.apiKey;
      if (!apiKey) {
        throw new Error("Gemini API Key가 설정되지 않았습니다. Settings에서 등록해 주세요.");
      }
      const model = config.model || "gemini-2.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      // Format history for Gemini
      const contents = [];
      
      // Add system instruction if supported, or prepend to first message
      // For simplicity and compatibility, we prepend system prompt to the user prompt or use systemInstruction field
      const systemInstruction = {
        parts: [{ text: SYSTEM_PROMPT }]
      };

      // Add history
      for (const msg of chatHistory) {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }]
        });
      }

      // Add current prompt
      contents.push({
        role: "user",
        parts: [{ text: fullUserPrompt }]
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents,
          systemInstruction
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Gemini API Error: ${response.statusText}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Gemini API가 빈 응답을 반환했습니다.");
      }
      return text;
    }

    if (config.provider === "openai") {
      const apiKey = config.apiKey;
      if (!apiKey) {
        throw new Error("OpenAI API Key가 설정되지 않았습니다. Settings에서 등록해 주세요.");
      }
      const model = config.model || "gpt-4o-mini";
      const url = config.customEndpoint || "https://api.openai.com/v1/chat/completions";

      const messages = [
        { role: "system", content: SYSTEM_PROMPT }
      ];

      for (const msg of chatHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }

      messages.push({ role: "user", content: fullUserPrompt });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `OpenAI API Error: ${response.statusText}`);
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error("OpenAI API가 빈 응답을 반환했습니다.");
      }
      return text;
    }

    if (config.provider === "ollama") {
      const url = config.customEndpoint || "http://localhost:11434/api/chat";
      const model = config.model || "llama3";

      const messages = [
        { role: "system", content: SYSTEM_PROMPT }
      ];

      for (const msg of chatHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }

      messages.push({ role: "user", content: fullUserPrompt });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama Error: ${response.statusText}`);
      }

      const data = await response.json();
      const text = data?.message?.content;
      if (!text) {
        throw new Error("Ollama가 빈 응답을 반환했습니다.");
      }
      return text;
    }

    throw new Error("지원하지 않는 AI Provider입니다.");
  } catch (error: any) {
    console.error("AI Service Error:", error);
    return `❌ **AI 요청 중 오류가 발생했습니다:**\n${error.message || error}`;
  }
}

// Helper to extract Skript code blocks from markdown text
export function extractSkriptCode(markdown: string): string | null {
  const regex = /```(?:skript|sk|yaml|yml)?\n([\s\S]*?)```/i;
  const match = markdown.match(regex);
  return match ? match[1].trim() : null;
}
