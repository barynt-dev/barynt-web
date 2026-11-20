import { createHash } from "node:crypto";
import type { InboundProvider } from "./inbound";
import { closingMentions, type LinkTrigger } from "./link-rules";

// What a code host's webhook says about the issues it names (BARY-226):
// pull requests, branches, commits and checks, read from GitHub's events
// into one model — the same for GitLab later, which only needs its own
// reading. Barynt keeps each entry on the issues whose keys the texts carry
// (`WEB-42` in a branch, a title, a commit message), and the plugin's frames
// draw them. Pure, no dependencies besides hashing.

export interface PullRequestEntry {
  kind: "pull_request";
  repo: string;
  number: number;
  title: string;
  state: "draft" | "open" | "merged" | "closed";
  /** The latest review that decides: approved or changes requested. */
  review: "approved" | "changes_requested" | null;
  url: string | null;
  branch: string | null;
  base: string | null;
  author: string | null;
  additions: number | null;
  deletions: number | null;
  at: string;
}

export interface BranchEntry {
  kind: "branch";
  repo: string;
  name: string;
  url: string | null;
  deleted: boolean;
  at: string;
}

export interface CommitEntry {
  kind: "commit";
  repo: string;
  sha: string;
  /** The first line. */
  message: string;
  url: string | null;
  author: string | null;
  branch: string | null;
  at: string;
}

export type CheckState = "pending" | "success" | "failure" | "neutral";

export interface ChecksEntry {
  kind: "checks";
  repo: string;
  branch: string;
  /** The commit they ran on — a new one starts them over. */
  sha: string;
  /** All runs together: failing if one fails, pending while one runs. */
  state: CheckState;
  runs: { name: string; state: CheckState; url: string | null }[];
  at: string;
}

export type LinkEntry =
  | PullRequestEntry
  | BranchEntry
  | CommitEntry
  | ChecksEntry;

/** An entry, where it's kept, and the texts to look for issue keys in. */
export interface LinkFinding {
  /** The plugin-data key: one per pull request, branch, commit, checks. */
  key: string;
  entry: LinkEntry;
  texts: string[];
  /** A pull request's: what a rule may react to (BARY-227). */
  trigger?: LinkTrigger;
  /** Where a key means the pull request works on the issue — its branch
   *  name, `Fixes WEB-42` — not just names it. */
  closes?: string[];
}

/** Most commits one push files, and most check runs kept per branch. */
export const MAX_COMMITS = 20;
export const MAX_RUNS = 20;

type Json = Record<string, unknown>;
const obj = (v: unknown): Json =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
const str = (v: unknown, max = 200): string | null =>
  typeof v === "string" && v ? v.slice(0, max) : null;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const branchOf = (ref: unknown) => {
  const r = str(ref, 300);
  return r?.startsWith("refs/heads/") ? r.slice(11) : null;
};

/** Plugin-data keys allow `[A-Za-z0-9_.:-]`: `acme/web` → `acme:web`. */
const repoKey = (repo: string) => repo.replace(/[^A-Za-z0-9_.-]/g, ":");
/** A branch name may hold anything; its key is a short hash of it. */
const nameKey = (name: string) =>
  createHash("sha256").update(name).digest("hex").slice(0, 16);

export const linkKey = {
  pullRequest: (repo: string, number: number) =>
    `pr:${repoKey(repo)}:${number}`,
  branch: (repo: string, name: string) =>
    `branch:${repoKey(repo)}:${nameKey(name)}`,
  commit: (repo: string, sha: string) =>
    `commit:${repoKey(repo)}:${sha.slice(0, 12)}`,
  checks: (repo: string, branch: string) =>
    `checks:${repoKey(repo)}:${nameKey(branch)}`,
};

/** GitHub's check conclusion or status, as one of four. */
function checkState(status: unknown, conclusion: unknown): CheckState {
  if (status !== "completed") return "pending";
  if (conclusion === "success") return "success";
  if (
    conclusion === "failure" ||
    conclusion === "timed_out" ||
    conclusion === "cancelled" ||
    conclusion === "action_required" ||
    conclusion === "startup_failure"
  )
    return "failure";
  return "neutral";
}

