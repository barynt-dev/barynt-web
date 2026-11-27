import "server-only";
import { db } from "@/lib/db";
import {
  deploymentFinding,
  type LinkFinding,
  type WorkflowDeployment,
  workflowRunFinding,
} from "@/lib/plugins/link";
import { closingMentions } from "@/lib/plugins/link-rules";
import { asInstallation } from "./app";

// What a deployment shipped (BARY-238). A preview of a branch names its
// issue itself (`ada/web-42-…`); a deployment of `main` doesn't — so Barynt
// asks GitHub which commits came since the environment's deployment
// before, and finds the issues they close: a merge's branch, "Fixes
// WEB-42", or a pull request Barynt keeps whose merge made one of them.

/** Most commits a deployment's range is read for. */
const MAX_COMMITS = 100;

type Json = Record<string, unknown>;
const obj = (v: unknown): Json =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};

export interface Shipped {
  /** The texts that name what it closes. */
  texts: string[];
  /** Its commits, to match the merges of kept pull requests against. */
  shas: string[];
}

/**
 * The commits a successful deployment shipped: since the environment's
 * deployment before (just its own commit for the first), as GitHub
 * compares them. `null` for anything else, or when GitHub doesn't answer.
 */
export async function shippedCommits(
  installationId: string,
  repo: string,
  body: unknown,
): Promise<Shipped | null> {
  const data = obj(body);
  const deployment = obj(data.deployment);
  const status = obj(data.deployment_status);
  if (status.state !== "success") return null;
  const id = Number(deployment.id);
  const sha = typeof deployment.sha === "string" ? deployment.sha : null;
  const environment =
    typeof deployment.environment === "string" ? deployment.environment : null;
  if (!sha || !environment || !Number.isFinite(id)) return null;

  const list = await asInstallation<{ id?: number; sha?: string }[]>(
    installationId,
    `${repoPath(repo)}/deployments?environment=${encodeURIComponent(environment)}&per_page=30`,
  );
  if (list?.status !== 200 || !Array.isArray(list.data)) return null;
  const before = list.data
    .filter((d) => typeof d.id === "number" && d.id < id && d.sha)
    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
  return commitsBetween(installationId, repo, before?.sha ?? null, sha);
}

/**
 * What a workflow's run counted as a deployment ships (BARY-238): the
 * commits since the workflow's last successful run on the same branch —
 * just its own commit for the first. `null` when GitHub doesn't answer.
 */
export async function workflowShipped(
  installationId: string,
  repo: string,
  run: Record<string, unknown>,
): Promise<Shipped | null> {
  const id = Number(run.id);
  const workflowId = Number(run.workflow_id);
  const sha = typeof run.head_sha === "string" ? run.head_sha : null;
  const branch = typeof run.head_branch === "string" ? run.head_branch : null;
  if (!sha || !branch || !Number.isFinite(id) || !Number.isFinite(workflowId))
    return null;
  const list = await asInstallation<{
    workflow_runs?: { id?: number; head_sha?: string }[];
  }>(
    installationId,
    `${repoPath(repo)}/actions/workflows/${workflowId}/runs?branch=${encodeURIComponent(branch)}&status=success&per_page=10`,
  );
  if (list?.status !== 200) return null;
  const before = (list.data?.workflow_runs ?? [])
    .filter((r) => typeof r.id === "number" && r.id < id && r.head_sha)
    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
  return commitsBetween(installationId, repo, before?.head_sha ?? null, sha);
}

const repoPath = (repo: string) =>
  `/repos/${repo.split("/").map(encodeURIComponent).join("/")}`;

/** The commits after `before` up to `sha` — just `sha`'s own without one,
 *  or when they're the same — and the texts that name what they close. */
async function commitsBetween(
  installationId: string,
  repo: string,
  before: string | null,
  sha: string,
): Promise<Shipped | null> {
  const path = repoPath(repo);
  let commits: { sha: string; message: string }[];
  if (!before || before === sha) {
    const one = await asInstallation<{ commit?: { message?: string } }>(
      installationId,
      `${path}/commits/${encodeURIComponent(sha)}`,
    );
    if (one?.status !== 200) return null;
    commits = [{ sha, message: one.data?.commit?.message ?? "" }];
  } else {
    const range = await asInstallation<{
      commits?: { sha?: string; commit?: { message?: string } }[];
    }>(
      installationId,
      `${path}/compare/${encodeURIComponent(before)}...${encodeURIComponent(sha)}`,
    );
    if (range?.status !== 200) return null;
    commits = (range.data?.commits ?? [])
      .filter((c) => typeof c.sha === "string")
      .map((c) => ({ sha: c.sha as string, message: c.commit?.message ?? "" }));
  }
  commits = commits.slice(-MAX_COMMITS);

  const texts = commits.flatMap((c) => {
    const first = c.message.split("\n")[0] ?? "";
    // "Merge pull request #42 from ada/web-42-…": the branch closes it.
    return [
      ...(first.startsWith("Merge pull request") ||
      first.startsWith("Merge branch")
        ? [first]
        : []),
      ...closingMentions(c.message),
    ];
  });
  return { texts, shas: commits.map((c) => c.sha) };
}

/**
 * The keys of the issues a place keeps a pull request for whose merge
 * commit is among `shas` — squash merges carry no key of their own.
 */
async function mergedKeys(activationId: string, shas: string[]) {
  if (shas.length === 0) return [];
  const merged = await db.pluginIssueData.findMany({
    where: {
      activationId,
      key: { startsWith: "pr:" },
      OR: shas.map((sha) => ({ value: { path: ["mergeSha"], equals: sha } })),
    },
    select: {
      issue: { select: { key: true, project: { select: { prefix: true } } } },
    },
  });
  return merged.map((m) => `${m.issue.project.prefix}-${m.issue.key}`);
}

/**
 * The deployment as a finding for one place: the texts the commits carry,
 * and the keys of the issues whose kept pull request was merged by one of
 * them.
 */
export async function deploymentFor(
  activationId: string,
  repo: string,
  body: unknown,
  shipped: Shipped,
): Promise<LinkFinding | null> {
  const data = obj(body);
  const texts = [
    ...shipped.texts,
    ...(await mergedKeys(activationId, shipped.shas)),
  ];
  if (texts.length === 0) return null;
  return deploymentFinding(
    repo,
    obj(data.deployment),
    obj(data.deployment_status),
    new Date().toISOString(),
    texts,
    obj(data.workflow_run),
  );
}

/**
 * A workflow's run as a deployment for one place, when the place counts
 * that workflow as one (`workflowDeployments`): for its branch (a preview
 * of `ada/web-42-…`) and what it ships since the last successful run.
 */
export async function workflowDeploymentFor(
  activationId: string,
  repo: string,
  body: unknown,
  as: WorkflowDeployment,
  shipped: Shipped | null,
): Promise<LinkFinding> {
  const run = obj(obj(body).workflow_run);
  const branch = typeof run.head_branch === "string" ? run.head_branch : "";
  const texts = [
    branch,
    ...(shipped?.texts ?? []),
    ...(shipped ? await mergedKeys(activationId, shipped.shas) : []),
  ];
  return workflowRunFinding(repo, run, as, new Date().toISOString(), texts);
}
