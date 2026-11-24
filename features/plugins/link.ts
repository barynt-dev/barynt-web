import "server-only";
import {
  createCommentForUser,
  updateIssueForUser,
} from "@/features/api-v1/mutations";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { InboundProvider } from "@/lib/plugins/inbound";
import {
  type ChecksEntry,
  findIssueRefs,
  type LinkFinding,
  mergeEntry,
  type PullRequestEntry,
  readLinkFindings,
} from "@/lib/plugins/link";
import { baseMatches, type LinkTrigger } from "@/lib/plugins/link-rules";
import { recordPluginDataChange } from "@/lib/realtime/store";
import { runAsPlugin } from "@/lib/webhooks/source";

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
): Promise<LinkReached[]> {
  const findings = readLinkFindings(provider, event, body);
  if (findings.length === 0) return [];
  const projects = await linkProjects(activation);
  const byPrefix = new Map(projects.map((p) => [p.prefix.toUpperCase(), p.id]));
  const reached = new Map<string, LinkReached & { projectId: string }>();

  for (const finding of findings) {
    for (const ref of findIssueRefs(finding.texts, [...byPrefix.keys()])) {
      const projectId = byPrefix.get(ref.prefix.toUpperCase());
      if (!projectId) continue;
      const issue = await db.issue.findFirst({
        where: { projectId, key: ref.key },
        select: { id: true, status: true },
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
      const at = reached.get(issue.id) ?? {
        issueId: issue.id,
        status: issue.status,
        ref,
        projectId,
        findings: [],
      };
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
  return [...reached.values()].map(({ projectId: _, ...r }) => r);
}

/** An issue a call named, and what it said about it. */
export interface LinkReached {
  issueId: string;
  status: string;
  ref: { prefix: string; key: number };
  findings: LinkFinding[];
}

/** A link hook's rules a project switched on: rule id → status to set. */
export type LinkRuleStatuses = Record<string, string>;

/** The rules switched on, as stored — anything else is left out. Keys
 *  with `_` are the hook's options, never a rule (ids have no `_`). */
export function linkRuleStatuses(raw: unknown): LinkRuleStatuses {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter(
      (e): e is [string, string] =>
        typeof e[1] === "string" && !e[0].startsWith("_"),
    ),
  );
}

/** Most target branches a place lists. */
export const LINK_BASES_MAX = 20;

/** The target branches a pull request's rules count for, as stored
 *  (`_bases`) — none: every branch. */
export function linkRuleBases(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const bases = (raw as Record<string, unknown>)._bases;
  return Array.isArray(bases)
    ? bases
        .filter((b): b is string => typeof b === "string" && !!b.trim())
        .map((b) => b.trim())
        .slice(0, LINK_BASES_MAX)
    : [];
}

/**
 * The status changes the rules ask for (BARY-227): for each issue a pull
 * request works on — its key in the branch's name, or `Fixes WEB-42` — the
 * status of the rule its trigger switched on. A key only named elsewhere
 * links and nothing more; an issue already there stays as it is. The last
 * rule to apply wins (merged after opened in the same call).
 */
export function linkRuleChanges(
  reached: LinkReached[],
  rules: { id: string; on: LinkTrigger }[],
  statuses: LinkRuleStatuses,
  /** A pull request's rules count only for these target branches. */
  bases: readonly string[] = [],
): { issueId: string; status: string; finding: LinkFinding }[] {
  const changes: { issueId: string; status: string; finding: LinkFinding }[] =
    [];
  for (const issue of reached) {
    let change: (typeof changes)[number] | null = null;
    for (const finding of issue.findings) {
      if (!finding.trigger) continue;
      if (
        finding.entry.kind === "pull_request" &&
        !baseMatches(finding.entry.base, bases)
      )
        continue;
      const works = findIssueRefs(finding.closes ?? [], [
        issue.ref.prefix,
      ]).some((r) => r.key === issue.ref.key);
      if (!works) continue;
      for (const rule of rules) {
        const status = statuses[rule.id];
        if (rule.on === finding.trigger && status)
          change = { issueId: issue.issueId, status, finding };
      }
    }
    if (change && change.status !== issue.status) changes.push(change);
  }
  return changes;
}

/**
 * A `link` hook's call, start to end: filed on the issues it names, then
 * the project's rules applied as the plugin's app — through the API's own
 * functions, so rights, history, events and the audit log are as for any
 * change, marked "via" the plugin. Each change gets a comment saying why,
 * when the plugin may comment.
 */
export async function handleLink(
  activation: Activation & {
    botUserId: string | null;
    capabilities: string[];
  },
  plugin: { id: string; name: string },
  hook: {
    provider: InboundProvider;
    rules?: { id: string; on: LinkTrigger }[];
  },
  stored: unknown,
  event: string,
  body: unknown,
): Promise<void> {
  const reached = await fileLink(activation, hook.provider, event, body);
  const changes = linkRuleChanges(
    reached,
    hook.rules ?? [],
    linkRuleStatuses(stored),
    linkRuleBases(stored),
  );
  const bot = activation.botUserId;
  if (changes.length === 0 || !bot) return;
  if (!activation.capabilities.includes("issues:write")) return;
  const comment = activation.capabilities.includes("comments:write");
  const names = new Map(
    (
      await db.status.findMany({
        where: { id: { in: changes.map((c) => c.status) } },
        select: { id: true, name: true },
      })
    ).map((s) => [s.id, s.name]),
  );
  await runAsPlugin(plugin, async () => {
    for (const change of changes) {
      const updated = await updateIssueForUser(bot, change.issueId, {
        status: change.status,
      });
      if (!updated.ok || !comment) continue;
      await createCommentForUser(
        bot,
        change.issueId,
        {
          body: `${linkRuleReason(change.finding)} — status set to **${names.get(change.status) ?? change.status}**.`,
        },
        "APP",
      );
    }
  });
}

/** Why a rule moved an issue, for its comment: what happened, linked. */
export function linkRuleReason(finding: LinkFinding): string {
  if (finding.entry.kind === "checks") {
    const checks = finding.entry as ChecksEntry;
    const failed = checks.runs.find((r) => r.state === "failure");
    const name = failed
      ? failed.url
        ? `[${failed.name}](${failed.url})`
        : failed.name
      : "A check";
    return `${name} failed on \`${checks.branch}\``;
  }
  const pr = finding.entry as PullRequestEntry;
  const link = pr.url
    ? `[${pr.repo}#${pr.number}](${pr.url})`
    : `${pr.repo}#${pr.number}`;
  const what: Record<string, string> = {
    "pull_request.draft": "was opened as a draft",
    "pull_request.opened": "was opened",
    "pull_request.review_requested": "asks for a review",
    "pull_request.approved": "was approved",
    "pull_request.changes_requested": "needs changes",
    "pull_request.merged": "was merged",
    "pull_request.closed": "was closed without merging",
  };
  return `Pull request ${link} ${what[finding.trigger ?? ""] ?? "changed"}`;
}
