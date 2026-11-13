import type { Plugin } from "./plugin";
import type { Context, Host, Method, Methods } from "./types";

// Testing a plugin without Barynt: a host that answers from your handlers
// and records every call.

type Handlers = {
  [M in Method]?: (
    params: Methods[M][0],
  ) => Methods[M][1] | Promise<Methods[M][1]>;
};

export interface TestHost extends Host {
  /** Every request the plugin made, in order. */
  readonly calls: { method: string; params: unknown }[];
}

/**
 * A host for tests. A method without a handler is refused with
 * `capability_not_confirmed`, as Barynt refuses what wasn't confirmed; a
 * handler that throws `new Error("not_found")` refuses with that code.
 */
export function createTestHost(
  options: {
    handlers?: Handlers;
    context?: Partial<Context>;
    root?: HTMLElement;
  } = {},
): TestHost {
  const calls: TestHost["calls"] = [];
  return {
    calls,
    context: {
      slot: { kind: "projectView", id: "main" },
      workspaceId: "workspace",
      projectId: "project",
      locale: "en",
      ...options.context,
    },
    root:
      options.root ??
      (typeof document !== "undefined"
        ? document.createElement("div")
        : ({} as HTMLElement)),
    async call(method, params) {
      calls.push({ method, params });
      const handler = options.handlers?.[method as Method] as
        | ((p: unknown) => unknown)
        | undefined;
      if (!handler) throw new Error("capability_not_confirmed");
      return handler(params);
    },
  };
}

/** Starts a plugin on a test host: creates it, runs `onload()`, waits for
 *  its views to render (`whenRendered`) — so a view's error fails the test —
 *  and hands back the plugin, the host and a way to unload it. */
export async function loadPlugin<P extends Plugin>(
  PluginClass: new (host: Host) => P,
  host: TestHost = createTestHost(),
) {
  const plugin = new PluginClass(host);
  await plugin.onload();
  await plugin.whenRendered();
  return { plugin, host, unload: () => plugin.onunload() };
}
