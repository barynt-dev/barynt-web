import type { BadgeIssue } from "./badges";
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
  // What its server keeps on issues (BARY-216); `issueIds` for a whole
  // board at once.
  "issueData.list": "issues:read",
  // Its frames keeping entries too (BARY-238) — what it changed itself
  // and GitHub, say, doesn't report back to it.
  "issueData.set": "issues:write",
  "issueData.delete": "issues:write",
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
    kind:
      | "projectView"
      | "page"
      | "widget"
      | "block"
      | "issuePanel"
      | "badges"
      | "actions"
      | "settings";
    id: string;
  };
  /** The issue an issue panel is about (BARY-150). */
  issueId?: string;
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
  | { type: "blockData"; data: BlockData }
  /** How tall its content is, in CSS pixels — a panel grows to fit
   *  (BARY-150). */
  | { type: "resize"; height: number }
  /** Its answer to a batch of issues: chips by issue id, checked by the
   *  host (`parseBadges`, BARY-151). */
  | { type: "badges"; seq: number; badges: unknown }
  /** How an action went (BARY-152): its answer, or the error it threw. */
  | { type: "actionDone"; seq: number; ok: boolean; result: unknown }
  /** Its settings page has changes to save — or none any more. The first
   *  one says it saves at all: Barynt's Save button then covers it. */
  | { type: "unsaved"; unsaved: boolean }
  /** How saving its settings page went: done, or the error it threw. */
  | { type: "saveDone"; seq: number; ok: boolean; error?: string }
  /** An issue panel starts one of its plugin's actions for its issue
   *  (BARY-238) — as if it were picked from the issue's menu. */
  | { type: "runAction"; actionId: string; choice?: string }
  /** A message for Barynt's own toast (BARY-238). */
  | { type: "toast"; text: string }
  /** Its own settings page, on a level: what's the person's, the frame's
   *  project's or the workspace's (BARY-238). */
  | { type: "openSettings"; level: "personal" | "project" | "workspace" }
  /** A click in the frame while its menu is open: close it — Barynt
   *  doesn't see clicks in there. */
  | { type: "menu:close" }
  /** A menu for Barynt to draw at `anchor` (the button, in the frame's
   *  coordinates) — a frame is too small for one (BARY-238). */
  | {
      type: "menu";
      id: number;
      items: FrameMenuItem[];
      anchor: { x: number; y: number; width: number; height: number };
    };

/** An entry of a frame's menu. */
export interface FrameMenuItem {
  id: string;
  label: string;
  /** A bundled icon (`lucide:…`). */
  icon?: string;
  danger?: boolean;
}

/** Host → frame. */
export type HostMessage =
  | { type: "result"; id: number; ok: true; result: unknown }
  | { type: "result"; id: number; ok: false; error: string }
  | { type: "theme"; theme: Record<string, string> }
  /** A batch of issues to put badges on (BARY-151). */
  | { type: "badges:request"; seq: number; issues: BadgeIssue[] }
  /** Run one of its actions, for an issue (BARY-152). */
  | {
      type: "action:run";
      seq: number;
      actionId: string;
      issueId: string | null;
      /** What was picked, when the action asked (`pick`). */
      choice?: string;
      /** What was filled in, when the action asked (`form`). */
      values?: Record<string, string>;
    }
  /** Save its settings page: Barynt's Save button was pressed. */
  | { type: "settings:save"; seq: number }
  /** What was picked from its menu — `null`: closed without. */
  | { type: "menu:pick"; id: number; itemId: string | null };

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
  if (m.type === "actionDone")
    return Number.isSafeInteger(m.seq)
      ? {
          type: "actionDone",
          seq: m.seq as number,
          ok: m.ok === true,
          result:
            m.ok === true ? m.result : String(m.result ?? "").slice(0, 300),
        }
      : null;
  if (m.type === "unsaved")
    return { type: "unsaved", unsaved: m.unsaved === true };
  if (m.type === "saveDone")
    return Number.isSafeInteger(m.seq)
      ? {
          type: "saveDone",
          seq: m.seq as number,
          ok: m.ok === true,
          ...(m.ok !== true && {
            error: String(m.error ?? "").slice(0, 300),
          }),
        }
      : null;
  if (m.type === "badges")
    return Number.isSafeInteger(m.seq)
      ? { type: "badges", seq: m.seq as number, badges: m.badges }
      : null;
  if (m.type === "resize")
    return typeof m.height === "number" && Number.isFinite(m.height)
      ? { type: "resize", height: Math.max(0, Math.min(m.height, 100_000)) }
      : null;
  if (m.type === "blockData") {
    const data = parseBlockData(m.data);
    return data ? { type: "blockData", data } : null;
  }
  if (m.type === "error")
    return { type: "error", message: String(m.message ?? "").slice(0, 500) };
  if (m.type === "menu:close") return { type: "menu:close" };
  if (m.type === "openSettings")
    return m.level === "personal" ||
      m.level === "project" ||
      m.level === "workspace"
      ? { type: "openSettings", level: m.level }
      : null;
  if (m.type === "toast")
    return typeof m.text === "string" && m.text.trim()
      ? { type: "toast", text: m.text.trim().slice(0, 120) }
      : null;
  if (m.type === "menu") {
    const a = (m.anchor ?? {}) as Record<string, unknown>;
    const n = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? v : null;
    const anchor = {
      x: n(a.x),
      y: n(a.y),
      width: n(a.width),
      height: n(a.height),
    };
    if (!Number.isSafeInteger(m.id) || Object.values(anchor).includes(null))
      return null;
    const items = (Array.isArray(m.items) ? m.items : [])
      .slice(0, 12)
      .flatMap((i: unknown): FrameMenuItem[] => {
        if (!i || typeof i !== "object") return [];
        const x = i as Record<string, unknown>;
        if (typeof x.id !== "string" || typeof x.label !== "string") return [];
        const label = x.label.trim().slice(0, 80);
        if (!x.id || x.id.length > 100 || !label) return [];
        return [
          {
            id: x.id,
            label,
            ...(typeof x.icon === "string" && { icon: x.icon }),
            ...(x.danger === true && { danger: true }),
          },
        ];
      });
    return items.length > 0
      ? {
          type: "menu",
          id: m.id as number,
          items,
          anchor: anchor as {
            x: number;
            y: number;
            width: number;
            height: number;
          },
        }
      : null;
  }
  if (m.type === "runAction")
    return typeof m.actionId === "string" &&
      /^[a-z][a-z0-9-]{0,39}$/.test(m.actionId)
      ? {
          type: "runAction",
          actionId: m.actionId,
          ...(typeof m.choice === "string" &&
            m.choice.length <= 200 && { choice: m.choice }),
        }
      : null;
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
