import "server-only";
import {
  createCommentForUser,
  createIssueForUser,
  type MutationResult,
  updateIssueForUser,
} from "@/features/api-v1/mutations";
import {
  type ApiIssue,
  getIssueForUser,
  listCommentsForUser,
  listIssuesForUser,
  listLabelsForUser,
  listProjectCustomFieldsForUser,
  listProjectMembersForUser,
  listProjectsForUser,
  listWorkspaceMembersForUser,
} from "@/features/api-v1/queries";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  type BridgeMethod,
  type BridgeResponse,
  STORAGE_LIMITS,
} from "@/lib/plugins/bridge";
import { proxyFetch } from "./proxy";
import type { RunningPlugin } from "./runtime";

// What each host-bridge method does (BARY-145), once `callBridge` has let
// the request through: the plugin is on here, the capability confirmed. The
// person's own permissions are checked by the same `*ForUser` functions the
// REST API uses; what's left here is the place — a project's plugin works in
// its project, a workspace's plugin in the workspace's projects. What it
// writes is the person's, like Jira's `asUser()`: source `APP`, no badge;
// which plugin it was is in the audit log (`plugin.acted`).

type Params = Record<string, unknown>;
type Handler = (
  userId: string,
  plugin: RunningPlugin,
  p: Params,
) => Promise<BridgeResponse>;

const ok = (result: unknown): BridgeResponse => ({ ok: true, result });
const no = (
  error: Extract<BridgeResponse, { ok: false }>["error"],
): BridgeResponse => ({ ok: false, error });

const str = (value: unknown, max = 200) =>
  typeof value === "string" && value.length > 0 && value.length <= max
    ? value
    : undefined;

/** A mutation's answer as the bridge's: 404 stays hidden as not found, 403
 *  is forbidden, 422 a request that doesn't fit. */
const fromMutation = <T>(result: MutationResult<T>): BridgeResponse =>
  result.ok
    ? ok(result.data)
    : no(
        result.status === 404
          ? "not_found"
          : result.status === 403
            ? "forbidden"
            : "invalid_params",
      );

/** A project the plugin may work in: its own, or — for a workspace's
 *  plugin — any of the workspace's. */
async function inPlace(plugin: RunningPlugin, projectId: string) {
  if (plugin.projectId) return projectId === plugin.projectId;
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  return project?.workspaceId === plugin.workspaceId;
}

/** A refusal, as the lookups below hand it back instead of what they
 *  looked for. */
const refused = (value: unknown): value is BridgeResponse =>
  typeof value === "object" && value !== null && "ok" in value;

/** The project a request is about: the one named, else the plugin's own. */
async function projectOf(
  plugin: RunningPlugin,
  p: Params,
): Promise<string | BridgeResponse> {
  const projectId = str(p.projectId) ?? plugin.projectId;
  if (!projectId) return no("invalid_params");
  if (!(await inPlace(plugin, projectId))) return no("forbidden");
  return projectId;
}

/** An issue the plugin may work on: visible to the person and in place. */
async function issueOf(
  userId: string,
  plugin: RunningPlugin,
  id: unknown,
): Promise<ApiIssue | BridgeResponse> {
  const ref = str(id);
  if (!ref) return no("invalid_params");
  const issue = await getIssueForUser(userId, ref);
  if (!issue || !(await inPlace(plugin, issue.project.id)))
    return no("not_found");
  return issue;
}

/** Custom field values need `fields:write` on top of `issues:write`. */
const touchesFields = (plugin: RunningPlugin, p: Params) =>
  p.customFields !== undefined && !plugin.capabilities.includes("fields:write");

const jsonSize = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value) ?? "").length;

