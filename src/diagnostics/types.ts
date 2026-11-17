export type DiagnosticSeverity = "error" | "warning" | "tip";

export type DiagnosticCategory = "syntax" | "optimize" | "learn" | "style";

export type Diagnostic = {
  id: string;
  line: number;
  endLine?: number;
  severity: DiagnosticSeverity;
  category: DiagnosticCategory;
  /** 한 줄 요약 */
  message: string;
  /** 왜 중요한지 / 어떻게 고치는지 */
  tip?: string;
  /** 바로 따라 쓸 수 있는 예시 */
  example?: string;
};

export const severityLabel: Record<DiagnosticSeverity, string> = {
  error: "오류",
  warning: "경고",
  tip: "팁"
};

export const categoryLabel: Record<DiagnosticCategory, string> = {
  syntax: "문법",
  optimize: "최적화",
  learn: "학습",
  style: "스타일"
};

export function countDiagnostics(items: Diagnostic[]): { errors: number; warnings: number; tips: number } {
  return items.reduce(
    (counts, item) => {
      if (item.severity === "error") {
        counts.errors += 1;
      } else if (item.severity === "warning") {
        counts.warnings += 1;
      } else {
        counts.tips += 1;
      }
      return counts;
    },
    { errors: 0, warnings: 0, tips: 0 }
  );
}
