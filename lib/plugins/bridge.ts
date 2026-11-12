import type { Capability } from "./manifest";

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

/** The methods a plugin can call, and the capability each needs. A method
 *  missing here doesn't exist. */
export const BRIDGE_METHODS = {
  "issues.list": "issues:read",
  "issues.get": "issues:read",
} as const satisfies Record<string, Capability>;

export type BridgeMethod = keyof typeof BRIDGE_METHODS;

export const isBridgeMethod = (method: unknown): method is BridgeMethod =>
  typeof method === "string" && Object.hasOwn(BRIDGE_METHODS, method);

/** Where a plugin's frame runs: the slot it fills and the place it's in. */
export interface FrameContext {
  slot: { kind: "projectView"; id: string };
  workspaceId: string;
  projectId: string | null;
  locale: string;
}

/** Frame → host, over the private channel. */
export type FrameMessage =
  | { type: "call"; id: number; method: string; params: unknown }
  | { type: "ready" }
  | { type: "error"; message: string };

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
  | "timeout"
  | "too_many_requests";

/** Design tokens a frame gets, so a plugin looks like Barynt — light or
 *  dark, whichever is on. Read from the host page's `:root`. */
export const THEME_TOKENS = [
  "--surface",
  "--surface-container-low",
  "--surface-container",
  "--surface-container-high",
  "--on-surface",
  "--on-surface-variant",
  "--outline",
  "--outline-variant",
  "--primary",
  "--on-primary",
  "--primary-container",
  "--on-primary-container",
  "--error",
  "--warning",
  "--radius",
  "--radius-sm",
  "--text-xs",
  "--text-sm",
  "--text-base",
  "--font-ui",
] as const;

/** A frame message as the host accepts it — anything else is dropped. */
export function parseFrameMessage(data: unknown): FrameMessage | null {
  if (!data || typeof data !== "object") return null;
  const m = data as Record<string, unknown>;
  if (m.type === "ready") return { type: "ready" };
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
