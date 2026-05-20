import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("skriptApi", {
  openSkript: () => ipcRenderer.invoke("dialog:openSkript"),
  saveSkript: (payload: { path?: string; content: string }) => ipcRenderer.invoke("file:saveSkript", payload)
});
