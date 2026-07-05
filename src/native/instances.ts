import { type JSONSchema } from "json-schema-typed";

import { app } from "electron";
import Store from "electron-store";

/**
 * Whether an instance is a public ("live") server or a locally hosted one
 */
export type InstanceKind = "live" | "local";

/**
 * A Stoat instance the app can connect to
 */
export type Instance = {
  name: string;
  url: string;
  kind: InstanceKind;
};

export const DEFAULT_INSTANCE: Instance = {
  name: "Stoat",
  url: "https://stoat.chat/app",
  kind: "live",
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
        kind: {
          type: "string",
        },
      },
    },
  } as JSONSchema.Array,
  activeInstanceUrl: {
    type: "string",
  } as JSONSchema.String,
  railCollapsed: {
    type: "boolean",
  } as JSONSchema.Boolean,
};

const store = new Store({
  name: "instances",
  schema,
  defaults: {
    instances: [DEFAULT_INSTANCE],
    activeInstanceUrl: DEFAULT_INSTANCE.url,
    railCollapsed: false,
  },
});

const typedStore = store as never as {
  get(k: "instances"): Partial<Instance>[];
  get(k: "activeInstanceUrl"): string;
  get(k: "railCollapsed"): boolean;
  set(k: string, value: unknown): void;
};

export function getRailCollapsed(): boolean {
  return typedStore.get("railCollapsed") ?? false;
}

export function setRailCollapsed(value: boolean) {
  typedStore.set("railCollapsed", value);
}

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

/**
 * Guess whether a URL points at a locally hosted instance
 */
export function inferKind(url: string): InstanceKind {
  const host = parseInstanceUrl(url)?.hostname ?? "";

  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host.endsWith(".local") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return "local";
  }

  return "live";
}

/**
 * All configured instances; entries saved by older builds
 * (without a `kind`) are classified by hostname
 */
export function getInstances(): Instance[] {
  const instances = typedStore.get("instances");
  if (!instances.length) {
    return [DEFAULT_INSTANCE];
  }

  const valid: Instance[] = [];
  for (const instance of instances) {
    const url = instance.url ?? "";
    if (!parseInstanceUrl(url)) {
      continue;
    }

    valid.push({
      name: instance.name || new URL(url).host,
      url,
      kind:
        instance.kind === "live" || instance.kind === "local"
          ? instance.kind
          : inferKind(url),
    });
  }

  return valid.length ? valid : [DEFAULT_INSTANCE];
}

/**
 * URL the main view should show, `--force-server` takes priority
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
 * Add an instance, returns the normalised entry,
 * or undefined if the URL is invalid or already present
 */
export function addInstance(
  name: string,
  url: string,
  kind?: InstanceKind,
): Instance | undefined {
  const parsed = parseInstanceUrl(url);
  if (!parsed) {
    return undefined;
  }

  const instances = getInstances();
  if (instances.some((instance) => instance.url === parsed.toString())) {
    return undefined;
  }

  const instance: Instance = {
    name: name.trim() || parsed.host,
    url: parsed.toString(),
    kind: kind ?? inferKind(url),
  };

  typedStore.set("instances", [...instances, instance]);
  return instance;
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
