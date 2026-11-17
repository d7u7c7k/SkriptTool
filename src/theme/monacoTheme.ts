import type { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { defaultTheme } from "./presets";
import type { ThemeDefinition } from "./types";

export const MONACO_THEME_ID = "skript-editor-theme";

/** 색이 바뀔 때마다 새 테마 id를 써서 Monaco가 즉시 다시 칠하도록 합니다. */
export function monacoThemeId(theme: ThemeDefinition): string {
  const key = Object.values(theme.colors).join("|");
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) | 0;
  }
  return `${MONACO_THEME_ID}-${Math.abs(hash).toString(36)}`;
}

function normalizeHex(hex: string): string {
  const value = hex.trim().replace("#", "");
  if (/^[0-9a-fA-F]{3}$/.test(value)) {
    return `#${value
      .split("")
      .map((char) => char + char)
      .join("")}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(value)) {
    return `#${value.toLowerCase()}`;
  }
  return "#000000";
}

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = normalizeHex(hex);
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 배경 위에 올릴 텍스트 색(밝기 기준) */
export function contrastText(hex: string): string {
  const normalized = normalizeHex(hex);
  const r = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const g = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const b = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const linear = [r, g, b].map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.55 ? "#0b1017" : "#ffffff";
}

function mix(hex: string, target: string, ratio: number): string {
  const a = normalizeHex(hex);
  const b = normalizeHex(target);
  const channels = [1, 3, 5].map((start) => {
    const from = Number.parseInt(a.slice(start, start + 2), 16);
    const to = Number.parseInt(b.slice(start, start + 2), 16);
    return Math.round(from + (to - from) * ratio)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

export function sanitizeTheme(theme: ThemeDefinition): ThemeDefinition {
  const fallback = defaultTheme.colors;
  const safe = (value: string | undefined, key: keyof typeof fallback) =>
    typeof value === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim()) ? normalizeHex(value) : fallback[key];

  return {
    ...theme,
    name: typeof theme.name === "string" && theme.name.trim() ? theme.name : "내 테마",
    appearance: theme.appearance === "light" ? "light" : "dark",
    colors: {
      background: safe(theme.colors.background, "background"),
      surface: safe(theme.colors.surface, "surface"),
      editorBackground: safe(theme.colors.editorBackground, "editorBackground"),
      border: safe(theme.colors.border, "border"),
      text: safe(theme.colors.text, "text"),
      muted: safe(theme.colors.muted, "muted"),
      accent: safe(theme.colors.accent, "accent")
    },
    editor: {
      fontFamily:
        typeof theme.editor.fontFamily === "string" && theme.editor.fontFamily.trim()
          ? theme.editor.fontFamily.trim()
          : defaultTheme.editor.fontFamily,
      fontSize: Math.min(
        24,
        Math.max(11, Math.round(Number(theme.editor.fontSize)) || defaultTheme.editor.fontSize)
      ),
      lineHeight: Math.min(
        44,
        Math.max(16, Math.round(Number(theme.editor.lineHeight)) || defaultTheme.editor.lineHeight)
      )
    }
  };
}

export function buildMonacoTheme(theme: ThemeDefinition): editor.IStandaloneThemeData {
  const isLight = theme.appearance === "light";
  const { colors } = theme;
  const lineHighlight = mix(colors.editorBackground, colors.text, isLight ? 0.04 : 0.06);
  const guide = mix(colors.editorBackground, colors.border, 0.85);
  const stringColor = isLight ? "#0f766e" : "#9ad8a8";
  const numberColor = isLight ? "#b45309" : "#f3c07b";
  const typeColor = isLight ? "#7c3aed" : "#c4a7ff";
  const localVar = isLight ? "#0e7490" : "#8fd7f0";
  const globalVar = isLight ? "#b45309" : "#f0b37e";
  const colorCode = isLight ? "#be123c" : "#ff9db1";

  return {
    base: isLight ? "vs" : "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: colors.text.replace("#", ""), background: colors.editorBackground.replace("#", "") },
      { token: "comment", foreground: colors.muted.replace("#", ""), fontStyle: "italic" },
      { token: "string", foreground: stringColor.replace("#", "") },
      { token: "string.quoted", foreground: stringColor.replace("#", "") },
      { token: "string.escape", foreground: colorCode.replace("#", "") },
      { token: "string.invalid", foreground: "#f87171" },
      { token: "number", foreground: numberColor.replace("#", "") },
      { token: "keyword", foreground: colors.accent.replace("#", ""), fontStyle: "bold" },
      { token: "keyword.event", foreground: colors.accent.replace("#", ""), fontStyle: "bold" },
      { token: "keyword.condition", foreground: isLight ? "#a16207" : "#e7c86b" },
      { token: "keyword.effect", foreground: isLight ? "#0f766e" : "#7fe3d4" },
      { token: "type", foreground: typeColor.replace("#", "") },
      { token: "variable.local", foreground: localVar },
      { token: "variable.global", foreground: globalVar },
      { token: "color", foreground: colorCode.replace("#", "") },
      { token: "operator", foreground: colors.muted.replace("#", "") },
      { token: "delimiter", foreground: colors.muted.replace("#", "") },
      { token: "identifier", foreground: colors.text.replace("#", "") }
    ],
    colors: {
      "editor.background": colors.editorBackground,
      "editor.foreground": colors.text,
      "editorLineNumber.foreground": mix(colors.muted, colors.editorBackground, 0.35),
      "editorLineNumber.activeForeground": colors.text,
      "editorCursor.foreground": colors.accent,
      "editor.selectionBackground": hexToRgba(colors.accent, isLight ? 0.22 : 0.26),
      "editor.inactiveSelectionBackground": hexToRgba(colors.accent, 0.12),
      "editor.lineHighlightBackground": lineHighlight,
      "editor.lineHighlightBorder": "#00000000",
      "editorIndentGuide.background1": guide,
      "editorIndentGuide.activeBackground1": mix(colors.border, colors.text, 0.25),
      "editorWhitespace.foreground": mix(colors.border, colors.text, 0.18),
      "editorWidget.background": colors.surface,
      "editorWidget.border": colors.border,
      "editorWidget.foreground": colors.text,
      "editorSuggestWidget.background": colors.surface,
      "editorSuggestWidget.border": colors.border,
      "editorSuggestWidget.selectedBackground": hexToRgba(colors.accent, 0.18),
      "editorSuggestWidget.highlightForeground": colors.accent,
      "editorHoverWidget.background": colors.surface,
      "editorHoverWidget.border": colors.border,
      "editorBracketMatch.background": hexToRgba(colors.accent, 0.16),
      "editorBracketMatch.border": hexToRgba(colors.accent, 0.5),
      "editorError.foreground": "#f87171",
      "editorWarning.foreground": "#fbbf24",
      "editorInfo.foreground": "#7dd3fc",
      "scrollbarSlider.background": hexToRgba(colors.muted, 0.24),
      "scrollbarSlider.hoverBackground": hexToRgba(colors.muted, 0.36),
      "scrollbarSlider.activeBackground": hexToRgba(colors.muted, 0.45),
      "editorGutter.background": colors.editorBackground,
      "editorOverviewRuler.border": "#00000000"
    }
  };
}

export function applyMonacoTheme(monaco: Monaco, theme: ThemeDefinition) {
  const safe = sanitizeTheme(theme);
  const themeId = monacoThemeId(safe);
  monaco.editor.defineTheme(themeId, buildMonacoTheme(safe));
  monaco.editor.setTheme(themeId);
  return themeId;
}
