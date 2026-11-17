import { ChevronRight, Clock, FilePlus2, FolderOpen, Settings as SettingsIcon, Sparkles, X } from "lucide-react";
import { relativeTime } from "../project/recents";
import type { RecentProject } from "../project/types";

type Props = {
  recents: RecentProject[];
  busy: boolean;
  status: string;
  onNewProject: () => void;
  onOpenProject: () => void;
  onOpenRecent: (recent: RecentProject) => void;
  onRemoveRecent: (id: string) => void;
  onBrowseExample: () => void;
  onOpenSettings: () => void;
};

export function LauncherScreen({
  recents,
  busy,
  status,
  onNewProject,
  onOpenProject,
  onOpenRecent,
  onRemoveRecent,
  onBrowseExample,
  onOpenSettings
}: Props) {
  return (
    <div className="launcher">
      <header className="launcher-top">
        <div className="brand">
          <span className="brand-mark">S</span>
          <span className="brand-name">SkriptTool</span>
          <span className="brand-version">v2</span>
        </div>
        <div className="launcher-top-spacer" />
        <button className="icon-btn" title="설정 (테마·에디터)" onClick={onOpenSettings}>
          <SettingsIcon size={16} />
        </button>
      </header>

      <div className="launcher-body">
        <section className="launcher-hero">
          <p className="launcher-eyebrow">SKRIPT EDITOR FOR MINECRAFT</p>
          <h1>
            프로젝트로 시작하는
            <br />
            손으로 쓰는 Skript
          </h1>
          <p className="launcher-sub">
            Minecraft와 Skript 버전을 먼저 정하고, 필요한 애드온만 골라 쓰세요. 버전에 맞지 않는 문법과 빠진
            애드온 문법은 에디터가 줄 색으로 바로 알려 줍니다.
          </p>

          <div className="launcher-actions">
            <button className="launcher-action primary" onClick={onNewProject} disabled={busy}>
              <span className="launcher-action-icon">
                <FilePlus2 size={18} />
              </span>
              <span className="launcher-action-text">
                <strong>새 프로젝트 만들기</strong>
                <small>버전과 애드온을 고르고 main.sk · .skripttool.json을 만듭니다</small>
              </span>
              <ChevronRight size={16} className="launcher-action-arrow" />
            </button>

            <button className="launcher-action" onClick={onOpenProject} disabled={busy}>
              <span className="launcher-action-icon">
                <FolderOpen size={18} />
              </span>
              <span className="launcher-action-text">
                <strong>프로젝트 열기</strong>
                <small>.skripttool.json이 있으면 저장된 버전·애드온을 그대로 불러옵니다</small>
              </span>
              <ChevronRight size={16} className="launcher-action-arrow" />
            </button>
          </div>

          <button className="launcher-link" onClick={onBrowseExample} disabled={busy}>
            <Sparkles size={13} /> 예제 워크스페이스로 둘러보기
          </button>
        </section>

        <aside className="launcher-recent">
          <div className="launcher-recent-head">
            <h2>최근 프로젝트</h2>
            <span className="launcher-recent-count">{recents.length}</span>
          </div>

          {recents.length === 0 ? (
            <div className="launcher-recent-empty">
              <Clock size={16} />
              <p>
                아직 연 프로젝트가 없습니다.
                <br />
                새 프로젝트를 만들면 여기에 표시됩니다.
              </p>
            </div>
          ) : (
            <ul className="recent-list">
              {recents.map((recent) => (
                <li key={recent.id} className="recent-row">
                  <button className="recent-main" onClick={() => onOpenRecent(recent)} title={recent.path}>
                    <span className="recent-name">{recent.name}</span>
                    <span className="recent-meta">
                      MC {recent.minecraftVersion} · Skript {recent.skriptVersion} · 애드온 {recent.addonCount}
                    </span>
                    <span className="recent-path">{recent.path}</span>
                    <span className="recent-time">{relativeTime(recent.openedAt)}</span>
                  </button>
                  <button
                    className="recent-remove"
                    title="목록에서 제거"
                    onClick={() => onRemoveRecent(recent.id)}
                    aria-label={`${recent.name} 목록에서 제거`}
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="launcher-tips">
            <span>
              <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>N</kbd> 새 파일
            </span>
            <span>
              <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>O</kbd> 프로젝트 열기
            </span>
            <span>
              <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>E</kbd> 확장
            </span>
          </div>
        </aside>
      </div>

      <footer className="launcher-foot">
        <span className="launcher-status">{status}</span>
        <span className="launcher-foot-spacer" />
        <span>빨간줄 문법 오류 · 노란줄 구버전/미설치 애드온 문법</span>
      </footer>
    </div>
  );
}

