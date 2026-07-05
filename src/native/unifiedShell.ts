import { join } from "node:path";

import {
  BrowserWindow,
  Menu,
  MenuItem,
  WebContentsView,
  ipcMain,
} from "electron";

import { config } from "./config";
import { openInstanceChooser } from "./instanceChooser";
import {
  Instance,
  getActiveInstanceUrl,
  getInstances,
  inferKind,
  parseInstanceUrl,
  removeInstance,
  setActiveInstance,
} from "./instances";

/** Width of the instance rail on the left of the window */
const RAIL_WIDTH = 72;

// shell state
let hostWindow: BrowserWindow;
let railView: WebContentsView;
const instanceViews = new Map<string, WebContentsView>();

/**
 * Instances shown in the shell: everything configured, plus an
 * ephemeral entry when `--force-server` points somewhere new
 */
export function displayedInstances(): Instance[] {
  const instances = getInstances();
  const active = getActiveInstanceUrl().toString();

  if (!instances.some((i) => parseInstanceUrl(i.url)?.toString() === active)) {
    instances.push({
      name: "Forced server",
      url: active,
      kind: inferKind(active),
    });
  }

  return instances;
}

function activeUrl(): string {
  return getActiveInstanceUrl().toString();
}

/**
 * Attach the rail and one view per instance to the main window.
 * Every instance stays loaded (and connected) at all times; the rail
 * only controls which one is visible.
 */
