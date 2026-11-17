import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { accessibleProjectIds } from "@/lib/permissions";

// What a plugin keeps on issues (BARY-216): entries its server writes over
// the REST API, read back by its frames to show them — a merge request's
// state, a build, whatever the plugin is about. Barynt only stores them;
// what they mean is the plugin's.

/** A value's size, at most. */
export const ISSUE_DATA_MAX_BYTES = 16 * 1024;
/** Issues one request asks for, at most — a board's batch. */
export const ISSUE_DATA_BATCH = 200;

/**
 * What a plugin knows about these issues, for someone who may see them —
 * from any of its activations in the workspace, since a workspace's plugin
 * runs in its projects too. Grouped by issue.
 */
export async function readIssueData(
  userId: string,
  pluginId: string,
  workspaceId: string,
  issueIds: string[],
  /** A project's plugin reads its project only. */
  projectId: string | null = null,
): Promise<Record<string, { key: string; value: unknown; updatedAt: Date }[]>> {
  const ids = [...new Set(issueIds)].slice(0, ISSUE_DATA_BATCH);
  if (ids.length === 0) return {};
  const visible = [...(await accessibleProjectIds(userId, workspaceId))].filter(
    (id) => !projectId || id === projectId,
  );
  const rows = await db.pluginIssueData.findMany({
    where: {
      issueId: { in: ids },
      activation: { pluginId, workspaceId },
      issue: { projectId: { in: visible } },
    },
    orderBy: { updatedAt: "desc" },
    select: { issueId: true, key: true, value: true, updatedAt: true },
  });
  const out: Record<
    string,
    { key: string; value: unknown; updatedAt: Date }[]
  > = {};
  for (const row of rows) {
    const entry = { key: row.key, value: row.value, updatedAt: row.updatedAt };
    if (out[row.issueId]) out[row.issueId].push(entry);
    else out[row.issueId] = [entry];
  }
  return out;
}

/** A plugin's server writing what it knows about an issue (REST API). */
export async function writeIssueData(
  activationId: string,
  issueId: string,
  key: string,
  value: unknown,
): Promise<"ok" | "too_large" | "bad_key"> {
  if (!/^[A-Za-z0-9_.:-]{1,100}$/.test(key)) return "bad_key";
  if (
    new TextEncoder().encode(JSON.stringify(value) ?? "").length >
    ISSUE_DATA_MAX_BYTES
  )
    return "too_large";
  await db.pluginIssueData.upsert({
    where: { activationId_issueId_key: { activationId, issueId, key } },
    create: {
      activationId,
      issueId,
      key,
      value: value as Prisma.InputJsonValue,
    },
    update: { value: value as Prisma.InputJsonValue },
  });
  return "ok";
}

/** A plugin's server removing an entry (REST API). */
export async function deleteIssueData(
  activationId: string,
  issueId: string,
  key: string,
) {
  await db.pluginIssueData.deleteMany({
    where: { activationId, issueId, key },
  });
}
