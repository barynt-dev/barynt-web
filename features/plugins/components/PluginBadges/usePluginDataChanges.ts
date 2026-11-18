"use client";

import { useEffect, useRef } from "react";

/** A plugin's server changed what it keeps on an issue (BARY-225). */
export interface PluginDataChange {
  pluginId: string;
  issueId: string;
}

type Listener = (changes: PluginDataChange[]) => void;

const POLL_INTERVAL_MS = 15_000;

// One poll per workspace, however many boards, lists and panels listen —
// and none while nothing on the page shows a plugin's badges or panels.
// Polled like `useProjectUpdates`, for the same reason (no SSE through the
// tunnel), but applied without a banner: a frame asking again doesn't race
// anything the person is doing.
const polls = new Map<string, { listeners: Set<Listener>; stop: () => void }>();

function startPolling(workspaceId: string, listeners: Set<Listener>) {
  // The server's clock; 0 until the first answer says where to start.
  let since = 0;
  let busy = false;
  let cancelled = false;
  const poll = async () => {
    if (busy) return;
    busy = true;
    try {
      const query = since ? `?since=${since}` : "";
      const response = await fetch(
        `/api/workspaces/${workspaceId}/plugin-data${query}`,
      );
      if (!response.ok) return;
      const body: { at: number; changes: PluginDataChange[] } =
        await response.json();
      if (cancelled) return;
      const first = since === 0;
      since = body.at;
      if (!first && body.changes.length > 0)
        for (const listener of listeners) listener(body.changes);
    } catch {
      // A network hiccup — the next tick tries again.
    } finally {
      busy = false;
    }
  };
  poll();
  const interval = setInterval(poll, POLL_INTERVAL_MS);
  const onVisible = () => {
    if (document.visibilityState === "visible") poll();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    cancelled = true;
    clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/** Calls `onChange` with what plugins' servers changed on issues. */
export function usePluginDataChanges(
  workspaceId: string,
  onChange: (changes: PluginDataChange[]) => void,
): void {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });
  useEffect(() => {
    const listener: Listener = (changes) => latest.current(changes);
    let entry = polls.get(workspaceId);
    if (!entry) {
      const listeners = new Set<Listener>();
      entry = { listeners, stop: startPolling(workspaceId, listeners) };
      polls.set(workspaceId, entry);
    }
    const current = entry;
    current.listeners.add(listener);
    return () => {
      current.listeners.delete(listener);
      if (current.listeners.size === 0) {
        current.stop();
        polls.delete(workspaceId);
      }
    };
  }, [workspaceId]);
}
