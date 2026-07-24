import type { SkriptRelease } from "./types";

export const skriptReleases: SkriptRelease[] = [
  {
    version: "2.10.0",
    minecraft: ["1.21.4", "1.21.1", "1.20.6", "1.20.4"],
    recommended: true
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
    minecraft: ["1.20.4", "1.19.4"]
  }
];
