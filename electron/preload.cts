import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("skriptApi", {
  openSkript: () => ipcRenderer.invoke("dialog:openSkript"),
  saveSkript: (payload: { path?: string; content: string }) => ipcRenderer.invoke("file:saveSkript", payload),
  getMinecraftHome: () => ipcRenderer.invoke("minecraft:getHome") as Promise<string>,
  prepareMinecraftAssets: (version: string) =>
    ipcRenderer.invoke("minecraft:prepareAssets", version) as Promise<{
      version: string;
      minecraftPath: string;
      itemCount: number;
      items: Array<{ id: string; label: string; labelKo: string; texture: string; dataUrl: string }>;
    }>
});
