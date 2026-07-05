import { join } from "node:path";

import { BrowserWindow, app, nativeImage } from "electron";

import windowIconAsset from "../../assets/desktop/icon.png?asset";

import { config } from "./config";
import {
  forgetOpenWindow,
  getOpenWindows,
  isKnownInstanceUrl,
  rememberOpenWindow,
  setActiveInstance,
} from "./instances";
import { updateTrayMenu } from "./tray";
import { mainWindow } from "./window";

// currently open extra instance windows
const instanceWindows = new Set<BrowserWindow>();

// track quitting ourselves so this module stays self-contained
let quitting = false;
app.on("before-quit", () => {
  quitting = true;
});

/**
 * Number of extra instance windows currently open
 */
export function openInstanceWindowCount() {
  return instanceWindows.size;
}

/**
 * Switch the main window over to another instance
 */
export function switchInstance(url: string) {
  setActiveInstance(url);
  mainWindow.loadURL(url);
  mainWindow.show();
  mainWindow.focus();
  updateTrayMenu();
}

/**
 * Open an instance in a separate window, allowing simultaneous
 * connections to multiple instances
 */
export function openInstanceWindow(url: string) {
  const instanceWindow = new BrowserWindow({
    minWidth: 300,
    minHeight: 300,
    width: 1280,
    height: 720,
    backgroundColor: "#191919",
    // native frame: the web app's custom window controls only drive the main window
    frame: true,
    icon: nativeImage.createFromDataURL(windowIconAsset),
    webPreferences: {
      // relative to `.vite/build`
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  instanceWindow.setMenu(null);

  // tell the web app not to render its own window controls in this window
  instanceWindow.webContents.on("did-finish-load", () =>
    instanceWindow.webContents.send("config", {
      ...config.snapshot(),
      customFrame: false,
    }),
  );

  // restore this window on next launch, unless the user closes it;
  // windows closed as part of quitting the app stay remembered
  instanceWindows.add(instanceWindow);
  rememberOpenWindow(url);

  instanceWindow.on("closed", () => {
    instanceWindows.delete(instanceWindow);

    if (!quitting) {
      forgetOpenWindow(url);
      updateTrayMenu();
    }
  });

  instanceWindow.loadURL(url);
  updateTrayMenu();
}

/**
 * Reopen the extra instance windows from the previous session
 */
export function restoreInstanceWindows() {
  getOpenWindows().filter(isKnownInstanceUrl).forEach(openInstanceWindow);
}
