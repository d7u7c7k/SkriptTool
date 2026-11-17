import { FileCode2, FilePlus2, Save, SaveAll, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { isTabDirty, type OpenTab } from "./types";

type Props = {
  tabs: OpenTab[];
  activePath: string | null;
  onActivate: (path: string) => void;
  onClose: (tab: OpenTab) => void;
  onNewFile: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  canSave: boolean;
};

export function TabBar({ tabs, activePath, onActivate, onClose, onNewFile, onSave, onSaveAs, canSave }: Props) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activePath]);

  return (
    <div className="tabbar">
      <div className="tab-scroll">
        {tabs.map((tab) => {
          const active = tab.path === activePath;
          return (
            <button
              key={tab.path}
              ref={active ? activeRef : null}
              className={`tab ${active ? "active" : ""}`}
              onClick={() => onActivate(tab.path)}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  onClose(tab);
                }
              }}
              title={tab.relativePath}
            >
              <FileCode2 size={14} className="tab-icon" />
              <span className="tab-name">{tab.name}</span>
              {isTabDirty(tab) && <span className="dirty-dot" aria-label="저장하지 않은 변경" />}
              <span
                className="tab-close"
                role="button"
                tabIndex={-1}
                aria-label={`${tab.name} 닫기`}
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(tab);
                }}
              >
                <X size={12} />
              </span>
            </button>
          );
        })}
        <button className="tab-add" title="새 .sk 파일 (Ctrl/Cmd+N)" onClick={onNewFile}>
          <FilePlus2 size={15} />
        </button>
      </div>
      <div className="tabbar-actions">
        <button className="icon-btn" title="저장 (Ctrl/Cmd+S)" onClick={onSave} disabled={!canSave}>
          <Save size={15} />
        </button>
        <button className="icon-btn" title="다른 이름으로 저장 (Ctrl/Cmd+Shift+S)" onClick={onSaveAs} disabled={!canSave}>
          <SaveAll size={15} />
        </button>
      </div>
    </div>
  );
}
