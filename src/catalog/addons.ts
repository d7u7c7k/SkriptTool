import type { AddonPackage } from "./types";

export const addonPackages: AddonPackage[] = [
  {
    id: "skbee",
    name: "SkBee",
    description: "NBT, scoreboards, bosses, and more modern utilities.",
    versions: ["3.9.0", "3.8.2", "3.5.0", "3.0.0"],
    compatibility: {
      minecraft: ["1.21.4", "1.21.1", "1.20.6", "1.20.4"],
      skript: ["2.10.0", "2.9.5", "2.8.7"]
    }
  },
  {
    id: "skript-reflect",
    name: "skript-reflect",
    description: "Call Java reflection APIs from Skript.",
    versions: ["2.5.1", "2.4.0", "2.3.0"],
    compatibility: {
      minecraft: ["1.21.4", "1.21.1", "1.20.6", "1.20.4", "1.19.4"],
      skript: ["2.10.0", "2.9.5", "2.8.7", "2.7.3"]
    }
  },
  {
    id: "skript-yaml",
    name: "skript-yaml",
    description: "YAML storage helpers. Works across Skript versions.",
    versions: ["1.5.0", "1.4.0", "1.3.2"],
    compatibility: "all"
  },
  {
    id: "skquery",
    name: "SkQuery",
    description: "Classic utility expressions and effects.",
    versions: ["4.1.1", "4.0.0", "3.6.0"],
    compatibility: {
      minecraft: ["1.20.6", "1.20.4", "1.19.4"],
      skript: ["2.9.5", "2.8.7", "2.7.3"]
    }
  },
  {
    id: "skellett",
    name: "Skellett",
    description: "Extra events, effects, and expressions.",
    versions: ["2.0.10", "1.9.6"],
    compatibility: {
      minecraft: ["1.20.4", "1.19.4"],
      skript: ["2.8.7", "2.7.3"]
    }
  },
  {
    id: "tuske",
    name: "TuSKe",
    description: "GUI and recipe helpers (legacy).",
    versions: ["1.8.2", "1.7.5"],
    compatibility: {
      minecraft: ["1.19.4"],
      skript: ["2.7.3"]
    }
  },
  {
    id: "skrayfall",
    name: "SkRayFall",
    description: "Titles, scoreboards, and misc effects.",
    versions: ["1.9.28", "1.9.25"],
    compatibility: {
      minecraft: ["1.21.1", "1.20.6", "1.20.4", "1.19.4"],
      skript: ["2.9.5", "2.8.7", "2.7.3"]
    }
  }
];
