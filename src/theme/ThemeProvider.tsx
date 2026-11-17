import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { contrastText, hexToRgba, sanitizeTheme } from "./monacoTheme";
import { CUSTOM_THEME_ID, createCustomTheme, defaultTheme, resolveTheme, themePresets } from "./presets";
import type { ThemeDefinition, ThemePatch } from "./types";

const STORAGE_KEY = "skripttool.theme.v2";

type StoredTheme = {
  activeId: string;
  custom: ThemeDefinition;
};

function isThemeDefinition(value: unknown): value is ThemeDefinition {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<ThemeDefinition>;
  return Boolean(candidate.colors && candidate.editor && typeof candidate.id === "string");
}

function loadStored(): StoredTheme | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredTheme>;
    if (!parsed || typeof parsed.activeId !== "string" || !isThemeDefinition(parsed.custom)) {
      return null;
    }
    return {
      activeId: parsed.activeId,
      custom: { ...parsed.custom, id: CUSTOM_THEME_ID, builtin: false }
    };
  } catch {
    return null;
  }
}

type ThemeContextValue = {
  theme: ThemeDefinition;
  presets: ThemeDefinition[];
  activeId: string;
  custom: ThemeDefinition;
  selectPreset: (id: string) => void;
  updateCustom: (patch: ThemePatch) => void;
  startCustomFrom: (id: string) => void;
  resetCustom: () => void;
  commitCustom: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const stored = useMemo(loadStored, []);
  const [activeId, setActiveId] = useState<string>(stored?.activeId ?? defaultTheme.id);
  const [custom, setCustom] = useState<ThemeDefinition>(stored?.custom ?? createCustomTheme());

  const theme = useMemo(() => sanitizeTheme(resolveTheme(activeId, custom)), [activeId, custom]);

  const persist = useCallback(
    (nextActiveId: string, nextCustom: ThemeDefinition) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeId: nextActiveId, custom: nextCustom }));
      } catch {
        /* 저장 공간이 없어도 편집은 계속됩니다. */
      }
    },
    []
  );

  useEffect(() => {
    persist(activeId, custom);
  }, [activeId, custom, persist]);

  useEffect(() => {
    const root = document.documentElement;
    const { colors, editor } = theme;
    root.dataset.theme = theme.appearance;
    root.style.colorScheme = theme.appearance;
    root.style.setProperty("--bg", colors.background);
    root.style.setProperty("--surface", colors.surface);
    root.style.setProperty("--editor-bg", colors.editorBackground);
    root.style.setProperty("--border", colors.border);
    root.style.setProperty("--text", colors.text);
    root.style.setProperty("--muted", colors.muted);
    root.style.setProperty("--accent", colors.accent);
    root.style.setProperty("--accent-contrast", contrastText(colors.accent));
    root.style.setProperty("--accent-soft", hexToRgba(colors.accent, theme.appearance === "light" ? 0.12 : 0.16));
    root.style.setProperty("--accent-line", hexToRgba(colors.accent, 0.45));
    root.style.setProperty("--hover", hexToRgba(colors.text, theme.appearance === "light" ? 0.05 : 0.06));
    root.style.setProperty("--hover-strong", hexToRgba(colors.text, theme.appearance === "light" ? 0.09 : 0.1));
    root.style.setProperty("--shadow", `0 18px 40px ${hexToRgba(theme.appearance === "light" ? "#0f172a" : "#000000", 0.35)}`);
    root.style.setProperty("--editor-font", editor.fontFamily);
    root.style.setProperty("--editor-size", `${editor.fontSize}px`);
    root.style.setProperty("--editor-line-height", `${editor.lineHeight}px`);
    document.body.style.backgroundColor = colors.background;
    document.body.style.color = colors.text;
  }, [theme]);

  const selectPreset = useCallback(
    (id: string) => {
      if (id === CUSTOM_THEME_ID) {
        setActiveId(CUSTOM_THEME_ID);
        return;
      }
      if (themePresets.some((preset) => preset.id === id)) {
        setActiveId(id);
      }
    },
    []
  );

  const updateCustom = useCallback(
    (patch: ThemePatch) => {
      setCustom((previous) => {
        const base = activeId === CUSTOM_THEME_ID ? previous : resolveTheme(activeId, previous);
        return {
          ...base,
          id: CUSTOM_THEME_ID,
          name: patch.name ?? previous.name ?? "내 테마",
          description: patch.description ?? base.description,
          appearance: patch.appearance ?? base.appearance,
          builtin: false,
          colors: { ...base.colors, ...patch.colors },
          editor: { ...base.editor, ...patch.editor }
        };
      });
      setActiveId(CUSTOM_THEME_ID);
    },
    [activeId]
  );

  const startCustomFrom = useCallback((id: string) => {
    const base = themePresets.find((preset) => preset.id === id) ?? defaultTheme;
    setCustom(createCustomTheme(base));
    setActiveId(CUSTOM_THEME_ID);
  }, []);

  const resetCustom = useCallback(() => {
    setCustom(createCustomTheme());
    setActiveId(CUSTOM_THEME_ID);
  }, []);

  const commitCustom = useCallback(() => {
    persist(CUSTOM_THEME_ID, custom);
  }, [custom, persist]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, presets: themePresets, activeId, custom, selectPreset, updateCustom, startCustomFrom, resetCustom, commitCustom }),
    [theme, activeId, custom, selectPreset, updateCustom, startCustomFrom, resetCustom, commitCustom]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}
