import { contextBridge, ipcRenderer } from "electron";

/**
 * Bridge for the shell's own UI surfaces (rail, chooser, add dialog).
 * Instance web apps also see this object, but the main process only
 * accepts each channel from the surface it belongs to.
 */
contextBridge.exposeInMainWorld("stoatShell", {
  // rail
  onState: (
    callback: (state: {
      instances: { name: string; url: string; kind: string }[];
      activeUrl: string;
    }) => void,
  ) => ipcRenderer.on("shell:state", (_, state) => callback(state)),
  switch: (url: string) => ipcRenderer.send("shell:switch", url),
  context: (url: string) => ipcRenderer.send("shell:context", url),
  addServer: () => ipcRenderer.send("shell:addServer"),
  toggleRail: () => ipcRenderer.send("shell:toggleRail"),

  // "add a server" chooser
  chooserPick: (url: string) => ipcRenderer.send("chooser:pick", url),
  chooserAddInstance: () => ipcRenderer.send("chooser:addInstance"),
  chooserCancel: () => ipcRenderer.send("chooser:cancel"),

  // "register instance" dialog
  dialogSubmit: (name: string, url: string, kind: string) =>
    ipcRenderer.send("dialog:submit", name, url, kind),
  dialogCancel: () => ipcRenderer.send("dialog:cancel"),
  onDialogError: (callback: (message: string) => void) =>
    ipcRenderer.on("dialog:error", (_, message) => callback(message)),

  // "edit instance" dialog
  onEditorState: (callback: (instance: unknown) => void) =>
    ipcRenderer.on("editor:state", (_, instance) => callback(instance)),
  onEditorIcon: (callback: (dataUrl: string) => void) =>
    ipcRenderer.on("editor:icon", (_, dataUrl) => callback(dataUrl)),
  onEditorError: (callback: (message: string) => void) =>
    ipcRenderer.on("editor:error", (_, message) => callback(message)),
  editorPickIcon: () => ipcRenderer.send("editor:pickIcon"),
  editorSubmit: (name: string, color: string | null, icon: string | null) =>
    ipcRenderer.send("editor:submit", name, color, icon),
  editorCancel: () => ipcRenderer.send("editor:cancel"),
});
