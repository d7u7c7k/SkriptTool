import { app, BrowserWindow, dialog, ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1100,
    minHeight: 700,
    title: "Skript Tool",
    backgroundColor: "#1f2329",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    void win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

ipcMain.handle("dialog:openSkript", async () => {
  const result = await dialog.showOpenDialog({
    title: "Skript 파일 열기",
    properties: ["openFile"],
    filters: [{ name: "Skript", extensions: ["sk"] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, "utf8");
  return {
    path: filePath,
    name: path.basename(filePath),
    content
  };
});

ipcMain.handle("file:saveSkript", async (_event, payload: { path?: string; content: string }) => {
  let targetPath = payload.path;

  if (!targetPath) {
    const result = await dialog.showSaveDialog({
      title: "Skript 파일 저장",
      defaultPath: "script.sk",
      filters: [{ name: "Skript", extensions: ["sk"] }]
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    targetPath = result.filePath;
  }

  await fs.writeFile(targetPath, payload.content, "utf8");
  return {
    path: targetPath,
    name: path.basename(targetPath)
  };
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
