import { spawn } from "node:child_process";
import electronPath from "electron";

const env = {
  ...process.env,
  VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173"
};

delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ["."], {
  env,
  stdio: "inherit",
  windowsHide: false
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
