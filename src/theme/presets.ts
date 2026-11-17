import type { ThemeDefinition } from "./types";

export const CUSTOM_THEME_ID = "custom";

const mono = "JetBrains Mono, D2Coding, SFMono-Regular, Consolas, 'Courier New', monospace";

export const themePresets: ThemeDefinition[] = [
  {
    id: "midnight-dark",
    name: "Midnight Dark",
    description: "기본값. 눈이 편한 딥 네이비 다크 미니멀.",
    appearance: "dark",
    builtin: true,
    colors: {
      background: "#0d1015",
      surface: "#12161d",
      editorBackground: "#0a0d12",
      border: "#212833",
      text: "#e6edf3",
      muted: "#8b98a9",
      accent: "#6ea8fe"
    },
    editor: { fontFamily: mono, fontSize: 14, lineHeight: 23 }
  },
  {
    id: "deep-slate",
    name: "Deep Slate",
    description: "회색빛이 도는 차분한 슬레이트 다크.",
    appearance: "dark",
    builtin: true,
    colors: {
      background: "#131517",
      surface: "#1a1d20",
      editorBackground: "#101214",
      border: "#2b3035",
      text: "#e8ecef",
      muted: "#9099a2",
      accent: "#a78bfa"
    },
    editor: { fontFamily: mono, fontSize: 14, lineHeight: 23 }
  },
  {
    id: "forest-charcoal",
    name: "Forest Charcoal",
    description: "짙은 숲색 포인트의 저채도 다크.",
    appearance: "dark",
    builtin: true,
    colors: {
      background: "#0f1411",
      surface: "#151d17",
      editorBackground: "#0b100d",
      border: "#26322a",
      text: "#e3ece5",
      muted: "#8ba193",
      accent: "#7bd88f"
    },
    editor: { fontFamily: mono, fontSize: 14, lineHeight: 23 }
  },
  {
    id: "clean-light",
    name: "Clean Light",
    description: "밝은 강의실에서 쓰기 좋은 화이트 테마.",
    appearance: "light",
    builtin: true,
    colors: {
      background: "#f5f6f8",
      surface: "#ffffff",
      editorBackground: "#ffffff",
      border: "#e2e6ec",
      text: "#1b2430",
      muted: "#697687",
      accent: "#2563eb"
    },
    editor: { fontFamily: mono, fontSize: 14, lineHeight: 23 }
  }
];

export const defaultTheme = themePresets[0];

export const fontChoices = [
  { label: "JetBrains Mono (기본)", value: mono },
  { label: "D2Coding", value: "D2Coding, 'D2 coding', Consolas, monospace" },
  { label: "Consolas", value: "Consolas, 'Courier New', monospace" },
  { label: "Menlo / SF Mono", value: "Menlo, SFMono-Regular, monospace" },
  { label: "시스템 고정폭", value: "ui-monospace, monospace" }
];

export function createCustomTheme(base: ThemeDefinition = defaultTheme): ThemeDefinition {
  return {
    ...base,
    id: CUSTOM_THEME_ID,
    name: "내 테마",
    description: "직접 조정한 테마.",
    builtin: false,
    colors: { ...base.colors },
    editor: { ...base.editor }
  };
}

export function resolveTheme(activeId: string, custom: ThemeDefinition): ThemeDefinition {
  if (activeId === CUSTOM_THEME_ID) {
    return custom;
  }
  return themePresets.find((preset) => preset.id === activeId) ?? defaultTheme;
}
