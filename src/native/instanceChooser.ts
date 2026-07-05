import { join } from "node:path";

import { BrowserWindow, ipcMain, nativeImage } from "electron";

import windowIconAsset from "../../assets/desktop/icon.png?asset";

import { openAddInstanceDialog } from "./instanceDialog";
import { getActiveInstanceUrl, getInstances } from "./instances";
import { switchToInstance } from "./unifiedShell";

// currently open chooser, if any
let chooserWindow: BrowserWindow | null = null;

/**
 * "Add a server" flow: first pick which instance the server should
 * live on (live / local 1 / local 2 / …), or register a new instance
 */
export function openInstanceChooser() {
  if (chooserWindow) {
    chooserWindow.show();
    chooserWindow.focus();
    return;
  }

  chooserWindow = new BrowserWindow({
    width: 400,
    height: 480,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "Add a Server",
    backgroundColor: "#191919",
    icon: nativeImage.createFromDataURL(windowIconAsset),
    webPreferences: {
      // relative to `.vite/build`
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  chooserWindow.setMenu(null);
  chooserWindow.webContents.on("did-finish-load", pushChooserState);
  chooserWindow.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(chooserHtml),
  );

  chooserWindow.on("closed", () => {
    chooserWindow = null;
  });
}

function pushChooserState() {
  chooserWindow?.webContents.send("shell:state", {
    instances: getInstances(),
    activeUrl: getActiveInstanceUrl().toString(),
  });
}

function isFromChooser(sender: Electron.WebContents) {
  return chooserWindow !== null && sender.id === chooserWindow.webContents.id;
}

ipcMain.on("chooser:pick", (event, url: string) => {
  if (!isFromChooser(event.sender)) {
    return;
  }

  chooserWindow?.close();
  switchToInstance(url);
});

ipcMain.on("chooser:addInstance", (event) => {
  if (!isFromChooser(event.sender)) {
    return;
  }

  chooserWindow?.close();
  openAddInstanceDialog();
});

ipcMain.on("chooser:cancel", (event) => {
  if (isFromChooser(event.sender)) {
    chooserWindow?.close();
  }
});

const chooserHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Add a Server</title>
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
      .group-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 1px;
        color: #777;
        text-transform: uppercase;
        margin: 12px 0 6px;
      }
      button.pick {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 10px 12px;
        margin-bottom: 6px;
        border: 1px solid #333;
        border-radius: 8px;
        background: #242424;
        color: #f0f0f0;
        font-size: 13px;
        cursor: pointer;
        text-align: left;
      }
      button.pick:hover { border-color: #ff5733; background: #2b2523; }
      .dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
      .dot.live { background: #5865f2; }
      .dot.local { background: #3ba55d; }
      .url { color: #888; font-size: 11px; margin-left: auto; }
      .footer { margin-top: 16px; border-top: 1px solid #2c2c2c; padding-top: 14px; }
      button.register {
        width: 100%;
        padding: 10px;
        border: 1px dashed #3ba55d;
        border-radius: 8px;
        background: transparent;
        color: #3ba55d;
        font-size: 13px;
        cursor: pointer;
      }
      button.register:hover { background: #1d2a20; }
    </style>
  </head>
  <body>
    <h1>Where do you want to add a server?</h1>
    <p class="hint">
      Pick an instance below — you'll be taken there, then use its own
      <b>+</b> button to create or join the server.
    </p>
    <div id="groups"></div>
    <div class="footer">
      <button class="register" id="register">
        ➕ Register a new instance (a literal server)…
      </button>
    </div>
    <script>
      function render(state) {
        const container = document.getElementById("groups");
        container.textContent = "";

        for (const [kind, label] of [["live", "Live"], ["local", "Local"]]) {
          const members = state.instances.filter((i) => i.kind === kind);
          if (!members.length) continue;

          const heading = document.createElement("div");
          heading.className = "group-label";
          heading.textContent = label;
          container.appendChild(heading);

          members.forEach((instance, index) => {
            const button = document.createElement("button");
            button.className = "pick";

            const dot = document.createElement("span");
            dot.className = "dot " + kind;

            const name = document.createElement("span");
            name.textContent =
              members.length > 1 && kind === "local"
                ? instance.name + " (local " + (index + 1) + ")"
                : instance.name;

            const url = document.createElement("span");
            url.className = "url";
            url.textContent = new URL(instance.url).host;

            button.append(dot, name, url);
            button.addEventListener("click", () =>
              window.stoatShell.chooserPick(instance.url),
            );
            container.appendChild(button);
          });
        }
      }

      window.stoatShell.onState(render);
      document.getElementById("register").addEventListener("click", () =>
        window.stoatShell.chooserAddInstance(),
      );
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") window.stoatShell.chooserCancel();
      });
    </script>
  </body>
</html>`;
