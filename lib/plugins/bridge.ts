import {
  type BlockData,
  type BlockSettingValues,
  parseBlockData,
} from "./blocks";
import type { Capability } from "./manifest";
import { HOST_TOKENS } from "./tokens";

// The host bridge's protocol (BARY-144): what a sandboxed plugin may ask its
// host for, and which confirmed capability each request needs. Shared by the
// frame's runtime, the host component and the server endpoint, so the three
// can't drift. No dependencies — it runs everywhere.

/** How long a request may take before either side gives up. */
export const BRIDGE_TIMEOUT_MS = 15_000;

/** How many requests a frame may have open at once. */
export const BRIDGE_MAX_PENDING = 20;

/** How long a frame may take from loading to `ready`. */
export const FRAME_READY_TIMEOUT_MS = 10_000;

/** The methods a plugin can call, and the capability each needs — `null`
 *  for its own settings, which need none. A method missing here doesn't
 *  exist. */
export const BRIDGE_METHODS = {
  "issues.list": "issues:read",
  "issues.get": "issues:read",
  "issues.create": "issues:write",
  "issues.update": "issues:write",
  "comments.list": "comments:read",
  "comments.create": "comments:write",
  "labels.list": "labels:read",
  "projects.list": "projects:read",
  "members.list": "members:read",
  "fields.list": "fields:read",
  "storage.get": "storage:own",
  "storage.set": "storage:own",
  "storage.delete": "storage:own",
  "storage.list": "storage:own",
  "settings.get": null,
  // Its own settings page saving (BARY-149) — needs `plugin.enable` there,
  // checked against the manifest's `settings`.
  "settings.set": null,
  // A host from the manifest's `network`, through Barynt (BARY-147) — the
  // hosts were confirmed with the plugin, no capability on top.
  "net.fetch": null,
} as const satisfies Record<string, Capability | null>;

export type BridgeMethod = keyof typeof BRIDGE_METHODS;

/** The methods that change something in someone's name — each lands in the
 *  audit log with the plugin and the person (BARY-145). */
export const WRITE_METHODS: readonly BridgeMethod[] = [
  "issues.create",
  "issues.update",
  "comments.create",
];

/** Requests a plugin may make per person and minute. */
export const BRIDGE_RATE_LIMIT = 300;

/** A plugin's own storage, per place it's on in (`storage:own`). */
export const STORAGE_LIMITS = {
  keyLength: 128,
  /** One value, as JSON. */
  valueBytes: 64 * 1024,
  keys: 500,
  /** All values together, as JSON. */
  totalBytes: 1024 * 1024,
} as const;

export const isBridgeMethod = (method: unknown): method is BridgeMethod =>
  typeof method === "string" && Object.hasOwn(BRIDGE_METHODS, method);

/** Where a plugin's frame runs: the slot it fills (`lib/plugins/slots.ts`)
 *  and the place it's in. */
export interface FrameContext {
  slot: {
    kind: "projectView" | "page" | "widget" | "block" | "settings";
    id: string;
  };
  workspaceId: string;
  projectId: string | null;
  locale: string;
  /** A building block's own settings, as the widget's builder set them
   *  (BARY-205). */
  config?: BlockSettingValues;
}

/** Frame → host, over the private channel. */
export type FrameMessage =
  | { type: "call"; id: number; method: string; params: unknown }
  | { type: "ready" }
  | { type: "error"; message: string }
  /** A building block's data, for Barynt to draw (BARY-205). */
  | { type: "blockData"; data: BlockData };

/** Host → frame. */
export type HostMessage =
  | { type: "result"; id: number; ok: true; result: unknown }
  | { type: "result"; id: number; ok: false; error: string }
  | { type: "theme"; theme: Record<string, string> };

/** The first message, posted to the frame's window with the channel's port. */
export interface InitMessage {
  type: "barynt:init";
  context: FrameContext;
  theme: Record<string, string>;
}

/** What the server answers a bridge request with. */
export type BridgeResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: BridgeError };

/** Why a bridge request was refused — the plugin sees this code. */
export type BridgeError =
  | "unknown_method"
  | "invalid_params"
  | "not_active"
  | "capability_not_confirmed"
  | "forbidden"
  | "not_found"
  | "storage_full"
  | "host_not_allowed"
  | "credential_missing"
  | "upstream_failed"
  | "timeout"
  | "too_many_requests";

/** The host's variables a frame gets, light or dark as the page has them —
 *  what its design tokens (`--barynt-*`, `lib/plugins/tokens.ts`) point at. */
export const THEME_TOKENS = HOST_TOKENS;

/** A frame message as the host accepts it — anything else is dropped. */
export function parseFrameMessage(data: unknown): FrameMessage | null {
  if (!data || typeof data !== "object") return null;
  const m = data as Record<string, unknown>;
  if (m.type === "ready") return { type: "ready" };
  if (m.type === "blockData") {
    const data = parseBlockData(m.data);
    return data ? { type: "blockData", data } : null;
  }
  if (m.type === "error")
    return { type: "error", message: String(m.message ?? "").slice(0, 500) };
  if (
    m.type === "call" &&
    Number.isSafeInteger(m.id) &&
    typeof m.method === "string" &&
    m.method.length <= 64
  )
    return {
      type: "call",
      id: m.id as number,
      method: m.method,
      params: m.params ?? {},
    };
  return null;
}
