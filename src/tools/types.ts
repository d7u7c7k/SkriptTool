export type ToolId = "send" | "inventory";

export type ToolDefinition = {
  id: ToolId;
  label: string;
  detail: string;
  /** Marker line inserted into the editor (no final Skript yet) */
  marker: string;
};

export type ToolSession = {
  toolId: ToolId;
  /** 1-based line of the @tool marker when known */
  markerLine?: number;
};
