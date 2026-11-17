import { Check, ChevronDown, Cpu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  addonPackages,
  getCompatibleAddons,
  getCompatibleSkriptReleases,
  minecraftVersions,
  resolveEnvironmentOnMinecraftChange,
  resolveEnvironmentOnSkriptChange,
  type CompatibleAddon,
  type EnvironmentConfig,
  type InstalledAddon
} from "../catalog";

type Props = {
  environment: EnvironmentConfig;
  onChange: (environment: EnvironmentConfig) => void;
  onStatus: (message: string) => void;
};

function installedFor(environment: EnvironmentConfig, addonId: string): InstalledAddon | undefined {
  return environment.addons.find((addon) => addon.packageId === addonId);
}

export function EnvironmentMenu({ environment, onChange, onStatus }: Props) {
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
  const compatibleAddons = getCompatibleAddons(environment.minecraftVersion, environment.skriptVersion);

  const changeMinecraft = (version: string) => {
    onChange(resolveEnvironmentOnMinecraftChange(environment, version));
    onStatus(`Minecraft ${version} 기준으로 환경을 맞췄습니다.`);
  };

  const changeSkript = (version: string) => {
    onChange(resolveEnvironmentOnSkriptChange(environment, version));
    onStatus(`Skript ${version} 기준으로 환경을 맞췄습니다.`);
  };

  const toggleAddon = (addon: CompatibleAddon) => {
    const installed = installedFor(environment, addon.id);
    if (installed) {
      onChange({ ...environment, addons: environment.addons.filter((entry) => entry.packageId !== addon.id) });
      onStatus(`${addon.name} 제거`);
      return;
    }
    const next: InstalledAddon = {
      id: `${addon.id}-${Date.now()}`,
      packageId: addon.id,
      name: addon.name,
      version: addon.availableVersions[0] ?? "latest"
    };
    onChange({ ...environment, addons: [...environment.addons, next] });
    onStatus(`${addon.name} ${next.version} 추가`);
  };

  const changeAddonVersion = (packageId: string, version: string) => {
    onChange({
      ...environment,
      addons: environment.addons.map((addon) => (addon.packageId === packageId ? { ...addon, version } : addon))
    });
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
            <span>실행 환경</span>
            <span className="env-hint">프로젝트 기준 버전</span>
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
            <span>애드온</span>
            <span className="env-hint">{compatibleAddons.length}개 호환</span>
          </div>
          <div className="env-addon-list">
            {compatibleAddons.length === 0 && <div className="env-empty">이 조합에서 사용할 수 있는 애드온이 없습니다.</div>}
            {compatibleAddons.map((addon) => {
              const installed = installedFor(environment, addon.id);
              return (
                <div key={addon.id} className={`env-addon-row ${installed ? "installed" : ""}`}>
                  <button className="addon-check" onClick={() => toggleAddon(addon)} title={addon.description}>
                    {installed ? <Check size={12} /> : null}
                  </button>
                  <div className="addon-meta">
                    <span className="addon-name">{addon.name}</span>
                    <span className="addon-desc">{addon.description}</span>
                  </div>
                  {installed ? (
                    <select
                      className="addon-version"
                      value={installed.version}
                      onChange={(event) => changeAddonVersion(addon.id, event.target.value)}
                    >
                      {addon.availableVersions.map((version) => (
                        <option key={version} value={version}>
                          {version}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="addon-version muted">{addon.availableVersions[0]}</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="env-note">{addonPackages.length}개 애드온 데이터에서 호환되는 항목만 표시합니다.</p>
        </div>
      )}
    </div>
  );
}
