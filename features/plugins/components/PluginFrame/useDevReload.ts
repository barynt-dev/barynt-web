"use client";

import { useEffect, useRef } from "react";

const POLL_INTERVAL_MS = 2_000;

type Listener = (changed: Set<string>) => void;

// Plugins in development (BARY-221): one poll for the page, however many
// frames listen, comparing each dev plugin's fingerprint with the last one
// seen. In a production build this is never started; without
// `PLUGIN_DEV_DIRS` the server answers 404 and it stops.
const listeners = new Set<Listener>();
let stop: (() => void) | null = null;

function startPolling() {
  let seen: Record<string, string | null> | null = null;
  let timer = 0;
  let stopped = false;
  const poll = async () => {
    try {
      const response = await fetch("/api/plugins/dev");
      if (response.status === 404) {
        stopped = true;
        return;
      }
      if (!response.ok) return;
      const now: Record<string, string | null> = await response.json();
      const changed = new Set(
        Object.keys(now).filter(
          (id) => seen !== null && id in seen && seen[id] !== now[id],
        ),
      );
      seen = now;
      if (changed.size > 0) for (const listener of listeners) listener(changed);
    } catch {
      // The dev server restarting — the next tick tries again.
    } finally {
      if (!stopped) timer = window.setTimeout(poll, POLL_INTERVAL_MS);
    }
  };
  poll();
  return () => {
    stopped = true;
    window.clearTimeout(timer);
  };
}

/** Calls `onChange` when the plugin's files in development change. */
export function useDevReload(pluginId: string, onChange: () => void): void {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const listener: Listener = (changed) => {
      if (changed.has(pluginId)) latest.current();
    };
    listeners.add(listener);
    stop ??= startPolling();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        stop?.();
        stop = null;
      }
    };
  }, [pluginId]);
}
