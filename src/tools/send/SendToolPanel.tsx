import { useMemo, useRef, type FocusEvent, type KeyboardEvent, type MouseEvent, type SyntheticEvent } from "react";
import { generateSendLines, type SendBuilder, type SendMode, type SendTarget } from "./generate";
import { renderMinecraftText } from "./preview";

const MODE_OPTIONS: { id: SendMode; label: string; hint: string }[] = [
  { id: "message", label: "채팅", hint: "일반 채팅 메시지" },
  { id: "title", label: "타이틀", hint: "화면 중앙 큰 글씨" },
  { id: "subtitle", label: "서브타이틀", hint: "타이틀 아래 작은 글씨" },
  { id: "actionbar", label: "액션바", hint: "핫바 위 한 줄" }
];

const TARGET_OPTIONS: { id: SendTarget; label: string }[] = [
  { id: "player", label: "플레이어" },
  { id: "all players", label: "모든 플레이어" },
  { id: "console", label: "콘솔" }
];

const COLOR_CHIPS: { code: string; label: string; swatch?: string }[] = [
  { code: "&0", label: "검정", swatch: "#000000" },
  { code: "&1", label: "남색", swatch: "#0000aa" },
  { code: "&2", label: "초록", swatch: "#00aa00" },
  { code: "&3", label: "청록", swatch: "#00aaaa" },
  { code: "&4", label: "빨강", swatch: "#aa0000" },
  { code: "&5", label: "보라", swatch: "#aa00aa" },
  { code: "&6", label: "금색", swatch: "#ffaa00" },
  { code: "&7", label: "회색", swatch: "#aaaaaa" },
  { code: "&8", label: "진회", swatch: "#555555" },
  { code: "&9", label: "파랑", swatch: "#5555ff" },
  { code: "&a", label: "연녹", swatch: "#55ff55" },
  { code: "&b", label: "하늘", swatch: "#55ffff" },
  { code: "&c", label: "분홍", swatch: "#ff5555" },
  { code: "&d", label: "분홍", swatch: "#ff55ff" },
  { code: "&e", label: "노랑", swatch: "#ffff55" },
  { code: "&f", label: "흰색", swatch: "#ffffff" },
  { code: "&l", label: "굵게" },
  { code: "&o", label: "기울임" },
  { code: "&n", label: "밑줄" },
  { code: "&m", label: "취소" },
  { code: "&r", label: "초기화" }
];

type FieldName = "content" | "subtitle";

type SelectionMemory = {
  field: FieldName;
  start: number;
  end: number;
};

type SendToolPanelProps = {
  builder: SendBuilder;
  onChange: (next: SendBuilder) => void;
  onApply: () => void;
};

