export type DiagnosticSeverity = "error" | "warning" | "tip";

export type DiagnosticCategory =
  | "syntax"
  | "optimize"
  | "learn"
  | "style"
  /** 선택한 Skript 버전에서 폐기된 예전 문법 */
  | "legacy"
  /** 프로젝트에 없는 애드온 전용 문법 */
  | "addon";

/** 진단에서 바로 실행할 수 있는 고치기 동작 */
export type DiagnosticFix =
  | { kind: "add-addon"; addonId: string; addonName: string; label: string }
  | { kind: "open-addons"; label: string };

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
  /** 애드온 문법 경고일 때 해당 애드온 */
  addonId?: string;
  addonName?: string;
  /** 진단 바에서 원클릭으로 실행할 동작 */
  fix?: DiagnosticFix;
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
  style: "스타일",
  legacy: "구버전 문법",
  addon: "확장 필요"
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

/** 추가하면 사라질 애드온 경고를 애드온별로 묶습니다. */
export function missingAddonGroups(items: Diagnostic[]): Array<{ addonId: string; addonName: string; count: number }> {
  const groups = new Map<string, { addonId: string; addonName: string; count: number }>();
  for (const item of items) {
    if (item.category !== "addon" || !item.addonId) {
      continue;
    }
    const current = groups.get(item.addonId);
    if (current) {
      current.count += 1;
    } else {
      groups.set(item.addonId, {
        addonId: item.addonId,
        addonName: item.addonName ?? item.addonId,
        count: 1
      });
    }
  }
  return [...groups.values()];
}
