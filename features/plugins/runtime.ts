import "server-only";
import { randomBytes } from "node:crypto";
import { countRequest } from "@/lib/api/rateLimit";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { can, canEnterWorkspace } from "@/lib/permissions";
import { activationScopeKey } from "@/lib/plugins/activation";
import {
  BRIDGE_METHODS,
  BRIDGE_RATE_LIMIT,
  type BridgeResponse,
  type FrameContext,
  isBridgeMethod,
  WRITE_METHODS,
} from "@/lib/plugins/bridge";
import { buildFrameDocument, frameCsp } from "@/lib/plugins/frame";
import { type PluginManifest, validateManifest } from "@/lib/plugins/manifest";
import { slotEntries } from "@/lib/plugins/slots";
import { HANDLERS } from "./bridge-methods";

// Running a sandboxed plugin (BARY-144): which plugin may run where for
// whom, the document its frame loads, and what its requests over the host
// bridge do. Every request is checked here, never only in the browser: the
// plugin must be on in that place, the capability confirmed there, and the
// person allowed to do it themselves — a plugin can never do more than the
// person whose session it runs in.

/** A plugin switched on in a place the person can see, with what was
 *  confirmed for it there. */
export interface RunningPlugin {
  pluginId: string;
  rowId: string;
  /** Its activation here — what its storage and settings hang off. */
  activationId: string;
  manifest: PluginManifest;
  /** The capabilities confirmed in this place — what counts, not the
   *  manifest's. */
  capabilities: string[];
  workspaceId: string;
  projectId: string | null;
}

export interface PluginPlace {
  pluginId: string;
  workspaceId: string;
  projectId: string | null;
}

/**
 * The plugin, if it runs in this place for this person: switched on there,
 * its installed version active (not blocked), and the place visible to
 * them. A project's workspace comes from the project, never from the
 * caller. `null` in every other case — the callers answer the same either
 * way, so nothing tells a plugin or a person more than they may know.
 */
export async function findRunningPlugin(
  userId: string,
  place: PluginPlace,
): Promise<RunningPlugin | null> {
  if (place.projectId) {
    const project = await db.project.findUnique({
      where: { id: place.projectId },
      select: { workspaceId: true },
    });
    if (!project || project.workspaceId !== place.workspaceId) return null;
    if (!(await can(userId, "project.view", { projectId: place.projectId })))
      return null;
  } else if (!(await canEnterWorkspace(userId, place.workspaceId))) {
    return null;
  }

  const [activation, row] = await Promise.all([
    db.pluginActivation.findUnique({
      where: {
        pluginId_scopeKey: {
          pluginId: place.pluginId,
          scopeKey: activationScopeKey(place),
        },
      },
      select: { id: true, enabled: true, capabilities: true },
    }),
    db.plugin.findFirst({
      where: { pluginId: place.pluginId, status: "active" },
      select: { id: true, manifest: true },
    }),
  ]);
  if (!activation?.enabled || !row) return null;
  const parsed = validateManifest(row.manifest);
  if (!parsed.ok) return null;
  return {
    pluginId: place.pluginId,
    rowId: row.id,
    activationId: activation.id,
    manifest: parsed.manifest,
    capabilities: activation.capabilities,
    workspaceId: place.workspaceId,
    projectId: place.projectId,
  };
}

/** What the plugin fills in this slot here: the entry from its manifest,
 *  with its capability confirmed (`lib/plugins/slots.ts`). */
function slotEntry(plugin: RunningPlugin, slot: FrameContext["slot"]) {
  return (
    slotEntries(plugin.manifest, plugin.capabilities).find(
      (e) => e.kind === slot.kind && e.id === slot.id,
    ) ?? null
  );
}

/** The frame document of a sandboxed plugin in a slot, with its CSP —
 *  `null` where it doesn't run, or has no code. */
export async function getPluginFrame(
  userId: string,
  place: PluginPlace,
  slot: FrameContext["slot"],
): Promise<{ html: string; csp: string } | null> {
  const plugin = await findRunningPlugin(userId, place);
  if (!plugin || plugin.manifest.kind !== "sandbox") return null;
  if (!slotEntry(plugin, slot)) return null;
  const files = await db.pluginFile.findMany({
    where: {
      pluginRowId: plugin.rowId,
      name: { in: ["main.js", "styles.css"] },
    },
    select: { name: true, content: true },
  });
  const text = (name: string) => {
    const file = files.find((f) => f.name === name);
    return file ? new TextDecoder().decode(file.content) : null;
  };
  const code = text("main.js");
  if (code === null) return null;
  const nonce = randomBytes(16).toString("base64");
  return {
    html: buildFrameDocument({
      code,
      css: text("styles.css"),
      nonce,
      title: plugin.manifest.name,
    }),
    csp: frameCsp(nonce),
  };
}

/**
 * One request over the host bridge, as the person whose page the frame is
 * on. The method must exist, the person stay within the plugin's budget
 * (`BRIDGE_RATE_LIMIT` a minute), and the method's capability be confirmed
 * in this place; what it does is in `bridge-methods.ts`. A change made in
 * someone's name lands in the audit log with the plugin and the person.
 */
export async function callBridge(
  userId: string,
  place: PluginPlace,
  method: unknown,
  params: unknown,
): Promise<BridgeResponse> {
  if (!isBridgeMethod(method)) return { ok: false, error: "unknown_method" };
  const budget = await countRequest(
    `ratelimit:plugin:${place.pluginId}:${userId}`,
    BRIDGE_RATE_LIMIT,
  );
  if (!budget.ok) return { ok: false, error: "too_many_requests" };
  const plugin = await findRunningPlugin(userId, place);
  if (!plugin) return { ok: false, error: "not_active" };
  const needs = BRIDGE_METHODS[method];
  if (needs !== null && !plugin.capabilities.includes(needs))
    return { ok: false, error: "capability_not_confirmed" };

  const p = (
    params && typeof params === "object" && !Array.isArray(params) ? params : {}
  ) as Record<string, unknown>;
  const result = await HANDLERS[method](userId, plugin, p);

  if (result.ok && WRITE_METHODS.includes(method)) {
    const target = result.result as { id?: unknown; ref?: unknown } | null;
    await recordAudit({
      action: "plugin.acted",
      actorId: userId,
      target: {
        type: "plugin",
        id: plugin.pluginId,
        label: plugin.manifest.name,
      },
      workspaceId: plugin.workspaceId,
      projectId: plugin.projectId,
      meta: {
        method,
        ...(typeof target?.ref === "string" && { ref: target.ref }),
        ...(typeof target?.id === "string" && { id: target.id }),
        ...(typeof p.id === "string" && { id: p.id }),
        ...(typeof p.issueId === "string" && { issueId: p.issueId }),
      },
    });
  }
  return result;
}

/** A slot a plugin fills, for its page — the plugin's name and the
 *  entry's title. `null` where it doesn't run for this person. */
export async function getPluginSlotView(
  userId: string,
  place: PluginPlace,
  slot: FrameContext["slot"],
): Promise<{ pluginName: string; title: string } | null> {
  const plugin = await findRunningPlugin(userId, place);
  if (!plugin) return null;
  const entry = slotEntry(plugin, slot);
  return entry
    ? { pluginName: plugin.manifest.name, title: entry.title }
    : null;
}