export const HANDLERS: Record<BridgeMethod, Handler> = {
  async "issues.list"(userId, plugin, p) {
    const projectId = await projectOf(plugin, p);
    if (refused(projectId)) return projectId;
    const take = Math.min(
      Math.max(Number.isInteger(p.take) ? (p.take as number) : 50, 1),
      100,
    );
    const page = await listIssuesForUser(userId, projectId, {
      q: str(p.q),
      status: str(p.status),
      cursor: str(p.cursor),
      take,
    });
    if (!page) return no("not_found");
    return ok({
      issues: page.rows,
      nextCursor: page.hasMore ? (page.rows.at(-1)?.id ?? null) : null,
    });
  },

  async "issues.get"(userId, plugin, p) {
    const issue = await issueOf(userId, plugin, p.id);
    return refused(issue) ? issue : ok(issue);
  },

  async "issues.create"(userId, plugin, p) {
    const projectId = await projectOf(plugin, p);
    if (refused(projectId)) return projectId;
    if (touchesFields(plugin, p)) return no("capability_not_confirmed");
    const { projectId: _, ...input } = p;
    return fromMutation(
      await createIssueForUser(
        userId,
        projectId,
        input as unknown as Parameters<typeof createIssueForUser>[2],
        "APP",
      ),
    );
  },

  async "issues.update"(userId, plugin, p) {
    const issue = await issueOf(userId, plugin, p.id);
    if (refused(issue)) return issue;
    if (touchesFields(plugin, p)) return no("capability_not_confirmed");
    const { id: _, ...patch } = p;
    return fromMutation(
      await updateIssueForUser(
        userId,
        issue.id,
        patch as Parameters<typeof updateIssueForUser>[2],
      ),
    );
  },

  async "comments.list"(userId, plugin, p) {
    const issue = await issueOf(userId, plugin, p.issueId);
    if (refused(issue)) return issue;
    const comments = await listCommentsForUser(userId, issue.id);
    return comments ? ok(comments) : no("not_found");
  },

  async "comments.create"(userId, plugin, p) {
    const issue = await issueOf(userId, plugin, p.issueId);
    if (refused(issue)) return issue;
    const body = str(p.body, 20_000);
    if (!body) return no("invalid_params");
    return fromMutation(
      await createCommentForUser(
        userId,
        issue.id,
        { body, ...(str(p.parentId) && { parentId: str(p.parentId) }) },
        "APP",
      ),
    );
  },

  async "labels.list"(userId, plugin, p) {
    const labels = await listLabelsForUser(userId, plugin.workspaceId);
    if (!labels) return no("not_found");
    // A project's plugin sees the workspace's labels and its project's.
    const projectId = str(p.projectId) ?? plugin.projectId;
    if (projectId && !(await inPlace(plugin, projectId)))
      return no("forbidden");
    return ok(
      labels.filter(
        (l) =>
          !("projectId" in l) ||
          l.projectId === null ||
          l.projectId === projectId,
      ),
    );
  },

  async "projects.list"(userId, plugin) {
    const projects = await listProjectsForUser(userId, plugin.workspaceId);
    return ok(
      plugin.projectId
        ? projects.filter((project) => project.id === plugin.projectId)
        : projects,
    );
  },

  async "members.list"(userId, plugin, p) {
    if (plugin.projectId || p.projectId !== undefined) {
      const projectId = await projectOf(plugin, p);
      if (refused(projectId)) return projectId;
      const members = await listProjectMembersForUser(userId, projectId);
      return members ? ok(members) : no("not_found");
    }
    const members = await listWorkspaceMembersForUser(
      userId,
      plugin.workspaceId,
    );
    return members ? ok(members) : no("not_found");
  },

  async "fields.list"(userId, plugin, p) {
    const projectId = await projectOf(plugin, p);
    if (refused(projectId)) return projectId;
    const fields = await listProjectCustomFieldsForUser(userId, projectId);
    return fields ? ok(fields) : no("not_found");
  },

  async "storage.get"(_userId, plugin, p) {
    const key = str(p.key, STORAGE_LIMITS.keyLength);
    if (!key) return no("invalid_params");
    const row = await db.pluginStorage.findUnique({
      where: { activationId_key: { activationId: plugin.activationId, key } },
      select: { value: true },
    });
    return ok(row?.value ?? null);
  },

  async "storage.set"(_userId, plugin, p) {
    const key = str(p.key, STORAGE_LIMITS.keyLength);
    if (!key || p.value === undefined) return no("invalid_params");
    const size = jsonSize(p.value);
    if (size > STORAGE_LIMITS.valueBytes) return no("storage_full");
    const where = {
      activationId_key: { activationId: plugin.activationId, key },
    };
    const [others, existing] = await Promise.all([
      db.pluginStorage.aggregate({
        where: { activationId: plugin.activationId, NOT: { key } },
        _sum: { size: true },
        _count: true,
      }),
      db.pluginStorage.findUnique({ where, select: { id: true } }),
    ]);
    if (
      (others._sum.size ?? 0) + size > STORAGE_LIMITS.totalBytes ||
      (!existing && others._count >= STORAGE_LIMITS.keys)
    )
      return no("storage_full");
    const value = p.value as Prisma.InputJsonValue;
    await db.pluginStorage.upsert({
      where,
      create: { activationId: plugin.activationId, key, value, size },
      update: { value, size },
    });
    return ok(null);
  },

  async "storage.delete"(_userId, plugin, p) {
    const key = str(p.key, STORAGE_LIMITS.keyLength);
    if (!key) return no("invalid_params");
    await db.pluginStorage.deleteMany({
      where: { activationId: plugin.activationId, key },
    });
    return ok(null);
  },

  async "storage.list"(_userId, plugin) {
    const rows = await db.pluginStorage.findMany({
      where: { activationId: plugin.activationId },
      select: { key: true },
      orderBy: { key: "asc" },
    });
    return ok(rows.map((r) => r.key));
  },

  async "settings.get"(_userId, plugin) {
    const row = await db.pluginSettings.findUnique({
      where: { activationId: plugin.activationId },
      select: { values: true },
    });
    const stored = (row?.values ?? {}) as Record<string, unknown>;
    // What the form shows: the stored value, else the manifest's default.
    return ok(
      Object.fromEntries(
        (plugin.manifest.contributes.settings ?? []).map((field) => [
          field.key,
          stored[field.key] ?? field.default ?? null,
        ]),
      ),
    );
  },

  "net.fetch": (userId, plugin, p) => proxyFetch(userId, plugin, p),
};
