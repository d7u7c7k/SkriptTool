import { Check, Palette, RotateCcw, Save, X } from "lucide-react";
import { useEffect } from "react";
import { fontChoices } from "../theme/presets";
import { useTheme } from "../theme/ThemeProvider";
import type { ThemeColors } from "../theme/types";
import type { EditorSettings } from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  settings: EditorSettings;
  onSettingsChange: (settings: EditorSettings) => void;
  onStatus: (message: string) => void;
};

const colorFields: Array<{ key: keyof ThemeColors; label: string }> = [
  { key: "background", label: "배경" },
  { key: "surface", label: "패널 / 사이드바" },
  { key: "editorBackground", label: "에디터 배경" },
  { key: "accent", label: "강조색" },
  { key: "text", label: "텍스트" },
  { key: "muted", label: "보조 텍스트" },
  { key: "border", label: "구분선" }
];

function safeColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
}

export function SettingsPanel({ open, onClose, settings, onSettingsChange, onStatus }: Props) {
  const { theme, presets, activeId, custom, selectPreset, updateCustom, startCustomFrom, resetCustom, commitCustom } = useTheme();

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const colors = activeId === "custom" ? custom.colors : theme.colors;
  const editorValues = activeId === "custom" ? custom.editor : theme.editor;
  const appearance = activeId === "custom" ? custom.appearance : theme.appearance;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="settings-panel" role="dialog" aria-label="설정">
        <header className="settings-header">
          <div className="settings-heading">
            <Palette size={17} />
            <div>
              <h2>설정</h2>
              <p>테마와 에디터를 내 손에 맞게</p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} title="닫기 (Esc)">
            <X size={16} />
          </button>
        </header>

        <div className="settings-body">
          <section className="settings-section">
            <div className="settings-section-head">
              <h3>테마 프리셋</h3>
              <span>기본값은 Midnight Dark입니다.</span>
            </div>
            <div className="preset-grid">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  className={`preset-card ${activeId === preset.id ? "active" : ""}`}
                  onClick={() => {
                    selectPreset(preset.id);
                    onStatus(`${preset.name} 테마 적용`);
                  }}
                >
                  <span className="preset-swatches">
                    <i style={{ background: preset.colors.background }} />
                    <i style={{ background: preset.colors.surface }} />
                    <i style={{ background: preset.colors.accent }} />
                    <i style={{ background: preset.colors.text }} />
                  </span>
                  <span className="preset-name">
                    {preset.name}
                    {activeId === preset.id && <Check size={13} />}
                  </span>
                  <span className="preset-desc">{preset.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <h3>커스텀 테마</h3>
              <span>{activeId === "custom" ? "커스텀 테마 사용 중" : "색을 바꾸면 커스텀 테마로 전환됩니다"}</span>
            </div>

            <div className="settings-row two">
              <label className="field">
                <span>테마 이름</span>
                <input
                  value={activeId === "custom" ? custom.name : ""}
                  onChange={(event) => updateCustom({ name: event.target.value })}
                  placeholder="내 테마"
                />
              </label>
              <label className="field">
                <span>기본 모드</span>
                <select
                  value={appearance}
                  onChange={(event) => updateCustom({ appearance: event.target.value === "light" ? "light" : "dark" })}
                >
                  <option value="dark">다크</option>
                  <option value="light">라이트</option>
                </select>
              </label>
            </div>

            <div className="color-grid">
              {colorFields.map((field) => (
                <label className="color-field" key={field.key}>
                  <span>{field.label}</span>
                  <div className="color-control">
                    <input
                      type="color"
                      value={safeColor(colors[field.key])}
                      onChange={(event) => updateCustom({ colors: { [field.key]: event.target.value } })}
                      aria-label={`${field.label} 색상`}
                    />
                    <input
                      className="hex-input"
                      value={colors[field.key]}
                      onChange={(event) => updateCustom({ colors: { [field.key]: event.target.value.trim() } })}
                      spellCheck={false}
                    />
                  </div>
                </label>
              ))}
            </div>

            <div className="settings-row two">
              <label className="field">
                <span>에디터 폰트</span>
                <select
                  value={fontChoices.some((choice) => choice.value === editorValues.fontFamily) ? editorValues.fontFamily : "custom"}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value !== "custom") {
                      updateCustom({ editor: { fontFamily: value } });
                    }
                  }}
                >
                  {fontChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                  <option value="custom">직접 지정</option>
                </select>
              </label>
              <label className="field">
                <span>폰트 크기 (px)</span>
                <input
                  type="number"
                  min={11}
                  max={24}
                  value={editorValues.fontSize}
                  onChange={(event) =>
                    updateCustom({ editor: { fontSize: Math.min(24, Math.max(11, Number(event.target.value) || 14)) } })
                  }
                />
              </label>
            </div>

            <label className="field">
              <span>폰트 패밀리 (직접 입력)</span>
              <input
                value={editorValues.fontFamily}
                onChange={(event) => updateCustom({ editor: { fontFamily: event.target.value } })}
                spellCheck={false}
              />
            </label>

            <div className="settings-inline">
              <button
                className="mini-btn"
                disabled={activeId === "custom"}
                onClick={() => startCustomFrom(activeId === "custom" ? presets[0].id : activeId)}
              >
                {activeId === "custom" ? "현재 커스텀 테마 편집 중" : "현재 프리셋을 커스텀으로 복제"}
              </button>
              <button
                className="mini-btn"
                onClick={() => {
                  resetCustom();
                  onStatus("커스텀 테마를 기본값으로 되돌렸습니다.");
                }}
              >
                <RotateCcw size={12} /> 기본값으로
              </button>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <h3>에디터</h3>
              <span>손코딩 편의 설정</span>
            </div>
            <div className="settings-row two">
              <label className="field">
                <span>들여쓰기</span>
                <select
                  value={settings.tabSize}
                  onChange={(event) => onSettingsChange({ ...settings, tabSize: Number(event.target.value) === 4 ? 4 : 2 })}
                >
                  <option value={2}>2칸 스페이스</option>
                  <option value={4}>4칸 스페이스</option>
                </select>
              </label>
              <label className="field">
                <span>줄 바꿈</span>
                <select
                  value={settings.wordWrap ? "on" : "off"}
                  onChange={(event) => onSettingsChange({ ...settings, wordWrap: event.target.value === "on" })}
                >
                  <option value="on">자동 줄 바꿈</option>
                  <option value="off">줄 바꿈 없음</option>
                </select>
              </label>
            </div>
            <label className="switch-row">
              <input
                type="checkbox"
                checked={settings.showMinimap}
                onChange={(event) => onSettingsChange({ ...settings, showMinimap: event.target.checked })}
              />
              <span>
                미니맵 표시
                <small>꺼 두면 더 미니멀합니다.</small>
              </span>
            </label>
          </section>

          <div className="settings-save-row">
            <span className="settings-save-hint">변경 사항은 자동 저장됩니다. 아래 버튼은 커스텀 테마를 확정합니다.</span>
            <button
              className="primary-btn"
              onClick={() => {
                commitCustom();
                onStatus(`${custom.name} 테마를 저장했습니다.`);
              }}
            >
              <Save size={14} /> 커스텀 테마 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
