import { join } from "node:path";

import { BrowserWindow, ipcMain, nativeImage } from "electron";

import windowIconAsset from "../../assets/desktop/icon.png?asset";

import { addInstance, parseInstanceUrl } from "./instances";
import { switchInstance } from "./instanceWindows";

// currently open dialog, if any
let dialogWindow: BrowserWindow | null = null;

const dialogHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Add Instance</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: "Segoe UI", system-ui, sans-serif;
        background: #191919;
        color: #f0f0f0;
        padding: 24px;
        user-select: none;
      }
      h1 { font-size: 16px; margin-bottom: 4px; }
      p.hint { font-size: 12px; color: #999; margin-bottom: 16px; }
      label { display: block; font-size: 12px; color: #bbb; margin-bottom: 4px; }
      input {
        width: 100%;
        padding: 8px 10px;
        margin-bottom: 14px;
        border: 1px solid #333;
        border-radius: 6px;
        background: #242424;
        color: #f0f0f0;
        font-size: 13px;
        outline: none;
      }
      input:focus { border-color: #ff5733; }
      .error { color: #ff6b6b; font-size: 12px; min-height: 16px; margin-bottom: 8px; }
      .buttons { display: flex; gap: 8px; justify-content: flex-end; }
      button {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
      }
      button.primary { background: #ff5733; color: #fff; }
      button.secondary { background: #2e2e2e; color: #ddd; }
    </style>
  </head>
  <body>
    <h1>Add Instance</h1>
    <p class="hint">Point the app at any Stoat server, such as a locally hosted one.</p>
    <label for="name">Display name</label>
    <input id="name" placeholder="My Home Server" />
    <label for="url">Web app URL</label>
    <input id="url" placeholder="http://localhost:5173" />
    <div class="error" id="error"></div>
    <div class="buttons">
      <button class="secondary" id="cancel">Cancel</button>
      <button class="primary" id="add">Add &amp; Connect</button>
    </div>
    <script>
      const error = document.getElementById("error");

      function submit() {
        const url = document.getElementById("url").value.trim();
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            throw new Error();
          }
        } catch {
          error.textContent = "Enter a valid http(s) URL.";
          return;
        }

        window.instanceDialog.submit(
          document.getElementById("name").value,
          url,
        );
      }

      window.instanceDialog.onError((message) => (error.textContent = message));
      document.getElementById("add").addEventListener("click", submit);
      document.getElementById("cancel").addEventListener("click", () =>
        window.instanceDialog.cancel(),
      );
      document.addEventListener("keydown", (event) => {
        if (event.key === "Enter") submit();
        if (event.key === "Escape") window.instanceDialog.cancel();
      });
    </script>
  </body>
</html>`;

/**
 * Open the "Add Instance" dialog, creating it if necessary
 */
export function openAddInstanceDialog() {
  if (dialogWindow) {
    dialogWindow.show();
    dialogWindow.focus();
    return;
  }

  dialogWindow = new BrowserWindow({
    width: 420,
    height: 380,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: "#191919",
    icon: nativeImage.createFromDataURL(windowIconAsset),
    webPreferences: {
      // relative to `.vite/build`
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  dialogWindow.setMenu(null);
  dialogWindow.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(dialogHtml),
  );

  dialogWindow.on("closed", () => {
    dialogWindow = null;
  });
}

/**
 * Only accept dialog IPC from the dialog window itself,
 * never from a (remote) web app
 */
function isFromDialog(sender: Electron.WebContents) {
  return dialogWindow !== null && sender.id === dialogWindow.webContents.id;
}

ipcMain.on("instanceDialog:submit", (event, name: string, url: string) => {
  if (!isFromDialog(event.sender)) {
    return;
  }

  const parsed = parseInstanceUrl(url);
  if (!parsed) {
    event.sender.send("instanceDialog:error", "Enter a valid http(s) URL.");
    return;
  }

  if (!addInstance(name, url)) {
    event.sender.send(
      "instanceDialog:error",
      "That instance is already in the list.",
    );
    return;
  }

  dialogWindow?.close();
  switchInstance(parsed.toString());
});

ipcMain.on("instanceDialog:cancel", (event) => {
  if (isFromDialog(event.sender)) {
    dialogWindow?.close();
  }
});
