import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { InboundProvider } from "@/lib/plugins/inbound";
import {
  findIssueRefs,
  type LinkFinding,
  mergeEntry,
  readLinkFindings,
} from "@/lib/plugins/link";
import { recordPluginDataChange } from "@/lib/realtime/store";

// A `link` hook's call (BARY-226): Barynt reads what GitHub says and keeps
// it on the issues it names, as the plugin's data — the plugin's frames
// draw it, boards and open issues ask again on their own (BARY-225).

interface Activation {
  id: string;
  pluginId: string;
  workspaceId: string;
  projectId: string | null;
}

/** Where its keys count: its project, or a workspace's public ones. */
function linkProjects(activation: Activation) {
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
 * Files the call under the issues it names — each entry merged with what's
 * kept already (a review on its pull request, a run among its checks).
 * Answers which issues it reached, with the findings for each.
 */
export async function fileLink(
  activation: Activation,
  provider: InboundProvider,
  event: string,
  body: unknown,
): Promise<{ issueId: string; findings: LinkFinding[] }[]> {
  const findings = readLinkFindings(provider, event, body);
  if (findings.length === 0) return [];
  const projects = await linkProjects(activation);
  const byPrefix = new Map(projects.map((p) => [p.prefix.toUpperCase(), p.id]));
  const reached = new Map<
    string,
    { projectId: string; findings: LinkFinding[] }
  >();

  for (const finding of findings) {
    for (const ref of findIssueRefs(finding.texts, [...byPrefix.keys()])) {
      const projectId = byPrefix.get(ref.prefix.toUpperCase());
      if (!projectId) continue;
      const issue = await db.issue.findFirst({
        where: { projectId, key: ref.key },
        select: { id: true },
      });
      if (!issue) continue;
      const where = {
        activationId_issueId_key: {
          activationId: activation.id,
          issueId: issue.id,
          key: finding.key,
        },
      };
      const kept = await db.pluginIssueData.findUnique({
        where,
        select: { value: true },
      });
      const value = mergeEntry(
        kept?.value,
        finding.entry,
      ) as unknown as Prisma.InputJsonValue;
      await db.pluginIssueData.upsert({
        where,
        create: {
          activationId: activation.id,
          issueId: issue.id,
          key: finding.key,
          value,
        },
        update: { value },
      });
      const at = reached.get(issue.id) ?? { projectId, findings: [] };
      at.findings.push(finding);
      reached.set(issue.id, at);
    }
  }

  for (const [issueId, { projectId }] of reached)
    recordPluginDataChange(activation.workspaceId, {
      pluginId: activation.pluginId,
      issueId,
      projectId,
    });
  return [...reached].map(([issueId, { findings }]) => ({
    issueId,
    findings,
  }));
}
