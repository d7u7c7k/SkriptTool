import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("skriptApi", {
  platform: process.platform,
  openFolder: () => ipcRenderer.invoke("workspace:openFolder"),
  refreshFolder: (rootPath: string) => ipcRenderer.invoke("workspace:refresh", rootPath),
  readFile: (filePath: string) => ipcRenderer.invoke("workspace:readFile", filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke("workspace:writeFile", filePath, content),
  createFile: (rootPath: string, relativePath: string, content: string) =>
    ipcRenderer.invoke("workspace:createFile", rootPath, relativePath, content),
  saveFileAs: (suggestedName: string, content: string) => ipcRenderer.invoke("workspace:saveAs", suggestedName, content),
  pickProjectLocation: () => ipcRenderer.invoke("project:pickParent"),
  createProject: (parentPath: string, folderName: string, configText: string, mainContent: string) =>
    ipcRenderer.invoke("project:create", parentPath, folderName, configText, mainContent),
  openProject: () => ipcRenderer.invoke("project:open"),
  openProjectAt: (targetPath: string) => ipcRenderer.invoke("project:openAt", targetPath),
  readProjectConfig: (rootPath: string) => ipcRenderer.invoke("project:readConfig", rootPath),
  writeProjectConfig: (rootPath: string, configText: string) =>
    ipcRenderer.invoke("project:writeConfig", rootPath, configText),
  mcLibrary: {
    getStatus: () => ipcRenderer.invoke("mcLibrary:getStatus"),
    sync: (targetMcVersion: string | null) => ipcRenderer.invoke("mcLibrary:sync", targetMcVersion),
    pickPack: () => ipcRenderer.invoke("mcLibrary:pickPack"),
    removeVersion: (versionKey: string) => ipcRenderer.invoke("mcLibrary:removeVersion", versionKey)
  }
});
