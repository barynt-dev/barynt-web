"use client";

import { useEffect, useState } from "react";
import {
  type PluginResult,
  previewRelease,
  type ReleasePreview,
} from "@/features/plugins/actions";

// A release as `previewRelease` loads and checks it — for a plugin that isn't
// installed (its screenshots and capabilities) and for an update (what it
// will ask for). Kept per page visit: switching tabs back and forth doesn't
// load it again.

type Result = PluginResult<{ preview: ReleasePreview }>;
const loaded = new Map<string, Promise<Result>>();

export type ReleaseState =
  | { status: "idle" | "loading" }
  | { status: "ready"; preview: ReleasePreview }
  | { status: "error"; error: string };

/** `version` of `pluginId` from `sourceId`; nothing while any is missing. */
export function useRelease(
  sourceId: string | null,
  pluginId: string,
  version: string | null,
): ReleaseState {
  const key = sourceId && version ? `${sourceId}/${pluginId}@${version}` : "";
  const [state, setState] = useState<{ key: string; value: ReleaseState }>({
    key: "",
    value: { status: "idle" },
  });

  useEffect(() => {
    if (!sourceId || !version) return;
    let live = true;
    let request = loaded.get(key);
    if (!request) {
      request = previewRelease({ sourceId, pluginId, version });
      loaded.set(key, request);
    }
    request.then((result) => {
      if (!live) return;
      if ("error" in result) loaded.delete(key);
      setState({
        key,
        value:
          "error" in result
            ? { status: "error", error: result.error }
            : { status: "ready", preview: result.preview },
      });
    });
    return () => {
      live = false;
    };
  }, [key, sourceId, pluginId, version]);

  if (!key) return { status: "idle" };
  return state.key === key ? state.value : { status: "loading" };
}
