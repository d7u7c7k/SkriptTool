import { Wand2, X } from "lucide-react";
import type { ReactNode } from "react";
import { toolRegistry } from "./registry";
import type { ToolId } from "./types";

type ToolDockProps = {
  activeTool: ToolId;
  onActiveToolChange: (toolId: ToolId) => void;
  onClose: () => void;
  children: ReactNode;
};

export function ToolDock({ activeTool, onActiveToolChange, onClose, children }: ToolDockProps) {
  const active = toolRegistry.find((tool) => tool.id === activeTool);

  return (
    <aside className="function-dock inventory-dock tool-dock">
      <div className="dock-header">
        <span className="dock-title">
          <Wand2 size={16} />
          Tool Editor
          {active ? <em className="dock-tool-name">{active.label}</em> : null}
        </span>
        <button className="dock-close" title="Close tool editor" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="tool-tabs">
        {toolRegistry.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={activeTool === tool.id ? "active" : ""}
            onClick={() => onActiveToolChange(tool.id)}
            title={tool.detail}
          >
            {tool.label}
          </button>
        ))}
      </div>

      <div className="tool-dock-body">{children}</div>
    </aside>
  );
}
