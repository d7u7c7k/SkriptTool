import { AlertTriangle, ChevronDown, ChevronUp, CheckCircle2, Info, Lightbulb } from "lucide-react";
import { useState } from "react";
import { categoryLabel, countDiagnostics, type Diagnostic } from "./types";

type Props = {
  diagnostics: Diagnostic[];
  onJump: (line: number) => void;
};

const icons = {
  error: AlertTriangle,
  warning: AlertTriangle,
  tip: Lightbulb
};

export function DiagnosticBar({ diagnostics, onJump }: Props) {
  const [open, setOpen] = useState(false);
  const counts = countDiagnostics(diagnostics);
  const total = diagnostics.length;

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
        <span className="diag-hint">{total === 0 ? "실시간 정적 분석" : open ? "접기" : "자세히 보기"}</span>
      </button>

      {open && total > 0 && (
        <div className="diag-list">
          {diagnostics.map((item) => {
            const Icon = icons[item.severity] ?? Info;
            return (
              <button className={`diag-item ${item.severity}`} key={item.id} onClick={() => onJump(item.line)}>
                <Icon size={14} className="diag-item-icon" />
                <span className="diag-line">L{item.line}</span>
                <span className="diag-body">
                  <span className="diag-message">{item.message}</span>
                  {item.tip && <span className="diag-tip">{item.tip}</span>}
                  {item.example && <code className="diag-example">{item.example}</code>}
                </span>
                <span className={`diag-category ${item.category}`}>{categoryLabel[item.category]}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
