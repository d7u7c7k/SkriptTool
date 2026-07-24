import type { ToolId } from "./types";
import { parseToolMarker } from "./registry";

export type OpenToolRequest = {
  toolId: ToolId;
  markerLine: number;
  /** Leading whitespace of the marker line (preserved on Apply) */
  indent: string;
};

/** Inspect the current editor line and return a tool open request if it is a @tool marker. */
export function openToolFromEditorLine(lineContent: string, lineNumber: number): OpenToolRequest | null {
  const toolId = parseToolMarker(lineContent);
  if (!toolId) {
    return null;
  }
  return {
    toolId,
    markerLine: lineNumber,
    indent: lineContent.match(/^\s*/)?.[0] ?? ""
  };
}

function findMarkerIndex(lines: string[], toolId: ToolId, preferredLine?: number): number {
  const markerPattern = new RegExp(`^\\s*@tool(?::|\\s+)${toolId}\\s*$`, "i");
  const legacyInventory = toolId === "inventory";
  const isMarker = (line: string) =>
    markerPattern.test(line) || (legacyInventory && line.includes("함수(inventory)"));

  if (preferredLine !== undefined && preferredLine >= 1 && preferredLine <= lines.length) {
    if (isMarker(lines[preferredLine - 1])) {
      return preferredLine - 1;
    }
  }

  return lines.findIndex(isMarker);
}

/** Infer indent when the marker line itself has none (e.g. under a `trigger:` block). */
export function inferBlockIndent(lines: string[], markerIndex: number): string {
  const onLine = lines[markerIndex].match(/^\s*/)?.[0] ?? "";
  if (onLine.length > 0) {
    return onLine;
  }

  for (let i = markerIndex - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      continue;
    }
    const prevIndent = lines[i].match(/^\s*/)?.[0] ?? "";
    if (trimmed.endsWith(":")) {
      const unit = prevIndent.includes("\t") && !prevIndent.includes(" ") ? "\t" : "  ";
      return prevIndent + unit;
    }
    return prevIndent;
  }

  return "";
}

export type ApplyGeneratedOptions = {
  preferredLine?: number;
  /** Indent captured when the tool was opened; used if still valid */
  lockedIndent?: string;
};

/** Replace the matching @tool marker with generated Skript lines, keeping block indent. */
export function applyGeneratedAtMarker(
  content: string,
  toolId: ToolId,
  generated: string[],
  options: ApplyGeneratedOptions = {}
): string {
  const { preferredLine, lockedIndent } = options;
  const lines = content.split(/\r\n|\r|\n/);
  const targetIndex = findMarkerIndex(lines, toolId, preferredLine);

  if (targetIndex === -1) {
    const indent = lockedIndent ?? "";
    const block = generated.map((line) => (indent ? `${indent}${line}` : line)).join("\n");
    return `${content.trimEnd()}\n${block}\n`;
  }

  // Always read indent from the live marker line (and parent block if needed).
  const indent = inferBlockIndent(lines, targetIndex);
  lines.splice(targetIndex, 1, ...generated.map((line) => `${indent}${line}`));
  return lines.join("\n");
}
