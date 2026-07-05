import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("instanceDialog", {
  submit: (name: string, url: string) =>
    ipcRenderer.send("instanceDialog:submit", name, url),
  cancel: () => ipcRenderer.send("instanceDialog:cancel"),
  onError: (callback: (message: string) => void) =>
    ipcRenderer.on("instanceDialog:error", (_, message) => callback(message)),
});