export function initUnifiedShell(win: BrowserWindow) {
  hostWindow = win;

  railView = new WebContentsView({
    webPreferences: {
      // relative to `.vite/build`
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  railView.setBackgroundColor("#111111");
  hostWindow.contentView.addChildView(railView);
  railView.webContents.on("did-finish-load", pushShellState);
  railView.webContents.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(railHtml),
  );

  for (const instance of displayedInstances()) {
    createInstanceView(instance.url);
  }

  hostWindow.on("resize", layout);
  hostWindow.on("maximize", layout);
  hostWindow.on("unmaximize", layout);
  layout();
}

/**
 * Create (or return) the always-connected view for an instance
 */
function createInstanceView(url: string): WebContentsView {
  const key = parseInstanceUrl(url)?.toString() ?? url;

  const existing = instanceViews.get(key);
  if (existing) {
    return existing;
  }

  const view = new WebContentsView({
    webPreferences: {
      // relative to `.vite/build`
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });
  view.setBackgroundColor("#191919");

  // the shell's window frame is native, so tell the web app
  // not to render its own window controls
  view.webContents.on("did-finish-load", () =>
    view.webContents.send("config", {
      ...config.snapshot(),
      customFrame: false,
    }),
  );

  // zoom and reload keys, scoped to the focused instance
  view.webContents.on("before-input-event", (event, input) => {
    if (input.control && (input.key === "=" || input.key === "+")) {
      event.preventDefault();
      view.webContents.setZoomLevel(view.webContents.getZoomLevel() + 1);
    } else if (input.control && input.key === "-") {
      event.preventDefault();
      view.webContents.setZoomLevel(view.webContents.getZoomLevel() - 1);
    } else if (input.control && input.key === "0") {
      event.preventDefault();
      view.webContents.setZoomLevel(0);
    } else if (
      input.key === "F5" ||
      ((input.control || input.meta) && input.key.toLowerCase() === "r")
    ) {
      event.preventDefault();
      view.webContents.reload();
    }
  });

  // spellchecker suggestions, same behaviour as upstream's main window
  view.webContents.on("context-menu", (_, params) => {
    const menu = new Menu();

    for (const suggestion of params.dictionarySuggestions) {
      menu.append(
        new MenuItem({
          label: suggestion,
          click: () => view.webContents.replaceMisspelling(suggestion),
        }),
      );
    }

    if (params.misspelledWord) {
      menu.append(
        new MenuItem({
          label: "Add to dictionary",
          click: () =>
            view.webContents.session.addWordToSpellCheckerDictionary(
              params.misspelledWord,
            ),
        }),
      );
    }

    if (menu.items.length > 0) {
      menu.popup();
    }
  });

  instanceViews.set(key, view);
  hostWindow.contentView.addChildView(view);
  view.setVisible(key === activeUrl());
  view.webContents.loadURL(key);

  return view;
}

/**
 * Show the given instance's view (all others keep running hidden)
 */
export function switchToInstance(url: string) {
  const key = parseInstanceUrl(url)?.toString() ?? url;
  setActiveInstance(key);
  createInstanceView(key);

  for (const [viewUrl, view] of instanceViews) {
    view.setVisible(viewUrl === key);
  }

  layout();
  pushShellState();
  hostWindow.show();
  hostWindow.focus();
}

/**
 * Tear down an instance's view and remove it from the configuration
 */
function removeInstanceEverywhere(url: string) {
  const key = parseInstanceUrl(url)?.toString() ?? url;
  const wasActive = key === activeUrl();

  const view = instanceViews.get(key);
  if (view) {
    hostWindow.contentView.removeChildView(view);
    view.webContents.close();
    instanceViews.delete(key);
  }

  removeInstance(url);

  if (wasActive) {
    switchToInstance(getActiveInstanceUrl().toString());
  } else {
    pushShellState();
  }
}

/**
 * Called after an instance is added (from the Add Instance dialog)
 */
export function onInstanceAdded(instance: Instance) {
  createInstanceView(instance.url);
  switchToInstance(instance.url);
}

/**
 * Size the rail and the active view to the window
 */
function layout() {
  const [width, height] = hostWindow.getContentSize();

  railView.setBounds({ x: 0, y: 0, width: RAIL_WIDTH, height });

  const bounds = {
    x: RAIL_WIDTH,
    y: 0,
    width: Math.max(width - RAIL_WIDTH, 0),
    height,
  };
  for (const view of instanceViews.values()) {
    view.setBounds(bounds);
  }
}

/**
 * Push the current instance list and selection to the rail
 */
export function pushShellState() {
  railView?.webContents.send("shell:state", {
    instances: displayedInstances(),
    activeUrl: activeUrl(),
  });
}

// ---------------------------------------------------------------------------
// IPC (only accepted from the rail itself, never from instance web apps)
// ---------------------------------------------------------------------------

function isFromRail(sender: Electron.WebContents) {
  return railView && sender.id === railView.webContents.id;
}

ipcMain.on("shell:switch", (event, url: string) => {
  if (isFromRail(event.sender)) {
    switchToInstance(url);
  }
});

ipcMain.on("shell:addServer", (event) => {
  if (isFromRail(event.sender)) {
    openInstanceChooser();
  }
});

ipcMain.on("shell:context", (event, url: string) => {
  if (!isFromRail(event.sender)) {
    return;
  }

  const instances = getInstances();
  const isConfigured = instances.some(
    (instance) => parseInstanceUrl(instance.url)?.toString() === url,
  );

  Menu.buildFromTemplate([
    {
      label: "Reload",
      click: () => instanceViews.get(url)?.webContents.reload(),
    },
    { type: "separator" },
    {
      label: "Remove Instance",
      enabled: isConfigured && instances.length > 1,
      click: () => removeInstanceEverywhere(url),
    },
  ]).popup({ window: hostWindow });
});

// ---------------------------------------------------------------------------
// Rail UI
// ---------------------------------------------------------------------------

const railHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: "Segoe UI", system-ui, sans-serif;
        background: #111111;
        height: 100vh;
        overflow: hidden;
        user-select: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 10px 0;
        gap: 8px;
      }
      .group-label {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 1px;
        color: #666;
        text-transform: uppercase;
      }
      .separator {
        width: 32px;
        border-top: 2px solid #333;
        margin: 4px 0;
      }
      .instance, .action {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        font-size: 18px;
        font-weight: 600;
        color: #f0f0f0;
        background: #2b2b2b;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: border-radius .15s, background .15s;
        position: relative;
        flex: none;
      }
      .instance:hover, .action:hover { border-radius: 35%; background: #3a3a3a; }
      .instance.active { border-radius: 35%; background: #ff5733; }
      .instance.local { border: 2px solid #3ba55d; }
      .instance.live { border: 2px solid #5865f2; }
      .instance.active.local, .instance.active.live { border-color: transparent; }
      .action { background: #222; color: #3ba55d; font-size: 26px; }
      .action:hover { background: #3ba55d; color: #fff; }
      .spacer { flex: 1; }
      #list {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        overflow-y: auto;
        overflow-x: hidden;
        width: 100%;
        scrollbar-width: none;
      }
    </style>
  </head>
  <body>
    <div id="list"></div>
    <div class="spacer"></div>
    <button class="action" id="add" title="Add a server…">+</button>
    <script>
      const list = document.getElementById("list");

      function initials(name) {
        return name
          .split(/\\s+/)
          .map((word) => word[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
      }

      function render(state) {
        list.textContent = "";

        const groups = [
          ["live", "Live"],
          ["local", "Local"],
        ];

        let first = true;
        for (const [kind, label] of groups) {
          const members = state.instances.filter((i) => i.kind === kind);
          if (!members.length) continue;

          if (!first) {
            const sep = document.createElement("div");
            sep.className = "separator";
            list.appendChild(sep);
          }
          first = false;

          const heading = document.createElement("div");
          heading.className = "group-label";
          heading.textContent = label;
          list.appendChild(heading);

          for (const instance of members) {
            const button = document.createElement("button");
            button.className = "instance " + kind;
            if (instance.url === state.activeUrl) {
              button.classList.add("active");
            }
            button.title = instance.name + " (" + label + ")";
            button.textContent = initials(instance.name);
            button.addEventListener("click", () =>
              window.stoatShell.switch(instance.url),
            );
            button.addEventListener("contextmenu", (event) => {
              event.preventDefault();
              window.stoatShell.context(instance.url);
            });
            list.appendChild(button);
          }
        }
      }

      window.stoatShell.onState(render);
      document.getElementById("add").addEventListener("click", () =>
        window.stoatShell.addServer(),
      );
    </script>
  </body>
</html>`;
