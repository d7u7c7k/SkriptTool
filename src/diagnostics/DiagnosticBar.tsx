import { AlertTriangle, Boxes, CheckCircle2, ChevronDown, ChevronUp, Lightbulb, Plus } from "lucide-react";
import { useState } from "react";
import { categoryLabel, countDiagnostics, missingAddonGroups, type Diagnostic } from "./types";

type Props = {
  diagnostics: Diagnostic[];
  onJump: (line: number) => void;
  onAddAddon: (addonId: string) => void;
  onOpenAddons: () => void;
};

const icons = {
  error: AlertTriangle,
  warning: AlertTriangle,
  tip: Lightbulb
};

export function DiagnosticBar({ diagnostics, onJump, onAddAddon, onOpenAddons }: Props) {
  const [open, setOpen] = useState(false);
  const counts = countDiagnostics(diagnostics);
  const total = diagnostics.length;
  const addonGroups = missingAddonGroups(diagnostics);
  const legacyCount = diagnostics.filter((item) => item.category === "legacy").length;

  return (
    <section className={`diagnostic-bar ${open ? "expanded" : ""}`}>
      <button className="diag-summary" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="diag-chevron">{open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</span>
        <span className="diag-label">진단</span>
        {total === 0 ? (
          <span className="diag-ok">
            <CheckCircle2 size={13} /> 문제 없음
          </span>
        ) : (
          <span className="diag-counts">
            <span className="diag-count error">
              <i /> 오류 {counts.errors}
            </span>
            <span className="diag-count warning">
              <i /> 경고 {counts.warnings}
            </span>
            <span className="diag-count tip">
              <i /> 팁 {counts.tips}
            </span>
          </span>
        )}
        <span className="diag-spacer" />
        {legacyCount > 0 && <span className="diag-tag legacy">구버전 문법 {legacyCount}</span>}
        {addonGroups.length > 0 && (
          <span className="diag-tag addon">
            <Boxes size={11} /> 누락 애드온 {addonGroups.length}
          </span>
        )}
        <span className="diag-hint">{total === 0 ? "실시간 정적 분석" : open ? "접기" : "자세히 보기"}</span>
      </button>

      {open && total > 0 && (
        <div className="diag-list">
          {addonGroups.length > 0 && (
            <div className="diag-quickfix">
              <span>이 파일은 애드온 문법을 쓰고 있습니다:</span>
              {addonGroups.map((group) => (
                <button key={group.addonId} className="diag-quickfix-btn" onClick={() => onAddAddon(group.addonId)}>
                  <Plus size={11} /> {group.addonName} 추가 <em>{group.count}</em>
                </button>
              ))}
              <button className="diag-quickfix-btn ghost" onClick={onOpenAddons}>
                <Boxes size={11} /> 확장 관리
              </button>
            </div>
          )}

          {diagnostics.map((item) => {
            const Icon = icons[item.severity] ?? Lightbulb;
            return (
              <div
                className={`diag-item ${item.severity} ${item.category}`}
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => onJump(item.line)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onJump(item.line);
                  }
                }}
              >
                <Icon size={14} className="diag-item-icon" />
                <span className="diag-line">L{item.line}</span>
                <span className="diag-body">
                  <span className="diag-message">{item.message}</span>
                  {item.tip && <span className="diag-tip">{item.tip}</span>}
                  {item.example && <code className="diag-example">{item.example}</code>}
                </span>
                {item.fix?.kind === "add-addon" && (
                  <button
                    className="diag-fix"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (item.fix?.kind === "add-addon") {
                        onAddAddon(item.fix.addonId);
                      }
                    }}
                  >
                    <Plus size={11} /> {item.fix.addonName} 추가
                  </button>
                )}
                <span className={`diag-category ${item.category}`}>{categoryLabel[item.category]}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