/** Runs together: a failure wins, then a run still going. */
export function overallState(runs: { state: CheckState }[]): CheckState {
  if (runs.some((r) => r.state === "failure")) return "failure";
  if (runs.some((r) => r.state === "pending")) return "pending";
  if (runs.some((r) => r.state === "success")) return "success";
  return "neutral";
}

function pullRequest(
  repo: string,
  pr: Json,
  at: string,
  review: PullRequestEntry["review"],
  action: unknown = null,
): LinkFinding | null {
  const number = num(pr.number);
  if (number === null) return null;
  const branch = str(obj(pr.head).ref, 300);
  const state: PullRequestEntry["state"] =
    pr.merged === true || pr.merged_at
      ? "merged"
      : pr.state === "closed"
        ? "closed"
        : pr.draft === true
          ? "draft"
          : "open";
  const title = str(pr.title) ?? "";
  const description = str(pr.body, 4000) ?? "";
  const trigger: LinkTrigger | undefined =
    (action === "opened" && state === "open") || action === "ready_for_review"
      ? "pull_request.opened"
      : action === "closed" && state === "merged"
        ? "pull_request.merged"
        : undefined;
  return {
    key: linkKey.pullRequest(repo, number),
    entry: {
      kind: "pull_request",
      repo,
      number,
      title,
      state,
      review,
      url: str(pr.html_url, 500),
      branch,
      base: str(obj(pr.base).ref, 300),
      author: str(obj(pr.user).login),
      additions: num(pr.additions),
      deletions: num(pr.deletions),
      at,
    },
    texts: [branch ?? "", title, description],
    ...(trigger && { trigger }),
    closes: [
      branch ?? "",
      ...closingMentions(title),
      ...closingMentions(description),
    ],
  };
}

function github(event: string, body: Json, at: string): LinkFinding[] {
  const repo = str(obj(body.repository).full_name);
  if (!repo) return [];

  if (event === "pull_request") {
    const found = pullRequest(
      repo,
      obj(body.pull_request),
      at,
      null,
      body.action,
    );
    return found ? [found] : [];
  }

  if (event === "pull_request_review") {
    const state = str(obj(body.review).state)?.toLowerCase();
    const review =
      state === "approved"
        ? "approved"
        : state === "changes_requested"
          ? "changes_requested"
          : null;
    // A plain comment changes nothing a card shows.
    if (!review) return [];
    const found = pullRequest(repo, obj(body.pull_request), at, review);
    return found ? [found] : [];
  }

  if (event === "push") {
    const branch = branchOf(body.ref);
    if (!branch) return [];
    const findings: LinkFinding[] = [];
    if (body.deleted === true) {
      findings.push({
        key: linkKey.branch(repo, branch),
        entry: {
          kind: "branch",
          repo,
          name: branch,
          url: null,
          deleted: true,
          at,
        },
        texts: [branch],
      });
      return findings;
    }
    const list = Array.isArray(body.commits) ? body.commits : [];
    for (const raw of list.slice(-MAX_COMMITS)) {
      const c = obj(raw);
      const sha = str(c.id, 64);
      if (!sha) continue;
      const message = str(c.message, 4000) ?? "";
      findings.push({
        key: linkKey.commit(repo, sha),
        entry: {
          kind: "commit",
          repo,
          sha,
          message: message.split("\n")[0].slice(0, 200),
          url: str(c.url, 500),
          author: str(obj(c.author).username) ?? str(obj(c.author).name),
          branch,
          at: str(c.timestamp) ?? at,
        },
        // The branch too: `ada/web-42-…` files every commit pushed to it.
        texts: [message, branch],
      });
    }
    return findings;
  }

  if (event === "create" || event === "delete") {
    if (body.ref_type !== "branch") return [];
    const name = str(body.ref, 300);
    if (!name) return [];
    // `ada/web-42` stays a path: GitHub's tree page wants the slashes.
    const url = `https://github.com/${repo}/tree/${name.split("/").map(encodeURIComponent).join("/")}`;
    return [
      {
        key: linkKey.branch(repo, name),
        entry: {
          kind: "branch",
          repo,
          name,
          url: event === "create" ? url : null,
          deleted: event === "delete",
          at,
        },
        texts: [name],
      },
    ];
  }

  if (event === "check_run" || event === "check_suite") {
    const run = obj(body[event]);
    const suite = event === "check_run" ? obj(run.check_suite) : run;
    const branch = str(suite.head_branch, 300);
    const sha = str(run.head_sha, 64) ?? str(suite.head_sha, 64);
    if (!branch || !sha) return [];
    const state = checkState(run.status, run.conclusion);
    const name =
      event === "check_run"
        ? (str(run.name) ?? "check")
        : (str(obj(run.app).name) ?? "checks");
    const prBranches = (
      Array.isArray(run.pull_requests) ? run.pull_requests : []
    ).map((p) => str(obj(obj(p).head).ref, 300) ?? "");
    const runs = [{ name, state, url: str(run.html_url ?? run.url, 500) }];
    return [
      {
        key: linkKey.checks(repo, branch),
        entry: {
          kind: "checks",
          repo,
          branch,
          sha,
          state: overallState(runs),
          runs,
          at,
        },
        texts: [branch, ...prBranches],
      },
    ];
  }

  return [];
}

