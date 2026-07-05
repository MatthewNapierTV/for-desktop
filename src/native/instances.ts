import { type JSONSchema } from "json-schema-typed";

import { app } from "electron";
import Store from "electron-store";

/**
 * A Stoat instance the app can connect to
 */
export type Instance = {
  name: string;
  url: string;
};

export const DEFAULT_INSTANCE: Instance = {
  name: "Stoat",
  url: "https://stoat.chat/app",
};

const schema = {
  instances: {
    type: "array",
    items: {
      type: "object",
      properties: {
        name: {
          type: "string",
        },
        url: {
          type: "string",
        },
      },
    },
  } as JSONSchema.Array,
  activeInstanceUrl: {
    type: "string",
  } as JSONSchema.String,
  openWindows: {
    type: "array",
    items: {
      type: "string",
    },
  } as JSONSchema.Array,
};

const store = new Store({
  name: "instances",
  schema,
  defaults: {
    instances: [DEFAULT_INSTANCE],
    activeInstanceUrl: DEFAULT_INSTANCE.url,
    openWindows: [],
  },
});

const typedStore = store as never as {
  get(k: "instances"): Instance[];
  get(k: "activeInstanceUrl"): string;
  get(k: "openWindows"): string[];
  set(k: string, value: unknown): void;
};

/**
 * Validate and normalise an instance URL, returns undefined if invalid
 */
export function parseInstanceUrl(url: string): URL | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed;
    }
  } catch {
    // fall through
  }

  return undefined;
}

export function getInstances(): Instance[] {
  const instances = typedStore.get("instances");
  return instances.length ? instances : [DEFAULT_INSTANCE];
}

/**
 * URL the app should load, `--force-server` takes priority
 */
export function getActiveInstanceUrl(): URL {
  if (app.commandLine.hasSwitch("force-server")) {
    return new URL(app.commandLine.getSwitchValue("force-server"));
  }

  return (
    parseInstanceUrl(typedStore.get("activeInstanceUrl")) ??
    new URL(DEFAULT_INSTANCE.url)
  );
}

export function setActiveInstance(url: string) {
  typedStore.set("activeInstanceUrl", url);
}

/**
 * Whether the given URL belongs to a configured (or forced) instance
 */
export function isKnownInstanceUrl(url: string): boolean {
  const origin = new URL(url).origin;

  if (getActiveInstanceUrl().origin === origin) {
    return true;
  }

  return getInstances().some(
    (instance) => parseInstanceUrl(instance.url)?.origin === origin,
  );
}

/**
 * Add an instance, returns false if the URL is invalid or already present
 */
export function addInstance(name: string, url: string): boolean {
  const parsed = parseInstanceUrl(url);
  if (!parsed) {
    return false;
  }

  const instances = getInstances();
  if (instances.some((instance) => instance.url === parsed.toString())) {
    return false;
  }

  typedStore.set("instances", [
    ...instances,
    { name: name.trim() || parsed.host, url: parsed.toString() },
  ]);

  return true;
}

/**
 * Extra instance windows to restore on next launch
 */
export function getOpenWindows(): string[] {
  return typedStore.get("openWindows") ?? [];
}

export function rememberOpenWindow(url: string) {
  const open = getOpenWindows();
  if (!open.includes(url)) {
    typedStore.set("openWindows", [...open, url]);
  }
}

export function forgetOpenWindow(url: string) {
  typedStore.set(
    "openWindows",
    getOpenWindows().filter((openUrl) => openUrl !== url),
  );
}

/**
 * Remove an instance, keeping at least one and reassigning the
 * active instance if it was removed
 */
export function removeInstance(url: string) {
  const remaining = getInstances().filter((instance) => instance.url !== url);
  if (!remaining.length) {
    remaining.push(DEFAULT_INSTANCE);
  }

  typedStore.set("instances", remaining);

  if (typedStore.get("activeInstanceUrl") === url) {
    typedStore.set("activeInstanceUrl", remaining[0].url);
  }
}
