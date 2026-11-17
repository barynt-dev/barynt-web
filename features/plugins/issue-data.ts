import "server-only";
import {
  createCommentForUser,
  updateIssueForUser,
} from "@/features/api-v1/mutations";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { accessibleProjectIds } from "@/lib/permissions";
import type { InboundProvider } from "@/lib/plugins/inbound";
import {
  findIssueRefs,
  LINK_RULES,
  type LinkFinding,
  type LinkRule,
  readLinkFindings,
  ruleAction,
} from "@/lib/plugins/link";

// What a plugin knows about issues (BARY-216): entries a `link` hook files
// from GitLab or GitHub, or its server writes over the REST API — and the
// rules that act on them, as the plugin's app.

/** A value's size, at most. */
export const ISSUE_DATA_MAX_BYTES = 16 * 1024;
/** Entries one request asks for, at most — a board's batch. */
export const ISSUE_DATA_BATCH = 200;

interface Activation {
  id: string;
  workspaceId: string;
  projectId: string | null;
  botUserId: string | null;
}

/** The projects a plugin's activation files under: its project, or the
 *  workspace's public ones — like its app may see (BARY-213). */
async function filingProjects(activation: Activation) {
  return db.project.findMany({
    where: {
      workspaceId: activation.workspaceId,
      ...(activation.projectId
        ? { id: activation.projectId }
        : { visibility: "public" }),
    },
    select: { id: true, prefix: true },
  });
}

/**
 * Files a `link` hook's call under the issues it names, then runs the
 * rules switched on for the hook. Returns how many issues it reached.
 */
export async function fileLink(
  activation: Activation,
  hook: { provider: InboundProvider; rules: string[] },
  event: string,
  body: unknown,
): Promise<number> {
  const findings = readLinkFindings(hook.provider, event, body);
  if (findings.length === 0) return 0;
  const projects = await filingProjects(activation);
  const byPrefix = new Map(projects.map((p) => [p.prefix.toUpperCase(), p.id]));
  const reached = new Set<string>();

  for (const finding of findings) {
    const refs = findIssueRefs(finding.texts, [...byPrefix.keys()]);
    for (const ref of refs) {
      const projectId = byPrefix.get(ref.prefix.toUpperCase());
      if (!projectId) continue;
      const issue = await db.issue.findFirst({
        where: { projectId, key: ref.key },
        select: { id: true, status: true },
      });
      if (!issue) continue;
      reached.add(issue.id);
      await db.pluginIssueData.upsert({
        where: {
          activationId_issueId_key: {
            activationId: activation.id,
            issueId: issue.id,
            key: finding.record.key,
          },
        },
        create: {
          activationId: activation.id,
          issueId: issue.id,
          key: finding.record.key,
          value: finding.record as unknown as Prisma.InputJsonValue,
        },
        update: { value: finding.record as unknown as Prisma.InputJsonValue },
      });
      await runRules(activation, hook.rules, finding, issue);
    }
  }
  return reached.size;
}

/** The rules switched on for a hook, for one issue — as the plugin's app,
 *  through the same functions as the REST API (rights, audit, events). */
async function runRules(
  activation: Activation,
  rules: string[],
  finding: LinkFinding,
  issue: { id: string; status: string },
) {
  if (!activation.botUserId) return;
  for (const rule of rules) {
    if (!(LINK_RULES as readonly string[]).includes(rule)) continue;
    const action = ruleAction(rule as LinkRule, finding);
    if (action === "complete") {
      const done = await completedStatus(activation.workspaceId);
      if (done && issue.status !== done)
        await updateIssueForUser(activation.botUserId, issue.id, {
          status: done,
        });
    }
    if (action === "comment") {
      const r = finding.record;
      await createCommentForUser(
        activation.botUserId,
        issue.id,
        {
          body: `Merge request ${r.number} opened${r.author ? ` by ${r.author}` : ""}: ${r.url ? `[${r.title}](${r.url})` : r.title}`,
        },
        "API",
      );
    }
  }
}

/** The workspace's first "done" status. */
async function completedStatus(workspaceId: string): Promise<string | null> {
  const row = await db.workspaceStatus.findFirst({
    where: { workspaceId, status: { category: "completed" } },
    orderBy: { status: { position: "asc" } },
    select: { statusId: true },
  });
  return row?.statusId ?? null;
}

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
