import { Blocks, Boxes, ChevronDown, Cpu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  findAddonPackage,
  getCompatibleSkriptReleases,
  minecraftVersions,
  resolveEnvironmentOnMinecraftChange,
  resolveEnvironmentOnSkriptChange,
  type EnvironmentConfig
} from "../catalog";

type Props = {
  environment: EnvironmentConfig;
  onChange: (environment: EnvironmentConfig, note: string) => void;
  onOpenAddons: () => void;
  onOpenLibrary: () => void;
};

export function EnvironmentMenu({ environment, onChange, onOpenAddons, onOpenLibrary }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointer = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const skriptReleases = getCompatibleSkriptReleases(environment.minecraftVersion);

  const changeMinecraft = (version: string) => {
    const { environment: next, dropped } = resolveEnvironmentOnMinecraftChange(environment, version);
    const note =
      dropped.length > 0
        ? `Minecraft ${version} · Skript ${next.skriptVersion}로 맞추고, 호환되지 않는 ${dropped
            .map((addon) => addon.name)
            .join(", ")}를 제거했습니다.`
        : `Minecraft ${version} · Skript ${next.skriptVersion} 기준으로 맞췄습니다.`;
    onChange(next, note);
  };

  const changeSkript = (version: string) => {
    const { environment: next, dropped } = resolveEnvironmentOnSkriptChange(environment, version);
    const note =
      dropped.length > 0
        ? `Skript ${version}로 바꾸고, 호환되지 않는 ${dropped.map((addon) => addon.name).join(", ")}를 제거했습니다.`
        : `Skript ${version} 기준으로 맞췄습니다.`;
    onChange(next, note);
  };

  return (
    <div className="env-menu" ref={wrapperRef}>
      <button className={`env-button ${open ? "active" : ""}`} onClick={() => setOpen((value) => !value)}>
        <Cpu size={14} />
        <span>
          MC {environment.minecraftVersion} · Skript {environment.skriptVersion}
        </span>
        <span className="env-addons">애드온 {environment.addons.length}</span>
        <ChevronDown size={13} className={open ? "rotated" : ""} />
      </button>

      {open && (
        <div className="env-popover">
          <div className="env-popover-head">
            <span>프로젝트 환경</span>
            <span className="env-hint">.skripttool.json에 저장</span>
          </div>

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
              {skriptReleases.map((release) => (
                <option key={release.version} value={release.version}>
                  {release.version}
                  {release.recommended ? " (권장)" : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="env-addon-head">
            <span>설치된 애드온</span>
            <span className="env-hint">{environment.addons.length}개</span>
          </div>

          <div className="env-addon-summary">
            {environment.addons.length === 0 && <span className="env-empty">설치된 애드온이 없습니다.</span>}
            {environment.addons.map((id) => {
              const addon = findAddonPackage(id);
              if (!addon) {
                return null;
              }
              return (
                <span className="env-addon-pill" key={id} title={addon.description}>
                  {addon.name}
                </span>
              );
            })}
          </div>

          <button className="ghost-btn env-open-addons" onClick={() => {
            setOpen(false);
            onOpenAddons();
          }}>
            <Boxes size={14} /> 확장 관리 열기
          </button>

          <button className="ghost-btn env-open-addons" onClick={() => {
            setOpen(false);
            onOpenLibrary();
          }}>
            <Blocks size={14} /> 공용 마크 리소스 라이브러리
          </button>
        </div>
      )}
    </div>
  );
}
