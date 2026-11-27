import "server-only";
import { db } from "@/lib/db";
import { deploymentFinding, type LinkFinding } from "@/lib/plugins/link";
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
  const path = `/repos/${repo.split("/").map(encodeURIComponent).join("/")}`;

  const list = await asInstallation<{ id?: number; sha?: string }[]>(
    installationId,
    `${path}/deployments?environment=${encodeURIComponent(environment)}&per_page=30`,
  );
  if (list?.status !== 200 || !Array.isArray(list.data)) return null;
  const before = list.data
    .filter((d) => typeof d.id === "number" && d.id < id && d.sha)
    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];

  let commits: { sha: string; message: string }[];
  if (!before?.sha || before.sha === sha) {
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
      `${path}/compare/${encodeURIComponent(before.sha)}...${encodeURIComponent(sha)}`,
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
 * The deployment as a finding for one place: the texts the commits carry,
 * and the keys of the issues whose kept pull request was merged by one of
 * them — squash merges carry no key of their own.
 */
export async function deploymentFor(
  activationId: string,
  repo: string,
  body: unknown,
  shipped: Shipped,
): Promise<LinkFinding | null> {
  const data = obj(body);
  const merged =
    shipped.shas.length > 0
      ? await db.pluginIssueData.findMany({
          where: {
            activationId,
            key: { startsWith: "pr:" },
            OR: shipped.shas.map((sha) => ({
              value: { path: ["mergeSha"], equals: sha },
            })),
          },
          select: {
            issue: {
              select: { key: true, project: { select: { prefix: true } } },
            },
          },
        })
      : [];
  const keys = merged.map((m) => `${m.issue.project.prefix}-${m.issue.key}`);
  const texts = [...shipped.texts, ...keys];
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
