import { PackagePlus, Trash2 } from "lucide-react";
import {
  getCompatibleAddons,
  getCompatibleSkriptReleases,
  minecraftVersions,
  resolveEnvironmentOnMinecraftChange,
  resolveEnvironmentOnSkriptChange,
  type EnvironmentConfig
} from "../catalog";

type ExtensionsPanelProps = {
  environment: EnvironmentConfig;
  onChange: (next: EnvironmentConfig) => void;
  onStatus?: (message: string) => void;
};

export function ExtensionsPanel({ environment, onChange, onStatus }: ExtensionsPanelProps) {
  const skriptOptions = getCompatibleSkriptReleases(environment.minecraftVersion);
  const catalog = getCompatibleAddons(environment.minecraftVersion, environment.skriptVersion);
  const installedIds = new Set(environment.addons.map((addon) => addon.packageId));
  const availableToInstall = catalog.filter((addon) => !installedIds.has(addon.id));

  function installAddon(packageId: string) {
    const pack = catalog.find((addon) => addon.id === packageId);
    if (!pack) {
      return;
    }

    onChange({
      ...environment,
      addons: [
        ...environment.addons,
        {
          id: `${pack.id}-${Date.now()}`,
          packageId: pack.id,
          name: pack.name,
          version: pack.availableVersions[0]
        }
      ]
    });
    onStatus?.(`Installed ${pack.name}`);
  }

  function updateAddonVersion(id: string, version: string) {
    onChange({
      ...environment,
      addons: environment.addons.map((addon) => (addon.id === id ? { ...addon, version } : addon))
    });
  }

  function removeAddon(id: string) {
    const removed = environment.addons.find((addon) => addon.id === id);
    onChange({
      ...environment,
      addons: environment.addons.filter((addon) => addon.id !== id)
    });
    if (removed) {
      onStatus?.(`Removed ${removed.name}`);
    }
  }

  return (
    <>
      <div className="sidebar-header">
        <span>EXTENSIONS</span>
        <button
          title="Add first available addon"
          onClick={() => {
            if (availableToInstall[0]) {
              installAddon(availableToInstall[0].id);
            }
          }}
          disabled={availableToInstall.length === 0}
        >
          <PackagePlus size={16} />
        </button>
      </div>

      <section className="workspace-block form-stack">
        <label>
          <span>Minecraft</span>
          <select
            value={environment.minecraftVersion}
            onChange={(event) => onChange(resolveEnvironmentOnMinecraftChange(environment, event.target.value))}
          >
            {minecraftVersions.map((version) => (
              <option key={version} value={version}>
                {version}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Skript</span>
          <select
            value={environment.skriptVersion}
            onChange={(event) => onChange(resolveEnvironmentOnSkriptChange(environment, event.target.value))}
          >
            {skriptOptions.map((release) => (
              <option key={release.version} value={release.version}>
                {release.version}
                {release.recommended ? " (recommended)" : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="workspace-title">INSTALLED</div>
        {environment.addons.length === 0 ? (
          <div className="empty-note">설치된 애드온이 없습니다. 아래에서 추가하세요.</div>
        ) : (
          environment.addons.map((addon) => {
            const pack = catalog.find((item) => item.id === addon.packageId);
            const versions = pack?.availableVersions ?? [addon.version];
            return (
              <div className="extension-card installed" key={addon.id}>
                <div className="extension-card-head">
                  <strong>{addon.name}</strong>
                  {pack?.alwaysAvailable && <span className="extension-badge">all versions</span>}
                  <button title="Remove addon" onClick={() => removeAddon(addon.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
                <select value={addon.version} onChange={(event) => updateAddonVersion(addon.id, event.target.value)}>
                  {versions.map((version) => (
                    <option key={version} value={version}>
                      {version}
                    </option>
                  ))}
                </select>
              </div>
            );
          })
        )}

        <div className="workspace-title">CATALOG</div>
        <div className="extension-hint">
          MC {environment.minecraftVersion} · Skript {environment.skriptVersion}에 맞는 애드온만 표시됩니다. 버전 무관
          애드온은 항상 보입니다.
        </div>
        {availableToInstall.length === 0 ? (
          <div className="empty-note">추가할 수 있는 애드온이 없습니다.</div>
        ) : (
          availableToInstall.map((addon) => (
            <div className="extension-card" key={addon.id}>
              <div className="extension-card-head">
                <strong>{addon.name}</strong>
                {addon.alwaysAvailable && <span className="extension-badge">all versions</span>}
              </div>
              <p>{addon.description}</p>
              <button className="wide-command" onClick={() => installAddon(addon.id)}>
                Install {addon.availableVersions[0]}
              </button>
            </div>
          ))
        )}
      </section>
    </>
  );
}
