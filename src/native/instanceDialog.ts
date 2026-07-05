import { join } from "node:path";

import { BrowserWindow, ipcMain, nativeImage } from "electron";

import windowIconAsset from "../../assets/desktop/icon.png?asset";

import { InstanceKind, addInstance, parseInstanceUrl } from "./instances";
import { onInstanceAdded } from "./unifiedShell";

// currently open dialog, if any
let dialogWindow: BrowserWindow | null = null;

/**
 * Open the "Register Instance" dialog, creating it if necessary
 */
export function openAddInstanceDialog() {
  if (dialogWindow) {
    dialogWindow.show();
    dialogWindow.focus();
    return;
  }

  dialogWindow = new BrowserWindow({
    width: 420,
    height: 460,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "Register Instance",
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

function isFromDialog(sender: Electron.WebContents) {
  return dialogWindow !== null && sender.id === dialogWindow.webContents.id;
}

ipcMain.on(
  "dialog:submit",
  (event, name: string, url: string, kind: string) => {
    if (!isFromDialog(event.sender)) {
      return;
    }

    if (!parseInstanceUrl(url)) {
      event.sender.send("dialog:error", "Enter a valid http(s) URL.");
      return;
    }

    const instance = addInstance(
      name,
      url,
      kind === "live" || kind === "local" ? (kind as InstanceKind) : undefined,
    );

    if (!instance) {
      event.sender.send(
        "dialog:error",
        "That instance is already registered.",
      );
      return;
    }

    dialogWindow?.close();
    onInstanceAdded(instance);
  },
);

ipcMain.on("dialog:cancel", (event) => {
  if (isFromDialog(event.sender)) {
    dialogWindow?.close();
  }
});

const dialogHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Register Instance</title>
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
      p.hint { font-size: 12px; color: #999; margin-bottom: 16px; line-height: 1.5; }
      label { display: block; font-size: 12px; color: #bbb; margin-bottom: 4px; }
      input[type="text"] {
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
      input[type="text"]:focus { border-color: #ff5733; }
      .kinds { display: flex; gap: 8px; margin-bottom: 14px; }
      .kinds label {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px;
        border: 1px solid #333;
        border-radius: 6px;
        background: #242424;
        color: #ddd;
        font-size: 12px;
        cursor: pointer;
        margin: 0;
      }
      .kinds input { accent-color: #ff5733; }
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
    <h1>Register Instance</h1>
    <p class="hint">
      An instance is a whole Stoat server (backend) — like the official one,
      or one you host yourself. It appears in the rail on the left.
    </p>
    <label for="name">Display name</label>
    <input type="text" id="name" placeholder="My Home Server" />
    <label for="url">Web app URL</label>
    <input type="text" id="url" placeholder="http://localhost" />
    <label>Type</label>
    <div class="kinds">
      <label><input type="radio" name="kind" value="auto" checked /> Auto-detect</label>
      <label><input type="radio" name="kind" value="live" /> Live</label>
      <label><input type="radio" name="kind" value="local" /> Local</label>
    </div>
    <div class="error" id="error"></div>
    <div class="buttons">
      <button class="secondary" id="cancel">Cancel</button>
      <button class="primary" id="add">Register &amp; Connect</button>
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

        window.stoatShell.dialogSubmit(
          document.getElementById("name").value,
          url,
          document.querySelector('input[name="kind"]:checked').value,
        );
      }

      window.stoatShell.onDialogError((message) => (error.textContent = message));
      document.getElementById("add").addEventListener("click", submit);
      document.getElementById("cancel").addEventListener("click", () =>
        window.stoatShell.dialogCancel(),
      );
      document.addEventListener("keydown", (event) => {
        if (event.key === "Enter") submit();
        if (event.key === "Escape") window.stoatShell.dialogCancel();
      });
    </script>
  </body>
</html>`;
