import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { AppScope } from "@/lib/plugins/app-access";

// Which plugin a change came through (BARY-210). The host bridge runs a
// plugin's request inside `runAsPlugin`; whatever that request changes —
// through the same `*ForUser` functions REST and MCP use — reads it here
// instead of passing it down every call. Outside a plugin's request: null.
//
// A token a plugin's server uses to act for a person (BARY-214) enters the
// same store from `resolveApiUser` — and with it the frame the person's
// rights are cut down to (`lib/permissions.ts`): what the person may, and
// the plugin too.

export interface EventPlugin {
  id: string;
  name: string;
}

interface Source {
  plugin: EventPlugin | null;
  /** Set for a token acting for a person: the plugin's own frame. */
  acting?: AppScope;
}

const storage = new AsyncLocalStorage<Source>();

export function runAsPlugin<T>(plugin: EventPlugin, fn: () => T): T {
  return storage.run({ plugin }, fn);
}

export function currentPlugin(): EventPlugin | null {
  return storage.getStore()?.plugin ?? null;
}

/** The frame a person's rights are cut down to while a plugin acts for
 *  them — `undefined` otherwise. */
export function actingScope(): AppScope | undefined {
  return storage.getStore()?.acting;
}

/**
 * Starts acting for a person, for the rest of the request — called by
 * `resolveApiUser` **before** its first `await`, so the route that awaited
 * it carries the store on. What it is comes once the token is looked up
 * (`fill`); until then nothing is granted on its behalf.
 */
export function enterActing(): (plugin: EventPlugin, scope: AppScope) => void {
  const source: Source = {
    plugin: null,
    // Nothing until the token is known — a frame that holds no project.
    acting: { workspaceId: "", projectId: "", capabilities: [] },
  };
  storage.enterWith(source);
  return (plugin, scope) => {
    source.plugin = plugin;
    source.acting = scope;
  };
}
