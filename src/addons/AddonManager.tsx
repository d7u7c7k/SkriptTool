import { AlertTriangle, Check, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  inGameVersionLabel,
  legacyAndLatestHint,
  listAddonAvailability,
  type AddonAvailability,
  type AddonCategory,
  type EnvironmentConfig
} from "../catalog";

type Props = {
  open: boolean;
  environment: EnvironmentConfig;
  /** 설정이 저장되는 위치 설명 (.skripttool.json) */
  configPathLabel: string;
  /** 진단에서 "확장에서 추가"를 눌렀을 때 강조할 애드온 */
  focusAddonId: string | null;
  onClose: () => void;
  onChange: (next: EnvironmentConfig) => void;
};

type Filter = "all" | "installed" | "available" | "blocked";

const categoryLabel: Record<AddonCategory, string> = {
  core: "핵심",
  gui: "GUI",
  data: "데이터",
  integration: "연동",
  legacy: "구형"
};

export function AddonManager({ open, environment, configPathLabel, focusAddonId, onClose, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  const entries = useMemo(
    () => listAddonAvailability(environment.minecraftVersion, environment.skriptVersion),
    [environment.minecraftVersion, environment.skriptVersion]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery("");
    setFilter("all");
  }, [open]);

  useEffect(() => {
    if (!open || !focusAddonId) {
      return;
    }
    const node = rowRefs.current.get(focusAddonId);
    node?.scrollIntoView({ block: "center" });
  }, [focusAddonId, open]);

  if (!open) {
    return null;
  }

  const installed = new Set(environment.addons);
  const visible = entries.filter((entry) => {
    const isInstalled = installed.has(entry.addon.id);
    if (filter === "installed" && !isInstalled) {
      return false;
    }
    if (filter === "available" && (!entry.compatible || isInstalled)) {
      return false;
    }
    if (filter === "blocked" && entry.compatible) {
      return false;
    }
    if (!query.trim()) {
      return true;
    }
    const needle = query.trim().toLowerCase();
    return (
      entry.addon.name.toLowerCase().includes(needle) ||
      entry.addon.description.toLowerCase().includes(needle) ||
      inGameVersionLabel(entry.addon).toLowerCase().includes(needle) ||
      (entry.addon.sample ?? "").toLowerCase().includes(needle)
    );
  });

  const toggle = (entry: AddonAvailability) => {
    if (!entry.compatible) {
      return;
    }
    if (installed.has(entry.addon.id)) {
      onChange({ ...environment, addons: environment.addons.filter((id) => id !== entry.addon.id) });
      return;
    }
    onChange({ ...environment, addons: [...environment.addons, entry.addon.id] });
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="addon-panel" role="dialog" aria-label="확장(애드온) 관리">
        <header className="settings-header">
          <div className="settings-heading">
            <div>
              <h2>확장 (애드온)</h2>
              <p>
                이 프로젝트의 버전에 맞는 애드온만 추가할 수 있습니다. 추가·제거는 즉시 진단과 자동완성에 반영됩니다.
                <br />
                <span className="addon-legend">
                  <span className="addon-legend-item">「인게임 MC …」 그 애드온이 실제 서버에서 도는 Minecraft 버전</span>
                  <span className="addon-legend-item both">「구버전~최신 지원」 구버전부터 최신 버전까지 한 버전으로 커버</span>
                </span>
              </p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            <X size={15} />
          </button>
        </header>

        <div className="addon-toolbar">
          <div className="addon-version-chips">
            <span className="addon-chip">Minecraft {environment.minecraftVersion}</span>
            <span className="addon-chip">Skript {environment.skriptVersion}</span>
            <span className="addon-chip accent">설치 {environment.addons.length}</span>
          </div>
          <div className="addon-search">
            <Search size={13} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="애드온 · 문법 검색" />
          </div>
        </div>

        <div className="addon-filters">
          {(
            [
              { id: "all", label: `전체 ${entries.length}` },
              { id: "installed", label: `설치됨 ${environment.addons.length}` },
              { id: "available", label: `추가 가능 ${entries.filter((entry) => entry.compatible && !installed.has(entry.addon.id)).length}` },
              { id: "blocked", label: `비호환 ${entries.filter((entry) => !entry.compatible).length}` }
            ] as Array<{ id: Filter; label: string }>
          ).map((item) => (
            <button
              key={item.id}
              className={`addon-filter ${filter === item.id ? "active" : ""}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="addon-scroll">
          {visible.length === 0 && <div className="addon-empty">조건에 맞는 애드온이 없습니다.</div>}
          {visible.map((entry) => {
            const isInstalled = installed.has(entry.addon.id);
            const focused = focusAddonId === entry.addon.id;
            return (
              <div
                key={entry.addon.id}
                ref={(node) => {
                  if (node) {
                    rowRefs.current.set(entry.addon.id, node);
                  } else {
                    rowRefs.current.delete(entry.addon.id);
                  }
                }}
                className={`addon-row ${isInstalled ? "installed" : ""} ${entry.compatible ? "" : "blocked"} ${
                  focused ? "focused" : ""
                }`}
              >
                <div className="addon-row-body">
                  <div className="addon-row-title">
                    <span className="addon-name">{entry.addon.name}</span>
                    <span className="addon-ver">{entry.latestVersion}</span>
                    <span className={`addon-cat ${entry.addon.category}`}>{categoryLabel[entry.addon.category]}</span>
                    <span
                      className="addon-mc"
                      title={`인게임 지원 버전: Minecraft ${entry.addon.inGameVersions}`}
                    >
                      {inGameVersionLabel(entry.addon)}
                    </span>
                    {entry.addon.supportsLegacyAndLatest && (
                      <span className="addon-both" title={legacyAndLatestHint(entry.addon)}>
                        구버전~최신 지원
                      </span>
                    )}
                    {entry.addon.requires && <span className="addon-needs">+ {entry.addon.requires.join(", ")}</span>}
                  </div>
                  <p className="addon-desc">{entry.addon.description}</p>
                  {legacyAndLatestHint(entry.addon) && (
                    <p className="addon-legacy-note">{legacyAndLatestHint(entry.addon)}</p>
                  )}
                  {entry.addon.sample && <code className="addon-sample">{entry.addon.sample}</code>}
                  {!entry.compatible && (
                    <div className="addon-reason">
                      <AlertTriangle size={12} />
                      {entry.reasons.join(" · ")}
                    </div>
                  )}
                </div>
                <button
                  className={`addon-toggle ${isInstalled ? "remove" : "add"}`}
                  disabled={!entry.compatible}
                  onClick={() => toggle(entry)}
                  title={entry.compatible ? (isInstalled ? "제거" : "추가") : entry.reasons.join(" · ")}
                >
                  {isInstalled ? <Trash2 size={13} /> : <Plus size={13} />}
                  {isInstalled ? "제거" : "추가"}
                </button>
              </div>
            );
          })}
        </div>

        <footer className="addon-footer">
          <span className="addon-footer-status">
            <Check size={12} /> {environment.addons.length}개 설치됨
          </span>
          <span className="addon-footer-path">{configPathLabel}</span>
        </footer>
      </div>
    </div>
  );
}
