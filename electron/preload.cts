import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("skriptApi", {
  platform: process.platform,
  openFolder: () => ipcRenderer.invoke("workspace:openFolder"),
  refreshFolder: (rootPath: string) => ipcRenderer.invoke("workspace:refresh", rootPath),
  readFile: (filePath: string) => ipcRenderer.invoke("workspace:readFile", filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke("workspace:writeFile", filePath, content),
  createFile: (rootPath: string, relativePath: string, content: string) =>
    ipcRenderer.invoke("workspace:createFile", rootPath, relativePath, content),
  saveFileAs: (suggestedName: string, content: string) => ipcRenderer.invoke("workspace:saveAs", suggestedName, content)
});
