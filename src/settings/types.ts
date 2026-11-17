export type EditorSettings = {
  tabSize: number;
  wordWrap: boolean;
  showMinimap: boolean;
};

export const defaultEditorSettings: EditorSettings = {
  tabSize: 2,
  wordWrap: true,
  showMinimap: false
};

export function sanitizeEditorSettings(value: Partial<EditorSettings> | null | undefined): EditorSettings {
  return {
    tabSize: value?.tabSize === 4 ? 4 : 2,
    wordWrap: value?.wordWrap !== false,
    showMinimap: value?.showMinimap === true
  };
}
