import type { ToolDefinition, ToolId } from "./types";

export const toolRegistry: ToolDefinition[] = [
  {
    id: "send",
    label: "send",
    detail: "메시지 / 타이틀 / 액션바 작성 도구",
    marker: "@tool:send"
  },
  {
    id: "inventory",
    label: "inventory",
    detail: "시각적 인벤토리 GUI 에디터",
    marker: "@tool:inventory"
  }
];

export function getToolDefinition(id: ToolId): ToolDefinition | undefined {
  return toolRegistry.find((tool) => tool.id === id);
}

export function parseToolMarker(line: string): ToolId | null {
  const trimmed = line.trim();
  // Preferred: @tool:send  · legacy: @tool send
  const match = trimmed.match(/^@tool(?::|\s+)(\w+)\s*$/i);
  if (!match) {
    if (trimmed === "함수(inventory)") {
      return "inventory";
    }
    return null;
  }
  const id = match[1].toLowerCase();
  return toolRegistry.some((tool) => tool.id === id) ? (id as ToolId) : null;
}
