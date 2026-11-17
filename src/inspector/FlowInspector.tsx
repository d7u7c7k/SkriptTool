import { Braces, CircleDot, Info, Lightbulb } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildFlow, analyzeSkript, findTriggerAtLine, summarizeVariables } from "./analyzeFlow";

type Props = {
  fileName: string;
  content: string;
  cursorLine: number;
  onJump: (line: number) => void;
};

export function FlowInspector({ fileName, content, cursorLine, onJump }: Props) {
  const analysis = useMemo(() => analyzeSkript(content), [content]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scope, setScope] = useState<"trigger" | "file">("trigger");

  const cursorTrigger = findTriggerAtLine(analysis.triggers, cursorLine);

  useEffect(() => {
    if (cursorTrigger) {
      setSelectedId(cursorTrigger.id);
    }
  }, [cursorTrigger?.id]);

  const selected = analysis.triggers.find((trigger) => trigger.id === selectedId) ?? cursorTrigger ?? analysis.triggers[0];

  const flow = useMemo(() => (selected ? buildFlow(content, selected) : []), [content, selected]);

  const variables = useMemo(() => {
    if (scope === "file" || !selected) {
      return analysis.variables;
    }
    return summarizeVariables(content, { start: selected.bodyStartLine, end: selected.endLine });
  }, [scope, analysis.variables, content, selected]);

  const localCount = variables.filter((variable) => variable.scope === "local").length;
  const globalCount = variables.length - localCount;

  return (
    <aside className="inspector" aria-label="코드 흐름 인스펙터">
      <header className="inspector-header">
        <div className="inspector-heading">
          <span className="inspector-title">코드 흐름</span>
          <span className="inspector-sub" title={fileName}>
            {fileName} · 순수 정적 분석
          </span>
        </div>
        <span className="inspector-badge">
          <Lightbulb size={12} /> 학습
        </span>
      </header>

      <div className="inspector-scroll">
        <section className="inspector-section">
          <div className="inspector-section-title">
            <span>트리거</span>
            <span className="inspector-count">{analysis.triggers.length}</span>
          </div>
          {analysis.triggers.length === 0 ? (
            <div className="inspector-empty">
              <Info size={13} />
              <span>
                트리거를 찾지 못했습니다. <code>on …:</code>, <code>command /…:</code>, <code>function …:</code>으로 블록을
                만들어 보세요.
              </span>
            </div>
          ) : (
            <div className="trigger-list">
              {analysis.triggers.map((trigger) => (
                <button
                  key={trigger.id}
                  className={`trigger-row ${selected?.id === trigger.id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedId(trigger.id);
                    onJump(trigger.line);
                  }}
                >
                  <span className={`trigger-kind ${trigger.kind}`}>{trigger.label}</span>
                  <span className="trigger-name">{trigger.name}</span>
                  <span className="trigger-line">L{trigger.line}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {selected ? (
          <section className="inspector-section">
            <div className="inspector-section-title">
              <span>실행 흐름</span>
              <span className="inspector-count">{flow.length - 1}단계</span>
            </div>
            <div className="flow-path">
              {flow.map((step, index) => (
                <button
                  key={step.id}
                  className={`flow-step ${step.type}`}
                  style={{ paddingLeft: 10 + step.depth * 13 }}
                  onClick={() => onJump(step.line)}
                  title={step.code}
                >
                  <span className="flow-rail">
                    <CircleDot size={12} />
                  </span>
                  <span className="flow-body">
                    <span className="flow-head">
                      <span className="flow-title">{step.title}</span>
                      <span className="flow-line">L{step.line}</span>
                    </span>
                    <span className="flow-detail">{step.detail}</span>
                    {index === 0 && <span className="flow-code">{step.code}</span>}
                  </span>
                </button>
              ))}
            </div>
            <p className="flow-note">
              위에서 아래로 실행됩니다. 조건과 반복의 들여쓰기가 곧 실행 범위입니다.
            </p>
          </section>
        ) : (
          <section className="inspector-section">
            <div className="inspector-empty">
              <Info size={13} />
              <span>트리거 하나를 선택하면 실행 단계를 한국어로 보여 줍니다.</span>
            </div>
          </section>
        )}

        <section className="inspector-section">
          <div className="inspector-section-title">
            <span>변수</span>
            <span className="inspector-count">
              <Braces size={11} /> {variables.length}
            </span>
          </div>
          <div className="scope-toggle" role="group" aria-label="변수 범위">
            <button className={scope === "trigger" ? "active" : ""} onClick={() => setScope("trigger")}>
              이 트리거
            </button>
            <button className={scope === "file" ? "active" : ""} onClick={() => setScope("file")}>
              파일 전체
            </button>
          </div>
          <div className="var-scope-summary">
            <span className="var-scope local">지역 {localCount}</span>
            <span className="var-scope global">전역 {globalCount}</span>
          </div>
          {variables.length === 0 ? (
            <div className="inspector-empty">
              <Info size={13} />
              <span>아직 변수가 없습니다. <code>{`{_이름}`}</code>으로 지역 변수를 만들어 보세요.</span>
            </div>
          ) : (
            <div className="variable-list">
              {variables.map((variable) => (
                <button
                  key={`${variable.name}-${variable.firstLine}`}
                  className={`variable-row ${variable.scope}`}
                  onClick={() => onJump(variable.firstLine)}
                  title={variable.scope === "local" ? "지역 변수 — 이 트리거 안에서만" : "전역 변수 — 서버에 저장"}
                >
                  <span className="variable-brace">{variable.scope === "local" ? "{_}" : "{}"}</span>
                  <span className="variable-name">{variable.name}</span>
                  <span className="variable-uses">
                    쓰기 {variable.writes} · 읽기 {variable.reads}
                  </span>
                  <span className="variable-line">L{variable.firstLine}</span>
                </button>
              ))}
            </div>
          )}
          <p className="flow-note">
            <code>{"{_x}"}</code>는 이 트리거가 끝나면 사라지고, <code>{"{x}"}</code>는 서버 재시작 후에도 남습니다.
          </p>
        </section>
      </div>
    </aside>
  );
}