/** What a call is about — nothing for an event this doesn't read, or a
 *  provider it can't read yet (GitLab comes next, generic never). */
export function readLinkFindings(
  provider: InboundProvider,
  event: string,
  body: unknown,
  at = new Date(),
): LinkFinding[] {
  if (provider === "github") return github(event, obj(body), at.toISOString());
  return [];
}

/**
 * The entry to keep, given what's kept already: a pull request keeps its
 * review until a new one decides, and its size when this call has none;
 * checks gather their runs by name until a new commit starts them over.
 */
export function mergeEntry(existing: unknown, incoming: LinkEntry): LinkEntry {
  const old = obj(existing);
  if (old.kind !== incoming.kind) return incoming;
  if (incoming.kind === "pull_request") {
    const was = old as unknown as PullRequestEntry;
    return {
      ...incoming,
      review: incoming.review ?? was.review ?? null,
      additions: incoming.additions ?? was.additions ?? null,
      deletions: incoming.deletions ?? was.deletions ?? null,
    };
  }
  if (incoming.kind === "checks") {
    const was = old as unknown as ChecksEntry;
    if (was.sha !== incoming.sha || !Array.isArray(was.runs)) return incoming;
    const runs = [
      ...was.runs.filter((r) => !incoming.runs.some((n) => n.name === r.name)),
      ...incoming.runs,
    ].slice(-MAX_RUNS);
    return { ...incoming, runs, state: overallState(runs) };
  }
  if (incoming.kind === "branch" && !incoming.deleted) {
    const was = old as unknown as BranchEntry;
    return { ...incoming, url: incoming.url ?? was.url ?? null };
  }
  return incoming;
}

/**
 * The issue keys among `prefixes` that `texts` name: `WEB-42`, also as a
 * branch writes it (`web-42-fix-login`, `feature/WEB_42`). Each once.
 */
export function findIssueRefs(
  texts: string[],
  prefixes: readonly string[],
): { prefix: string; key: number }[] {
  if (prefixes.length === 0) return [];
  const known = new Map(prefixes.map((p) => [p.toUpperCase(), p]));
  const found = new Map<string, { prefix: string; key: number }>();
  const re = /(?<![A-Za-z0-9])([A-Za-z][A-Za-z0-9]{0,9})[-_](\d{1,7})(?!\d)/g;
  for (const text of texts) {
    for (const m of text.matchAll(re)) {
      const prefix = known.get(m[1].toUpperCase());
      if (!prefix) continue;
      const key = Number(m[2]);
      found.set(`${prefix}-${key}`, { prefix, key });
    }
  }
  return [...found.values()];
}
