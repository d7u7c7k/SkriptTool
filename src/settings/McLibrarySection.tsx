import {
  Blocks,
  Download,
  FolderOpen,
  HardDrive,
  Monitor,
  RefreshCw,
  Trash2
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  /** 현재 프로젝트의 MC 버전 (시작 화면에서는 null) */
  minecraftVersion: string | null;
  onStatus: (message: string) => void;
  sectionRef?: React.RefObject<HTMLElement>;
};

type Tone = "ok" | "warn" | "idle" | "loading";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? Math.round(value) : value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`;
}

function sourceLabel(sourceType: McLibraryEntryDto["sourceType"]): string {
  switch (sourceType) {
    case "jar":
      return "인게임 JAR";
    case "resourcepack":
      return "리소스팩";
    case "manual-jar":
      return "직접 고른 JAR";
    case "manual-pack":
      return "직접 고른 팩";
    default:
      return "알 수 없음";
  }
}

/** 현재 프로젝트 MC 버전을 기준으로 공용 라이브러리 연결 상태를 한 줄로 요약합니다. */
function describeStatus(
  status: McLibraryStatusDto | null,
  projectVersion: string | null
): { tone: Tone; title: string; detail: string } {
  if (!status) {
    return { tone: "loading", title: "라이브러리 상태를 확인하는 중…", detail: "" };
  }
  const { entries, detection } = status;
  const exact = projectVersion ? entries.find((entry) => entry.mcVersion === projectVersion) : undefined;
  if (exact) {
    return {
      tone: "ok",
      title: `MC ${projectVersion} 연결됨 · 공용 캐시 재사용 · 텍스처 ${exact.textureCount}개`,
      detail: `${sourceLabel(exact.sourceType)} · ${formatBytes(exact.bytes)} · 새로 받지 않고 바로 씁니다`
    };
  }

  const latestEntry = detection.latestVersion
    ? entries.find((entry) => entry.mcVersion === detection.latestVersion)
    : undefined;
  const projectInstalled = projectVersion
    ? detection.installedVersions.some(
        (version) => version === projectVersion || version.startsWith(`${projectVersion}-`) || version.startsWith(`${projectVersion}_`)
      )
    : false;

  if (projectInstalled && projectVersion) {
    return {
      tone: "idle",
      title: `MC ${projectVersion} 설치됨 · 아직 공용 캐시 없음`,
      detail: "「자동 가져오기」를 누르면 이 버전 리소스를 한 번만 받아 모든 프로젝트가 함께 씁니다"
    };
  }

  if (latestEntry && detection.latestVersion) {
    return {
      tone: "warn",
      title: `최신 버전 ${detection.latestVersion}로 대체 연결 · 텍스처 ${latestEntry.textureCount}개`,
      detail: projectVersion
        ? `MC ${projectVersion} 리소스가 설치되어 있지 않아 설치된 최신 버전을 씁니다`
        : "프로젝트 버전이 정해지면 그 버전을 먼저 찾습니다"
    };
  }

  if (!detection.mcHome) {
    return {
      tone: "warn",
      title: "마크 설치 경로 미발견",
      detail: "「리소스팩 / JAR 직접 선택」으로 .jar나 리소스팩을 골라 가져올 수 있습니다"
    };
  }

  if (entries.length === 0) {
    return {
      tone: "idle",
      title: projectVersion ? `아직 가져오지 않음 · MC ${projectVersion}` : "아직 가져오지 않음",
      detail: `설치 경로 ${detection.mcHome} · 자동 가져오기를 누르면 텍스처를 찾습니다`
    };
  }

  return {
    tone: "idle",
    title: `저장된 캐시 ${entries.length}개 · 프로젝트 MC ${projectVersion ?? "-"} 캐시 없음`,
    detail: "자동 가져오기로 지금 버전을 공용 라이브러리에 추가할 수 있습니다"
  };
}

export function McLibrarySection({ minecraftVersion, onStatus, sectionRef }: Props) {
  const api = window.skriptApi?.mcLibrary;
  const [status, setStatus] = useState<McLibraryStatusDto | null>(null);
  const [busy, setBusy] = useState<"sync" | "pick" | "remove" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!api) {
      return;
    }
    try {
      const next = await api.getStatus();
      if (mountedRef.current) {
        setStatus(next);
      }
    } catch (error) {
      if (mountedRef.current) {
        setNotice(error instanceof Error ? error.message : "라이브러리 상태를 읽지 못했습니다.");
      }
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runSync = async () => {
    if (!api) {
      return;
    }
    setBusy("sync");
    setNotice(null);
    try {
      const result = await api.sync(minecraftVersion);
      if (!mountedRef.current) {
        return;
      }
      setNotice(result.message);
      onStatus(`공용 리소스 라이브러리: ${result.message}`);
      await refresh();
    } catch (error) {
      if (mountedRef.current) {
        const message = error instanceof Error ? error.message : "자동 가져오기에 실패했습니다.";
        setNotice(message);
        onStatus(`공용 리소스 라이브러리: ${message}`);
      }
    } finally {
      if (mountedRef.current) {
        setBusy(null);
      }
    }
  };

  const runPick = async () => {
    if (!api) {
      return;
    }
    setBusy("pick");
    setNotice(null);
    try {
      const result = await api.pickPack();
      if (!mountedRef.current) {
        return;
      }
      if (result.ok === false && result.reason === "canceled") {
        return;
      }
      setNotice(result.message);
      onStatus(`공용 리소스 라이브러리: ${result.message}`);
      if (result.ok) {
        await refresh();
      }
    } catch (error) {
      if (mountedRef.current) {
        const message = error instanceof Error ? error.message : "가져오기에 실패했습니다.";
        setNotice(message);
      }
    } finally {
      if (mountedRef.current) {
        setBusy(null);
      }
    }
  };

  const runRemove = async (versionKey: string) => {
    if (!api) {
      return;
    }
    setPendingRemove(null);
    setBusy("remove");
    setNotice(null);
    try {
      const next = await api.removeVersion(versionKey);
      if (!mountedRef.current) {
        return;
      }
      setStatus(next);
      setNotice(`${versionKey} 캐시를 지웠습니다.`);
      onStatus(`공용 리소스 라이브러리: ${versionKey} 캐시를 지웠습니다.`);
    } catch (error) {
      if (mountedRef.current) {
        setNotice(error instanceof Error ? error.message : "캐시를 지우지 못했습니다.");
      }
    } finally {
      if (mountedRef.current) {
        setBusy(null);
      }
    }
  };

  if (!api) {
    return (
      <section className="settings-section mc-library" ref={sectionRef}>
        <div className="settings-section-head">
          <h3>공용 마크 리소스 라이브러리</h3>
          <span>인게임 텍스처를 한 번만 받아 함께 씁니다</span>
        </div>
        <div className="mc-lib-browser-note">
          <Monitor size={15} />
          <div>
            <strong>브라우저 모드에서는 사용할 수 없습니다</strong>
            <p>
              인게임 마크 텍스처를 읽으려면 PC 폴더에 접근해야 합니다. Electron 앱(SkriptTool)에서 열면
              마크 설치 경로를 찾아 공용 라이브러리로 자동으로 가져옵니다.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const summary = describeStatus(status, minecraftVersion);
  const entries = status?.entries ?? [];
  const detection = status?.detection;

  return (
    <section className="settings-section mc-library" ref={sectionRef}>
      <div className="settings-section-head">
        <h3>공용 마크 리소스 라이브러리</h3>
        <span>인게임 텍스처를 한 번만 받아 모든 프로젝트가 함께 씁니다</span>
      </div>

      <div className={`mc-lib-status ${summary.tone}`}>
        <span className="mc-lib-status-mark">
          <Blocks size={15} />
        </span>
        <div className="mc-lib-status-text">
          <strong>{summary.title}</strong>
          {summary.detail && <p>{summary.detail}</p>}
        </div>
      </div>

      <div className="mc-lib-actions">
        <button className="primary-btn" disabled={busy !== null} onClick={() => void runSync()}>
          <Download size={14} />
          {busy === "sync" ? "가져오는 중…" : "자동 가져오기"}
        </button>
        <button className="ghost-btn" disabled={busy !== null} onClick={() => void runPick()}>
          <FolderOpen size={14} />
          {busy === "pick" ? "고르는 중…" : "리소스팩 / JAR 직접 선택"}
        </button>
        <button
          className="mini-btn mc-lib-refresh"
          disabled={busy !== null}
          onClick={() => void refresh()}
          title="라이브러리 목록 새로고침"
        >
          <RefreshCw size={12} /> 새로고침
        </button>
      </div>

      <p className="mc-lib-hint">
        {minecraftVersion
          ? `현재 프로젝트 MC ${minecraftVersion} 기준으로 versions/*.jar → 최신 설치 버전 → resourcepacks/ 순서로 찾습니다.`
          : "프로젝트를 열면 그 MC 버전을 먼저 찾고, 없으면 설치된 최신 버전을 씁니다."}
      </p>

      {notice && <div className="mc-lib-notice">{notice}</div>}

      <div className="mc-lib-list-head">
        <span>저장된 버전 {entries.length}개</span>
        <span>총 {formatBytes(status?.totalBytes ?? 0)}</span>
      </div>

      {entries.length === 0 ? (
        <div className="mc-lib-empty">
          <HardDrive size={14} /> 아직 저장된 버전이 없습니다. 「자동 가져오기」로 첫 버전을 받아 보세요.
        </div>
      ) : (
        <ul className="mc-lib-list">
          {entries.map((entry) => (
            <li className="mc-lib-row" key={entry.versionKey}>
              <div className="mc-lib-row-main">
                <strong>{entry.mcVersion ?? entry.label}</strong>
                <span className="mc-lib-badge">{sourceLabel(entry.sourceType)}</span>
                {entry.mcVersion && entry.mcVersion === minecraftVersion && (
                  <span className="mc-lib-badge current">현재 프로젝트</span>
                )}
                {entry.mcVersion && entry.mcVersion === detection?.latestVersion && (
                  <span className="mc-lib-badge">최신 설치</span>
                )}
              </div>
              <div className="mc-lib-row-sub">
                텍스처 {entry.textureCount}개 (아이템 {entry.itemCount} · 블록 {entry.blockCount}) ·{" "}
                {formatBytes(entry.bytes)}
              </div>
              {pendingRemove === entry.versionKey ? (
                <div className="mc-lib-confirm">
                  <span>이 캐시를 지울까요? 프로젝트 파일은 그대로입니다.</span>
                  <button className="mini-btn danger" disabled={busy !== null} onClick={() => void runRemove(entry.versionKey)}>
                    삭제
                  </button>
                  <button className="mini-btn" onClick={() => setPendingRemove(null)}>
                    취소
                  </button>
                </div>
              ) : (
                <button
                  className="icon-btn mc-lib-remove"
                  disabled={busy !== null}
                  title={`${entry.versionKey} 캐시 삭제`}
                  onClick={() => setPendingRemove(entry.versionKey)}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mc-lib-path">
        <span>저장 경로</span>
        <code>{status?.libraryRoot ?? "확인 중…"}</code>
      </div>
      <div className="mc-lib-path">
        <span>마크 설치</span>
        <code>
          {detection?.mcHome
            ? `${detection.mcHome} · versions ${detection.installedVersions.length}개${
                detection.latestVersion ? ` (최신 ${detection.latestVersion})` : ""
              } · 리소스팩 ${detection.resourcePacks.length}개`
            : "설치 경로를 찾지 못했습니다"}
        </code>
      </div>
    </section>
  );
}
