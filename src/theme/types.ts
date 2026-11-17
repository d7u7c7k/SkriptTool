export type ThemeAppearance = "dark" | "light";

export type ThemeColors = {
  /** 앱 전체 배경 */
  background: string;
  /** 사이드바, 상단바, 패널 표면 */
  surface: string;
  /** Monaco 에디터 배경 */
  editorBackground: string;
  /** 구분선 */
  border: string;
  /** 기본 텍스트 */
  text: string;
  /** 보조 텍스트 */
  muted: string;
  /** 포인트 색 (활성 탭, 버튼, 커서) */
  accent: string;
};

export type ThemeEditor = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
};

export type ThemeDefinition = {
  id: string;
  name: string;
  description: string;
  appearance: ThemeAppearance;
  colors: ThemeColors;
  editor: ThemeEditor;
  builtin: boolean;
};

export type ThemePatch = {
  name?: string;
  description?: string;
  appearance?: ThemeAppearance;
  colors?: Partial<ThemeColors>;
  editor?: Partial<ThemeEditor>;
};
