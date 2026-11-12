import "server-only";
import { randomBytes } from "node:crypto";
import { getIssueForUser, listIssuesForUser } from "@/features/api-v1/queries";
import { db } from "@/lib/db";
import { can, canEnterWorkspace } from "@/lib/permissions";
import { activationScopeKey } from "@/lib/plugins/activation";
import {
  BRIDGE_METHODS,
  type BridgeResponse,
  type FrameContext,
  isBridgeMethod,
} from "@/lib/plugins/bridge";
import { buildFrameDocument, frameCsp } from "@/lib/plugins/frame";
import { type PluginManifest, validateManifest } from "@/lib/plugins/manifest";

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
      select: { enabled: true, capabilities: true },
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
    manifest: parsed.manifest,
    capabilities: activation.capabilities,
    workspaceId: place.workspaceId,
    projectId: place.projectId,
  };
}

/** Whether the plugin fills this slot here: the slot in its manifest and
 *  its capability confirmed. */
function fillsSlot(plugin: RunningPlugin, slot: FrameContext["slot"]): boolean {
  if (slot.kind === "projectView")
    return (
      plugin.projectId !== null &&
      plugin.capabilities.includes("ui:project-view") &&
      (plugin.manifest.contributes.projectViews ?? []).some(
        (v) => v.id === slot.id,
      )
    );
  return false;
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
  if (!fillsSlot(plugin, slot)) return null;
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

const MAX_TAKE = 100;

const str = (value: unknown, max = 200) =>
  typeof value === "string" && value.length > 0 && value.length <= max
    ? value
    : undefined;

/**
 * One request over the host bridge, as the person whose page the frame is
 * on. The method must exist, its capability be confirmed in this place,
 * and the data inside the place: a project's plugin sees its project, a
 * workspace's plugin the workspace's projects the person can see.
 */
export async function callBridge(
  userId: string,
  place: PluginPlace,
  method: unknown,
  params: unknown,
): Promise<BridgeResponse> {
  if (!isBridgeMethod(method)) return { ok: false, error: "unknown_method" };
  const plugin = await findRunningPlugin(userId, place);
  if (!plugin) return { ok: false, error: "not_active" };
  if (!plugin.capabilities.includes(BRIDGE_METHODS[method]))
    return { ok: false, error: "capability_not_confirmed" };
  const p = (params && typeof params === "object" ? params : {}) as Record<
    string,
    unknown
  >;

  /** A project this plugin may look into: its own, or — for a workspace's
   *  plugin — any of the workspace's. */
  const inPlace = async (projectId: string) => {
    if (plugin.projectId) return projectId === plugin.projectId;
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    return project?.workspaceId === plugin.workspaceId;
  };

  switch (method) {
    case "issues.list": {
      const projectId = str(p.projectId) ?? plugin.projectId;
      if (!projectId) return { ok: false, error: "invalid_params" };
      if (!(await inPlace(projectId))) return { ok: false, error: "forbidden" };
      const take = Math.min(
        Math.max(Number.isInteger(p.take) ? (p.take as number) : 50, 1),
        MAX_TAKE,
      );
      const page = await listIssuesForUser(userId, projectId, {
        q: str(p.q),
        status: str(p.status),
        cursor: str(p.cursor),
        take,
      });
      if (!page) return { ok: false, error: "not_found" };
      return {
        ok: true,
        result: {
          issues: page.rows,
          nextCursor: page.hasMore ? (page.rows.at(-1)?.id ?? null) : null,
        },
      };
    }
    case "issues.get": {
      const id = str(p.id);
      if (!id) return { ok: false, error: "invalid_params" };
      const issue = await getIssueForUser(userId, id);
      if (!issue || !(await inPlace(issue.project.id)))
        return { ok: false, error: "not_found" };
      return { ok: true, result: issue };
    }
  }
}

/** A project view a plugin contributes, for its page in the project — the
 *  plugin's and the view's names. `null` where it doesn't run for the
 *  logged-in person. */
export async function getProjectPluginView(
  userId: string,
  place: PluginPlace & { projectId: string },
  viewId: string,
): Promise<{ pluginName: string; title: string } | null> {
  const plugin = await findRunningPlugin(userId, place);
  if (!plugin || plugin.manifest.kind !== "sandbox") return null;
  if (!fillsSlot(plugin, { kind: "projectView", id: viewId })) return null;
  const view = plugin.manifest.contributes.projectViews?.find(
    (v) => v.id === viewId,
  );
  return view ? { pluginName: plugin.manifest.name, title: view.title } : null;
}
