import { Menu, MenuItemConstructorOptions } from "electron";

import { openAddInstanceDialog } from "./instanceDialog";
import {
  getActiveInstanceUrl,
  getInstances,
  removeInstance,
} from "./instances";
import {
  openInstanceWindow,
  openInstanceWindowCount,
  switchInstance,
} from "./instanceWindows";
import { updateTrayMenu } from "./tray";

/**
 * Build the "Instance" tray submenu; designed to be dropped into the
 * tray menu template as a single self-contained entry
 */
export function buildInstanceMenuItem(): MenuItemConstructorOptions {
  const instances = getInstances();
  const activeUrl = getActiveInstanceUrl().toString();

  // the radio bubble marks which instance the main window shows;
  // with several instances open at once that marker is misleading, so hide it
  const showActiveMarker = openInstanceWindowCount() === 0;

  return {
    label: "Instance",
    type: "submenu",
    submenu: Menu.buildFromTemplate([
      ...instances.map(
        (instance): MenuItemConstructorOptions =>
          showActiveMarker
            ? {
                label: instance.name,
                type: "radio",
                checked: new URL(instance.url).toString() === activeUrl,
                click: () => switchInstance(instance.url),
              }
            : {
                label: instance.name,
                type: "normal",
                click: () => switchInstance(instance.url),
              },
      ),
      { type: "separator" },
      {
        label: "Open in New Window",
        type: "submenu",
        submenu: Menu.buildFromTemplate(
          instances.map((instance) => ({
            label: instance.name,
            type: "normal" as const,
            click: () => openInstanceWindow(instance.url),
          })),
        ),
      },
      {
        label: "Remove Instance",
        type: "submenu",
        submenu: Menu.buildFromTemplate(
          instances.map((instance) => ({
            label: instance.name,
            type: "normal" as const,
            enabled: instances.length > 1,
            click() {
              const wasActive =
                new URL(instance.url).toString() === activeUrl;
              removeInstance(instance.url);

              if (wasActive) {
                // fall back to whichever instance is now active
                switchInstance(getActiveInstanceUrl().toString());
              } else {
                updateTrayMenu();
              }
            },
          })),
        ),
      },
      { type: "separator" },
      {
        label: "Add Instance…",
        type: "normal",
        click: () => openAddInstanceDialog(),
      },
    ]),
  };
}
