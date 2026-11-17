import type { SkriptRelease } from "./types";

export const skriptReleases: SkriptRelease[] = [
  {
    version: "2.13.0",
    minecraft: ["1.21.8", "1.21.5", "1.21.4"],
    recommended: true
  },
  {
    version: "2.12.1",
    minecraft: ["1.21.8", "1.21.5", "1.21.4", "1.21.1"]
  },
  {
    version: "2.11.0",
    minecraft: ["1.21.5", "1.21.4", "1.21.1", "1.20.6"]
  },
  {
    version: "2.10.0",
    minecraft: ["1.21.4", "1.21.1", "1.20.6", "1.20.4"]
  },
  {
    version: "2.9.5",
    minecraft: ["1.21.1", "1.20.6", "1.20.4", "1.19.4"]
  },
  {
    version: "2.8.7",
    minecraft: ["1.20.6", "1.20.4", "1.19.4"]
  },
  {
    version: "2.7.3",
    minecraft: ["1.20.4", "1.19.4", "1.18.2"]
  }
];

export const oldestSupportedSkript = "2.7.3";