export function SendToolPanel({ builder, onChange, onApply }: SendToolPanelProps) {
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const subtitleRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef<SelectionMemory>({ field: "content", start: 0, end: 0 });
  const generated = useMemo(() => generateSendLines(builder), [builder]);

  function rememberSelection(field: FieldName, el: HTMLTextAreaElement) {
    selectionRef.current = {
      field,
      start: el.selectionStart,
      end: el.selectionEnd
    };
  }

  function insertCode(code: string, field: FieldName) {
    const ref = field === "content" ? contentRef : subtitleRef;
    const el = ref.current;
    const current = field === "content" ? builder.content : builder.subtitle;

    let start: number;
    let end: number;

    if (el && document.activeElement === el) {
      start = el.selectionStart;
      end = el.selectionEnd;
    } else if (selectionRef.current.field === field) {
      start = selectionRef.current.start;
      end = selectionRef.current.end;
    } else if (el) {
      start = el.selectionStart;
      end = el.selectionEnd;
    } else {
      start = current.length;
      end = current.length;
    }

    start = Math.max(0, Math.min(start, current.length));
    end = Math.max(0, Math.min(end, current.length));
    if (end < start) {
      end = start;
    }

    const selected = current.slice(start, end);
    const prefixStart = start - code.length;
    const hasSameCodeBefore = prefixStart >= 0 && current.slice(prefixStart, start) === code;
    const selectedStartsWithCode = selected.startsWith(code);

    let next: string;
    let selectFrom: number;
    let selectTo: number;

    if (selected.length > 0 && hasSameCodeBefore) {
      // Same chip again → remove the color code in front of the selection (cancel).
      next = current.slice(0, prefixStart) + selected + current.slice(end);
      selectFrom = prefixStart;
      selectTo = prefixStart + selected.length;
    } else if (selected.length > 0 && selectedStartsWithCode) {
      // Selection includes the code → strip it.
      const stripped = selected.slice(code.length);
      next = current.slice(0, start) + stripped + current.slice(end);
      selectFrom = start;
      selectTo = start + stripped.length;
    } else if (selected.length > 0) {
      // Apply color in front of selection, keep the text.
      next = current.slice(0, start) + code + selected + current.slice(end);
      selectFrom = start + code.length;
      selectTo = start + code.length + selected.length;
    } else if (hasSameCodeBefore) {
      // Caret right after the same code → remove it.
      next = current.slice(0, prefixStart) + current.slice(start);
      selectFrom = prefixStart;
      selectTo = prefixStart;
    } else {
      next = current.slice(0, start) + code + current.slice(end);
      selectFrom = start + code.length;
      selectTo = selectFrom;
    }

    onChange({ ...builder, [field]: next });
    selectionRef.current = { field, start: selectFrom, end: selectTo };

    requestAnimationFrame(() => {
      const target = ref.current;
      if (!target) {
        return;
      }
      target.focus();
      target.setSelectionRange(selectFrom, selectTo);
    });
  }

  function bindTextarea(field: FieldName) {
    return {
      onSelect: (event: SyntheticEvent<HTMLTextAreaElement>) => rememberSelection(field, event.currentTarget),
      onKeyUp: (event: KeyboardEvent<HTMLTextAreaElement>) => rememberSelection(field, event.currentTarget),
      onClick: (event: MouseEvent<HTMLTextAreaElement>) => rememberSelection(field, event.currentTarget),
      onBlur: (event: FocusEvent<HTMLTextAreaElement>) => rememberSelection(field, event.currentTarget)
    };
  }

  return (
    <div className="send-tool">
      <div className="send-section">
        <div className="send-section-label">종류</div>
        <div className="send-mode-grid">
          {MODE_OPTIONS.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`send-mode-card ${builder.mode === mode.id ? "active" : ""}`}
              onClick={() => onChange({ ...builder, mode: mode.id })}
            >
              <strong>{mode.label}</strong>
              <span>{mode.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="send-section">
        <div className="send-section-label">대상</div>
        <div className="send-target-row">
          {TARGET_OPTIONS.map((target) => (
            <button
              key={target.id}
              type="button"
              className={`send-chip ${builder.target === target.id ? "active" : ""}`}
              onClick={() => onChange({ ...builder, target: target.id })}
            >
              {target.label}
            </button>
          ))}
        </div>
      </div>

      <div className="send-section">
        <div className="send-section-label">{builder.mode === "title" ? "타이틀" : "내용"}</div>
        <textarea
          ref={contentRef}
          value={builder.content}
          onChange={(event) => {
            onChange({ ...builder, content: event.target.value });
            rememberSelection("content", event.currentTarget);
          }}
          placeholder="메시지를 입력하세요. &a 같은 색코드를 사용할 수 있습니다."
          rows={3}
          {...bindTextarea("content")}
        />
        <div className="send-color-chips">
          {COLOR_CHIPS.map((chip) => (
            <button
              key={chip.code}
              type="button"
              className="send-color-chip"
              title={`${chip.label} (${chip.code})`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertCode(chip.code, "content")}
            >
              {chip.swatch ? <i style={{ background: chip.swatch }} /> : null}
              <span>{chip.code}</span>
            </button>
          ))}
        </div>
      </div>

      {builder.mode === "title" && (
        <>
          <div className="send-section">
            <div className="send-section-label">서브타이틀</div>
            <textarea
              ref={subtitleRef}
              value={builder.subtitle}
              onChange={(event) => {
                onChange({ ...builder, subtitle: event.target.value });
                rememberSelection("subtitle", event.currentTarget);
              }}
              rows={2}
              {...bindTextarea("subtitle")}
            />
            <div className="send-color-chips compact">
              {COLOR_CHIPS.slice(0, 16).map((chip) => (
                <button
                  key={`sub-${chip.code}`}
                  type="button"
                  className="send-color-chip"
                  title={`${chip.label} (${chip.code})`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertCode(chip.code, "subtitle")}
                >
                  {chip.swatch ? <i style={{ background: chip.swatch }} /> : null}
                  <span>{chip.code}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="send-section">
            <div className="send-section-label">표시 시간 (틱)</div>
            <div className="send-timing">
              <label>
                <span>Fade in</span>
                <input
                  type="number"
                  min={0}
                  value={builder.fadeIn}
                  onChange={(event) => onChange({ ...builder, fadeIn: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>Stay</span>
                <input
                  type="number"
                  min={1}
                  value={builder.stay}
                  onChange={(event) => onChange({ ...builder, stay: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>Fade out</span>
                <input
                  type="number"
                  min={0}
                  value={builder.fadeOut}
                  onChange={(event) => onChange({ ...builder, fadeOut: Number(event.target.value) })}
                />
              </label>
            </div>
          </div>
        </>
      )}

      <div className="send-section">
        <div className="send-section-label">미리보기</div>
        <div className={`send-preview minecraft-preview mode-${builder.mode}`}>
          {builder.mode === "title" ? (
            <>
              <div className="mc-title">{renderMinecraftText(builder.content || " ")}</div>
              <div className="mc-subtitle">{renderMinecraftText(builder.subtitle || " ")}</div>
            </>
          ) : builder.mode === "actionbar" ? (
            <div className="mc-actionbar">{renderMinecraftText(builder.content || " ")}</div>
          ) : (
            <div className="mc-chat">{renderMinecraftText(builder.content || " ")}</div>
          )}
        </div>
      </div>

      <div className="send-section">
        <div className="send-section-label">생성될 Skript</div>
        <pre className="send-code-preview">{generated.join("\n")}</pre>
      </div>

      <button type="button" className="apply-button" onClick={onApply}>
        코드에 적용
      </button>
      <p className="send-apply-hint">Apply 전까지 에디터에는 `@tool:send` 마커만 유지됩니다.</p>
    </div>
  );
}
