import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

const COLOR_MAP: Record<string, string> = {
  "0": "#000000",
  "1": "#0000aa",
  "2": "#00aa00",
  "3": "#00aaaa",
  "4": "#aa0000",
  "5": "#aa00aa",
  "6": "#ffaa00",
  "7": "#aaaaaa",
  "8": "#555555",
  "9": "#5555ff",
  a: "#55ff55",
  b: "#55ffff",
  c: "#ff5555",
  d: "#ff55ff",
  e: "#ffff55",
  f: "#ffffff"
};

type StyleState = {
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  obfuscated: boolean;
};

function defaultStyle(): StyleState {
  return {
    color: "#ffffff",
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    obfuscated: false
  };
}

/** Render Minecraft `&` / `§` formatted text as React nodes. */
export function renderMinecraftText(input: string): ReactNode {
  const parts: ReactNode[] = [];
  let style = defaultStyle();
  let buffer = "";
  let key = 0;

  const flush = () => {
    if (!buffer) {
      return;
    }
    const text = style.obfuscated ? buffer.replace(/./g, "▒") : buffer;
    parts.push(
      createElement(
        "span",
        {
          key: key++,
          style: {
            color: style.color,
            fontWeight: style.bold ? 700 : 400,
            fontStyle: style.italic ? "italic" : "normal",
            textDecoration: [style.underline ? "underline" : "", style.strike ? "line-through" : ""]
              .filter(Boolean)
              .join(" ") || undefined
          }
        },
        text
      )
    );
    buffer = "";
  };

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if ((char === "&" || char === "§") && i + 1 < input.length) {
      const code = input[i + 1].toLowerCase();
      flush();
      if (COLOR_MAP[code]) {
        style = { ...defaultStyle(), color: COLOR_MAP[code] };
      } else if (code === "l") {
        style = { ...style, bold: true };
      } else if (code === "o") {
        style = { ...style, italic: true };
      } else if (code === "n") {
        style = { ...style, underline: true };
      } else if (code === "m") {
        style = { ...style, strike: true };
      } else if (code === "k") {
        style = { ...style, obfuscated: true };
      } else if (code === "r") {
        style = defaultStyle();
      } else {
        buffer += char + input[i + 1];
      }
      i += 1;
      continue;
    }
    buffer += char;
  }

  flush();
  return createElement(Fragment, null, ...parts);
}
