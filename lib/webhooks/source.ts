import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

// Which plugin a change came through (BARY-210). The host bridge runs a
// plugin's request inside `runAsPlugin`; whatever that request changes —
// through the same `*ForUser` functions REST and MCP use — reads it here
// instead of passing it down every call. Outside a plugin's request: null.

export interface EventPlugin {
  id: string;
  name: string;
}

const storage = new AsyncLocalStorage<EventPlugin>();

export function runAsPlugin<T>(plugin: EventPlugin, fn: () => T): T {
  return storage.run(plugin, fn);
}

export function currentPlugin(): EventPlugin | null {
  return storage.getStore() ?? null;
}
