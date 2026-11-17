import { ChevronDown, ChevronRight, FileCode2, FilePlus2, Folder, FolderOpen, FolderPlus, PanelLeft, RefreshCw, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { countFiles, type FileNode, type TreeNode, type WorkspaceState } from "./types";

type Props = {
  workspace: WorkspaceState;
  activePath: string | null;
  onOpenFile: (node: FileNode) => void;
  onOpenFolder: () => void;
  onRefresh: () => void;
  onCreateFile: (name: string) => Promise<boolean>;
  onCollapse: () => void;
  creating: boolean;
  onRequestCreate: () => void;
  onCancelCreate: () => void;
};

function FolderRows({
  node,
  depth,
  activePath,
  onOpenFile
}: {
  node: Extract<TreeNode, { kind: "folder" }>;
  depth: number;
  activePath: string | null;
  onOpenFile: (node: FileNode) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="tree-group">
      <button className="tree-row folder" style={{ paddingLeft: 8 + depth * 12 }} onClick={() => setOpen((value) => !value)}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {open ? <FolderOpen size={14} /> : <Folder size={14} />}
        <span className="tree-name">{node.name}</span>
      </button>
      {open &&
        node.children.map((child) =>
          child.kind === "folder" ? (
            <FolderRows key={child.path} node={child} depth={depth + 1} activePath={activePath} onOpenFile={onOpenFile} />
          ) : (
            <FileRow key={child.path} node={child} depth={depth + 1} activePath={activePath} onOpenFile={onOpenFile} />
          )
        )}
    </div>
  );
}

function FileRow({
  node,
  depth,
  activePath,
  onOpenFile
}: {
  node: FileNode;
  depth: number;
  activePath: string | null;
  onOpenFile: (node: FileNode) => void;
}) {
  return (
    <button
      className={`tree-row file ${activePath === node.path ? "active" : ""}`}
      style={{ paddingLeft: 18 + depth * 12 }}
      onClick={() => onOpenFile(node)}
      title={node.relativePath}
    >
      <FileCode2 size={14} />
      <span className="tree-name">{node.name}</span>
    </button>
  );
}

export function FileTree({
  workspace,
  activePath,
  onOpenFile,
  onOpenFolder,
  onRefresh,
  onCreateFile,
  onCollapse,
  creating,
  onRequestCreate,
  onCancelCreate
}: Props) {
  const [draftName, setDraftName] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) {
      return;
    }
    const created = await onCreateFile(name);
    if (created) {
      setDraftName("");
      onCancelCreate();
    }
  };

  return (
    <div className="sidebar-inner">
      <div className="sidebar-header">
        <span className="sidebar-title">프로젝트</span>
        <div className="sidebar-actions">
          <button className="icon-btn" title="새 .sk 파일 (파일 이름에 폴더 경로도 쓸 수 있어요)" onClick={onRequestCreate}>
            <FilePlus2 size={15} />
          </button>
          <button className="icon-btn" title="폴더 열기 (Ctrl/Cmd+O)" onClick={onOpenFolder}>
            <FolderPlus size={15} />
          </button>
          <button className="icon-btn" title="파일 트리 새로고침" onClick={onRefresh}>
            <RefreshCw size={14} />
          </button>
          <button className="icon-btn" title="사이드바 접기 (Ctrl/Cmd+B)" onClick={onCollapse}>
            <PanelLeft size={15} />
          </button>
        </div>
      </div>

      <div className="tree-root" title={workspace.root.path}>
        <Folder size={13} />
        <span>{workspace.root.name}</span>
        <span className="tree-count">{countFiles(workspace.tree)}</span>
      </div>

      {creating && (
        <form className="new-file-form" onSubmit={submit}>
          <input
            autoFocus
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="예: shop.sk 또는 gui/shop.sk"
            aria-label="새 Skript 파일 이름"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onCancelCreate();
                setDraftName("");
              }
            }}
          />
          <button className="mini-btn" type="submit" title="만들기">
            만들기
          </button>
          <button
            className="icon-btn small"
            type="button"
            title="취소"
            onClick={() => {
              onCancelCreate();
              setDraftName("");
            }}
          >
            <X size={13} />
          </button>
        </form>
      )}

      <div className="tree-scroll">
        {workspace.tree.length === 0 ? (
          <div className="tree-empty">
            <span>.sk 파일이 없습니다.</span>
            <button className="mini-btn" onClick={onRequestCreate}>
              첫 파일 만들기
            </button>
          </div>
        ) : (
          workspace.tree.map((node) =>
            node.kind === "folder" ? (
              <FolderRows key={node.path} node={node} depth={0} activePath={activePath} onOpenFile={onOpenFile} />
            ) : (
              <FileRow key={node.path} node={node} depth={0} activePath={activePath} onOpenFile={onOpenFile} />
            )
          )
        )}
      </div>

      <div className="sidebar-foot">
        <span className={`mode-dot ${workspace.kind}`} />
        {workspace.kind === "electron" && <span>로컬 폴더 연결됨</span>}
        {workspace.kind === "browser" && <span>브라우저 폴더 연결</span>}
        {workspace.kind === "memory" && <span>예제 워크스페이스 · 새로고침하면 초기화</span>}
      </div>
    </div>
  );
}
