import { Check, ChevronLeft, FolderOpen, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createDefaultEnvironment,
  getCompatibleSkriptReleases,
  listAddonAvailability,
  minecraftVersions,
  getRecommendedSkriptVersion,
  inGameVersionLabel,
  legacyAndLatestHint,
  resolveEnvironmentOnMinecraftChange,
  resolveEnvironmentOnSkriptChange,
  type EnvironmentConfig
} from "../catalog";
import { newProjectMainScript } from "../project/template";

type Props = {
  open: boolean;
  /** Electron에서만 저장 위치를 고를 수 있습니다 */
  canPickLocation: boolean;
  defaultName: string;
  onClose: () => void;
  onPickLocation: () => Promise<string | null>;
  onCreate: (spec: { name: string; parentPath: string | null; environment: EnvironmentConfig }) => Promise<void>;
};

function sanitizeName(input: string): string {
  return input.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trimStart();
}

export function NewProjectDialog({ open, canPickLocation, defaultName, onClose, onPickLocation, onCreate }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(defaultName);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<EnvironmentConfig>(() => createDefaultEnvironment());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setStep(1);
    setName(defaultName);
    setParentPath(null);
    setEnvironment(createDefaultEnvironment());
    setCreating(false);
    setError(null);
  }, [defaultName, open]);

  const skriptOptions = useMemo(
    () => getCompatibleSkriptReleases(environment.minecraftVersion),
    [environment.minecraftVersion]
  );
  const addonOptions = useMemo(
    () => listAddonAvailability(environment.minecraftVersion, environment.skriptVersion),
    [environment.minecraftVersion, environment.skriptVersion]
  );

  if (!open) {
    return null;
  }

  const trimmedName = sanitizeName(name).trim();
  const stepOneValid = trimmedName.length > 0 && (!canPickLocation || Boolean(parentPath));

  const pickLocation = async () => {
    const picked = await onPickLocation();
    if (picked) {
      setParentPath(picked);
      setError(null);
    }
  };

  const changeMinecraft = (version: string) => {
    setEnvironment(resolveEnvironmentOnMinecraftChange(environment, version).environment);
  };

  const changeSkript = (version: string) => {
    setEnvironment(resolveEnvironmentOnSkriptChange(environment, version).environment);
  };

  const toggleAddon = (id: string) => {
    setEnvironment((current) =>
      current.addons.includes(id)
        ? { ...current, addons: current.addons.filter((entry) => entry !== id) }
        : { ...current, addons: [...current.addons, id] }
    );
  };

  const submit = async () => {
    if (!stepOneValid || creating) {
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await onCreate({ name: trimmedName, parentPath, environment });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "프로젝트를 만들지 못했습니다.");
      setCreating(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !creating) {
          onClose();
        }
      }}
    >
      <div className="new-project-dialog" role="dialog" aria-label="새 프로젝트 만들기">
        <header className="np-header">
          <div>
            <h2>새 프로젝트 만들기</h2>
            <p>
              {step === 1 ? "이름과 저장 위치를 정합니다." : "Minecraft · Skript 버전과 애드온을 고릅니다."}
            </p>
          </div>
          <div className="np-steps">
            <span className={`np-step ${step === 1 ? "active" : "done"}`}>
              <i>1</i> 저장 위치
            </span>
            <span className={`np-step ${step === 2 ? "active" : ""}`}>
              <i>2</i> 버전 · 확장
            </span>
          </div>
          <button className="icon-btn" onClick={onClose} disabled={creating} aria-label="닫기">
            <X size={15} />
          </button>
        </header>

        <div className="np-body">
          {step === 1 ? (
            <>
              <label className="field">
                <span>프로젝트 이름</span>
                <input
                  autoFocus
                  value={name}
                  placeholder="예: 서버 상점"
                  onChange={(event) => setName(sanitizeName(event.target.value))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && stepOneValid) {
                      setStep(2);
                    }
                  }}
                />
              </label>

              {canPickLocation ? (
                <div className="field">
                  <span>저장 위치</span>
                  <div className="np-path-row">
                    <input readOnly value={parentPath ?? ""} placeholder="상위 폴더를 선택하세요" />
                    <button className="ghost-btn" onClick={() => void pickLocation()}>
                      <FolderOpen size={14} /> 폴더 선택
                    </button>
                  </div>
                  <small className="np-hint">
                    선택한 폴더 아래에 <code>{trimmedName || "프로젝트"}</code> 폴더를 만들고{" "}
                    <code>main.sk</code>, <code>.skripttool.json</code>을 저장합니다.
                  </small>
                </div>
              ) : (
                <div className="np-notice">
                  이 환경에서는 폴더를 직접 만들 수 없어 <strong>메모리 프로젝트</strong>로 만듭니다. 데스크톱 앱에서는
                  폴더에 바로 저장됩니다.
                </div>
              )}
            </>
          ) : (
            <>
              <div className="settings-row two">
                <label className="field">
                  <span>Minecraft 버전</span>
                  <select value={environment.minecraftVersion} onChange={(event) => changeMinecraft(event.target.value)}>
                    {minecraftVersions.map((version) => (
                      <option key={version} value={version}>
                        {version}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Skript 버전</span>
                  <select value={environment.skriptVersion} onChange={(event) => changeSkript(event.target.value)}>
                    {skriptOptions.map((release) => (
                      <option key={release.version} value={release.version}>
                        {release.version}
                        {release.recommended ? " (권장)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="np-addon-head">
                <span>확장 애드온</span>
                <small>지금 버전과 호환되는 애드온만 표시합니다 · {environment.addons.length}개 선택</small>
              </div>

              <div className="np-addon-list">
                {addonOptions.map((entry) => {
                  const checked = environment.addons.includes(entry.addon.id);
                  return (
                    <button
                      key={entry.addon.id}
                      className={`np-addon ${checked ? "checked" : ""} ${entry.compatible ? "" : "blocked"}`}
                      disabled={!entry.compatible}
                      onClick={() => toggleAddon(entry.addon.id)}
                      type="button"
                    >
                      <span className="np-addon-check">{checked ? <Check size={12} /> : null}</span>
                      <span className="np-addon-body">
                        <span className="np-addon-name">
                          {entry.addon.name}
                          <em>{entry.latestVersion}</em>
                          <span
                            className="addon-mc np-addon-mc"
                            title={`인게임 지원 버전: Minecraft ${entry.addon.inGameVersions}`}
                          >
                            {inGameVersionLabel(entry.addon)}
                          </span>
                          {entry.addon.supportsLegacyAndLatest && (
                            <span className="addon-both np-addon-both" title={legacyAndLatestHint(entry.addon)}>
                              구버전~최신 지원
                            </span>
                          )}
                        </span>
                        <span className="np-addon-desc">
                          {entry.compatible ? entry.addon.description : entry.reasons.join(" · ")}
                        </span>
                        {legacyAndLatestHint(entry.addon) && (
                          <span className="np-addon-legacy">{legacyAndLatestHint(entry.addon)}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="np-summary">
                <span>
                  <code>main.sk</code> 기본 스크립트
                </span>
                <span>
                  <code>.skripttool.json</code> MC {environment.minecraftVersion} · Skript{" "}
                  {environment.skriptVersion} · 애드온 {environment.addons.length}
                </span>
              </div>
              {error && <div className="np-error">{error}</div>}
            </>
          )}

          {step === 1 && error && <div className="np-error">{error}</div>}
          {!canPickLocation && step === 1 && (
            <p className="np-preview">
              미리보기: {newProjectMainScript(trimmedName || "새 프로젝트", environment).split("\n")[0]}
            </p>
          )}
        </div>

        <footer className="np-footer">
          {step === 1 ? (
            <>
              <span className="np-footer-hint">
                권장: Minecraft {environment.minecraftVersion} · Skript{" "}
                {getRecommendedSkriptVersion(environment.minecraftVersion)}
              </span>
              <button className="primary-btn" disabled={!stepOneValid} onClick={() => setStep(2)}>
                다음
              </button>
            </>
          ) : (
            <>
              <button className="ghost-btn" onClick={() => setStep(1)} disabled={creating}>
                <ChevronLeft size={14} /> 이전
              </button>
              <span className="np-footer-spacer" />
              <button className="primary-btn" onClick={() => void submit()} disabled={creating}>
                {creating ? <Loader2 size={14} className="spin" /> : null}
                {creating ? "만드는 중…" : "프로젝트 만들기"}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
