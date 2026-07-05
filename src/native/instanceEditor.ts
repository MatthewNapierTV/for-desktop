import { join } from "node:path";

import { BrowserWindow, dialog, ipcMain, nativeImage } from "electron";

import windowIconAsset from "../../assets/desktop/icon.png?asset";

import { getInstances, updateInstance } from "./instances";
import { pushShellState } from "./unifiedShell";

// currently open editor and the instance it edits
let editorWindow: BrowserWindow | null = null;
let editingUrl: string | null = null;

/**
 * Open the "Edit Instance" dialog for the given instance
 */
export function openInstanceEditor(url: string) {
  const instance = getInstances().find((i) => i.url === url);
  if (!instance) {
    return;
  }

  editingUrl = url;

  if (editorWindow) {
    editorWindow.show();
    editorWindow.focus();
    pushEditorState();
    return;
  }

  editorWindow = new BrowserWindow({
    width: 420,
    height: 560,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "Edit Instance",
    backgroundColor: "#191919",
    icon: nativeImage.createFromDataURL(windowIconAsset),
    webPreferences: {
      // relative to `.vite/build`
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  editorWindow.setMenu(null);
  editorWindow.webContents.on("did-finish-load", pushEditorState);
  editorWindow.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(editorHtml),
  );

  editorWindow.on("closed", () => {
    editorWindow = null;
    editingUrl = null;
  });
}

function pushEditorState() {
  const instance = getInstances().find((i) => i.url === editingUrl);
  if (instance) {
    editorWindow?.webContents.send("editor:state", instance);
  }
}

function isFromEditor(sender: Electron.WebContents) {
  return editorWindow !== null && sender.id === editorWindow.webContents.id;
}

ipcMain.on("editor:pickIcon", async (event) => {
  if (!isFromEditor(event.sender) || !editorWindow) {
    return;
  }

  const result = await dialog.showOpenDialog(editorWindow, {
    title: "Choose an instance icon",
    properties: ["openFile"],
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] },
    ],
  });

  if (result.canceled || !result.filePaths.length) {
    return;
  }

  const image = nativeImage.createFromPath(result.filePaths[0]);
  if (image.isEmpty()) {
    event.sender.send("editor:error", "That file could not be read as an image.");
    return;
  }

  // store a small square version so instances.json stays lightweight
  event.sender.send(
    "editor:icon",
    image.resize({ width: 128, height: 128 }).toDataURL(),
  );
});

ipcMain.on(
  "editor:submit",
  (event, name: string, color: string | null, icon: string | null) => {
    if (!isFromEditor(event.sender) || !editingUrl) {
      return;
    }

    updateInstance(editingUrl, {
      name: name.trim() || undefined,
      color: color || undefined,
      icon: icon || undefined,
    });

    editorWindow?.close();
    pushShellState();
  },
);

ipcMain.on("editor:cancel", (event) => {
  if (isFromEditor(event.sender)) {
    editorWindow?.close();
  }
});

const editorHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Edit Instance</title>
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
      .swatches { display: flex; gap: 6px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
      .swatch {
        width: 26px; height: 26px; border-radius: 50%;
        border: 2px solid transparent; cursor: pointer; padding: 0;
      }
      .swatch.selected { border-color: #fff; }
      .swatch.none {
        background: #242424; color: #888; font-size: 14px; line-height: 1;
        display: flex; align-items: center; justify-content: center;
      }
      input[type="color"] {
        width: 26px; height: 26px; border: none; border-radius: 50%;
        background: none; cursor: pointer; padding: 0;
      }
      .iconRow { display: flex; gap: 12px; align-items: center; margin-bottom: 14px; }
      #preview {
        width: 56px; height: 56px; border-radius: 30%;
        background: #313338; background-size: cover; background-position: center;
        display: flex; align-items: center; justify-content: center;
        font-size: 18px; font-weight: 600; flex: none;
      }
      .iconBtns { display: flex; flex-direction: column; gap: 6px; }
      button {
        padding: 8px 14px; border: none; border-radius: 6px;
        font-size: 13px; cursor: pointer;
      }
      button.primary { background: #ff5733; color: #fff; }
      button.secondary { background: #2e2e2e; color: #ddd; }
      .error { color: #ff6b6b; font-size: 12px; min-height: 16px; margin-bottom: 8px; }
      .buttons { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
    </style>
  </head>
  <body>
    <h1>Edit Instance</h1>
    <p class="hint">Customise how this instance appears in the rail.</p>
    <label for="name">Display name</label>
    <input type="text" id="name" />
    <label>Colour</label>
    <div class="swatches" id="swatches">
      <button class="swatch none" title="No colour">✕</button>
      <input type="color" id="custom" title="Custom colour" value="#ff5733" />
    </div>
    <label>Icon</label>
    <div class="iconRow">
      <div id="preview"></div>
      <div class="iconBtns">
        <button class="secondary" id="pick">Choose image…</button>
        <button class="secondary" id="removeIcon">Remove icon</button>
      </div>
    </div>
    <div class="error" id="error"></div>
    <div class="buttons">
      <button class="secondary" id="cancel">Cancel</button>
      <button class="primary" id="save">Save</button>
    </div>
    <script>
      const PRESETS = ["#ff5733", "#5865f2", "#3ba55d", "#faa61a",
                       "#eb459e", "#9b59b6", "#e74c3c", "#1abc9c"];
      let state = { name: "", color: null, icon: null };

      const nameInput = document.getElementById("name");
      const preview = document.getElementById("preview");
      const swatches = document.getElementById("swatches");
      const custom = document.getElementById("custom");

      // build preset swatches before the custom picker
      for (const color of PRESETS) {
        const b = document.createElement("button");
        b.className = "swatch";
        b.style.background = color;
        b.dataset.color = color;
        b.addEventListener("click", () => { state.color = color; refresh(); });
        swatches.insertBefore(b, custom);
      }

      function initials(name) {
        return (name || "?")
          .split(/\\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
      }

      function refresh() {
        for (const el of swatches.querySelectorAll(".swatch")) {
          el.classList.toggle(
            "selected",
            el.dataset.color ? el.dataset.color === state.color : !state.color,
          );
        }
        if (state.icon) {
          preview.style.backgroundImage = "url(" + state.icon + ")";
          preview.textContent = "";
        } else {
          preview.style.backgroundImage = "none";
          preview.style.background = state.color || "#313338";
          preview.textContent = initials(nameInput.value);
        }
      }

      window.stoatShell.onEditorState((instance) => {
        state = {
          name: instance.name,
          color: instance.color || null,
          icon: instance.icon || null,
        };
        nameInput.value = instance.name;
        refresh();
      });
      window.stoatShell.onEditorIcon((dataUrl) => { state.icon = dataUrl; refresh(); });
      window.stoatShell.onEditorError(
        (message) => (document.getElementById("error").textContent = message),
      );

      swatches.querySelector(".none").addEventListener("click", () => {
        state.color = null; refresh();
      });
      custom.addEventListener("input", () => { state.color = custom.value; refresh(); });
      nameInput.addEventListener("input", refresh);
      document.getElementById("pick").addEventListener("click", () =>
        window.stoatShell.editorPickIcon(),
      );
      document.getElementById("removeIcon").addEventListener("click", () => {
        state.icon = null; refresh();
      });
      document.getElementById("save").addEventListener("click", () =>
        window.stoatShell.editorSubmit(nameInput.value, state.color, state.icon),
      );
      document.getElementById("cancel").addEventListener("click", () =>
        window.stoatShell.editorCancel(),
      );
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") window.stoatShell.editorCancel();
      });
    </script>
  </body>
</html>`;
