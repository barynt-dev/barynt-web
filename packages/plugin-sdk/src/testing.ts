import type { Plugin } from "./plugin";
import type {
  ActionResult,
  Badge,
  BadgeIssue,
  BlockData,
  Context,
  Host,
  Method,
  Methods,
} from "./types";

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
  /** Every building block's data the plugin showed, in order. */
  readonly shown: BlockData[];
  /** Every action an issue panel started (`runAction`), in order. */
  readonly started: { actionId: string; choice?: string }[];
  /** Runs one of the plugin's actions, as a menu would. */
  runAction(
    id: string,
    context?: {
      issueId: string | null;
      choice?: string;
      values?: Record<string, string>;
    },
  ): Promise<ActionResult>;
  /** Whether its settings page says it has changes to save — `null` while
   *  it doesn't save with Barynt's button (`registerSettings` `save`). */
  readonly unsavedState: boolean | null;
  /** Presses Barynt's Save button for its settings page. */
  save(): Promise<void>;
  /** Asks the plugin's badges for these issues, as a board would. */
  badges(
    issues: BadgeIssue[],
  ): Record<string, Badge[]> | Promise<Record<string, Badge[]>>;
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
  const shown: TestHost["shown"] = [];
  const started: TestHost["started"] = [];
  let badgeHandler: Parameters<NonNullable<Host["serveBadges"]>>[0] | null =
    null;
  let actionHandler: Parameters<NonNullable<Host["serveActions"]>>[0] | null =
    null;
  let saveHandler: Parameters<NonNullable<Host["serveSave"]>>[0] | null = null;
  let unsavedState: boolean | null = null;
  return {
    calls,
    shown,
    started,
    show: (data) => void shown.push(data),
    serveBadges: (handler) => {
      badgeHandler = handler;
    },
    badges: (issues) => badgeHandler?.(issues) ?? {},
    serveActions: (handler) => {
      actionHandler = handler;
    },
    serveSave: (handler) => {
      saveHandler = handler;
      unsavedState = false;
    },
    startAction: (actionId, context) => {
      started.push({
        actionId,
        ...(context?.choice !== undefined && { choice: context.choice }),
      });
    },
    unsaved: (on) => {
      if (saveHandler) unsavedState = on;
    },
    get unsavedState() {
      return unsavedState;
    },
    save: async () => {
      if (!saveHandler) throw new Error("no save registered");
      await saveHandler();
    },
    runAction: async (id, context = { issueId: null }) => {
      if (!actionHandler) throw new Error("no actions registered");
      return (await actionHandler(id, context)) ?? {};
    },
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
