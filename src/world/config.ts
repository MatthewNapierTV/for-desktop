import { contextBridge, ipcRenderer } from "electron";

// fetch the initial config synchronously so it is available before
// the web app's first render (avoids a stray titlebar in shell views)
let config: DesktopConfig = ipcRenderer.sendSync("config:getSync");

ipcRenderer.on("config", (_, data) => (config = data));

contextBridge.exposeInMainWorld("desktopConfig", {
  get: () => config,
  set: (config: DesktopConfig) => ipcRenderer.send("config", config),
  getAutostart() {
    return ipcRenderer.invoke("getAutostart") as Promise<boolean>;
  },
  setAutostart(value: boolean) {
    return ipcRenderer.invoke("setAutostart", value) as Promise<boolean>;
  },
});
