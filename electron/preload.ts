import { contextBridge, ipcRenderer } from "electron";

export type SkriptFile = {
  path: string;
  name: string;
  content: string;
};

contextBridge.exposeInMainWorld("skriptApi", {
  openSkript: () => ipcRenderer.invoke("dialog:openSkript") as Promise<SkriptFile | null>,
  saveSkript: (payload: { path?: string; content: string }) =>
    ipcRenderer.invoke("file:saveSkript", payload) as Promise<{ path: string; name: string } | null>
});
