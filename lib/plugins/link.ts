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
  /** The commit a merge made — what a deployment of the target branch
   *  is matched against. */
  mergeSha?: string | null;
  at: string;
}

/** One deployment to an environment — the latest, or one before it. */
export interface DeploymentRun {
  /** GitHub's id of it: its statuses update it, a newer one replaces it. */
  id: number | null;
  /** `pending` queued, `running` under way, `waiting` for someone to
   *  approve it, `cancelled` stopped (a newer one took over), `inactive`
   *  replaced by a newer one — no longer what runs there. */
  state:
    | "success"
    | "failure"
    | "pending"
    | "running"
    | "waiting"
    | "cancelled"
    | "inactive";
  /** The branch or tag deployed, and its commit. */
  ref: string | null;
  sha: string | null;
  /** The environment's address, else the run's. */
  url: string | null;
  /** Where its log is — the workflow run's page. */
  logUrl: string | null;
  /** The workflow that deployed it, and its run — to run it again. */
  workflow: string | null;
  runId: number | null;
  /** Who started it. */
  creator: string | null;
  at: string;
}

export interface DeploymentEntry extends DeploymentRun {
  kind: "deployment";
  repo: string;
  environment: string;
  /** GitHub's mark for what people use — `production` by default. */
  production: boolean;
  /** A workflow's run counted as a deployment (no GitHub environment):
   *  its file, `beta.yml`. */
  workflowFile?: string;
  /** The deployments before it, newest first — at most `MAX_DEPLOYMENTS`. */
  history: DeploymentRun[];
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
  | ChecksEntry
  | DeploymentEntry;

/** An entry, where it's kept, and the texts to look for issue keys in. */
export interface LinkFinding {
  /** The plugin-data key: one per pull request, branch, commit, checks. */
  key: string;
  entry: LinkEntry;
  texts: string[];
  /** What a rule may react to (BARY-227): a pull request's step, or its
   *  branch's checks failing. */
  trigger?: LinkTrigger;
  /** Where a key means the pull request works on the issue — its branch
   *  name, `Fixes WEB-42` — not just names it. */
  closes?: string[];
}

/** Most commits one push files, and most check runs kept per branch. */
export const MAX_COMMITS = 20;
export const MAX_RUNS = 20;
/** Most deployments kept per environment before the latest. */
export const MAX_DEPLOYMENTS = 10;

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
  deployment: (repo: string, environment: string) =>
    `deploy:${repoKey(repo)}:${nameKey(environment)}`,
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
    review === "approved"
      ? "pull_request.approved"
      : review === "changes_requested"
        ? "pull_request.changes_requested"
        : (action === "opened" || action === "converted_to_draft") &&
            state === "draft"
          ? "pull_request.draft"
          : (action === "opened" && state === "open") ||
              action === "ready_for_review"
            ? "pull_request.opened"
            : action === "review_requested" && state === "open"
              ? "pull_request.review_requested"
              : action === "closed" && state === "merged"
                ? "pull_request.merged"
                : action === "closed" && state === "closed"
                  ? "pull_request.closed"
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
      mergeSha: state === "merged" ? str(pr.merge_commit_sha, 64) : null,
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

  if (event === "deployment_status") {
    const found = deploymentFinding(
      repo,
      obj(body.deployment),
      obj(body.deployment_status),
      at,
      undefined,
      obj(body.workflow_run),
    );
    return found ? [found] : [];
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
        // A run that failed: the branch works on the issue its name has.
        ...(state === "failure" && {
          trigger: "checks.failed" as const,
          closes: [branch, ...prBranches],
        }),
      },
    ];
  }

  return [];
}

/**
 * A deployment's state as an entry — kept on the issues `texts` name. By
 * default the deployed branch's name (a preview of `ada/web-42-…`); for a
 * deployment of `main` the host passes the keys of what it shipped. A
 * successful one is what the deployment rules react to.
 */
export function deploymentFinding(
  repo: string,
  deployment: Json,
  status: Json,
  at: string,
  texts?: string[],
  run: Json = {},
): LinkFinding | null {
  const environment =
    str(status.environment) ?? str(deployment.environment) ?? null;
  if (!environment) return null;
  const raw = str(status.state);
  const state: DeploymentEntry["state"] =
    raw === "success"
      ? "success"
      : raw === "failure" || raw === "error"
        ? "failure"
        : raw === "inactive"
          ? "inactive"
          : raw === "in_progress"
            ? "running"
            : raw === "waiting"
              ? "waiting"
              : "pending";
  const production =
    typeof deployment.production_environment === "boolean"
      ? deployment.production_environment
      : environment.toLowerCase() === "production";
  const ref = str(deployment.ref, 300);
  const look = texts ?? [ref ?? ""];
  const logUrl =
    str(status.log_url, 500) ??
    str(status.target_url, 500) ??
    str(run.html_url, 500);
  return {
    key: linkKey.deployment(repo, environment),
    entry: {
      kind: "deployment",
      repo,
      environment,
      production,
      id: num(deployment.id),
      state,
      ref,
      sha: str(deployment.sha, 64),
      url: str(status.environment_url, 500) ?? logUrl,
      logUrl,
      workflow: str(run.name, 120),
      runId: num(run.id),
      creator: str(obj(deployment.creator).login, 80),
      at,
      history: [],
    },
    texts: look,
    ...(state === "success" && {
      trigger: production ? "deployment.production" : "deployment.test",
      closes: look,
    }),
  };
}

/** Where a workflow's run counts as a deployment (`workflowDeployments`). */
export interface WorkflowDeployment {
  /** Its file in `.github/workflows`, `beta.yml`. */
  workflow: string;
  /** The environment it counts as — named as the plugin shows it. */
  environment: string;
  /** Only runs on this branch — none: any. */
  branch?: string;
  production?: boolean;
}

/** The workflows a place counts as deployments, as its setting has them. */
export function workflowDeployments(raw: unknown): WorkflowDeployment[] {
  const list = obj(raw).workflows;
  if (!Array.isArray(list)) return [];
  return list.slice(0, 20).flatMap((w) => {
    const o = obj(w);
    const workflow = str(o.workflow, 200);
    const environment = str(o.environment, 100);
    if (!workflow || !environment) return [];
    const branch = str(o.branch, 300);
    return [
      {
        workflow,
        environment,
        ...(branch && { branch }),
        production: o.production === true,
      },
    ];
  });
}

/** Which of them a run is: by its file, and its branch if one is set. */
export function matchWorkflow(
  run: Json,
  list: WorkflowDeployment[],
): WorkflowDeployment | null {
  const file = (str(run.path, 300) ?? "").split("/").pop() ?? "";
  const branch = str(run.head_branch, 300);
  return (
    list.find(
      (w) => w.workflow === file && (!w.branch || w.branch === branch),
    ) ?? null
  );
}

/** A workflow's run as a deployment to the environment it counts as. */
export function workflowRunFinding(
  repo: string,
  run: Json,
  as: WorkflowDeployment,
  at: string,
  texts?: string[],
): LinkFinding {
  const status = str(run.status);
  const conclusion = str(run.conclusion);
  const state: DeploymentEntry["state"] =
    status !== "completed"
      ? status === "in_progress"
        ? "running"
        : status === "waiting"
          ? "waiting"
          : "pending"
      : conclusion === "success"
        ? "success"
        : conclusion === "cancelled" || conclusion === "skipped"
          ? "cancelled"
          : conclusion === "action_required"
            ? "waiting"
            : "failure";
  const production = as.production === true;
  const branch = str(run.head_branch, 300);
  const look = texts ?? [branch ?? ""];
  const logUrl = str(run.html_url, 500);
  return {
    key: linkKey.deployment(repo, as.environment),
    entry: {
      kind: "deployment",
      repo,
      environment: as.environment,
      production,
      workflowFile: as.workflow,
      id: num(run.id),
      state,
      ref: branch,
      sha: str(run.head_sha, 64),
      url: logUrl,
      logUrl,
      workflow: str(run.name, 120),
      runId: num(run.id),
      creator: str(obj(run.actor).login, 80),
      at,
      history: [],
    },
    texts: look,
    ...(state === "success" && {
      trigger: production ? "deployment.production" : "deployment.test",
      closes: look,
    }),
  };
}

/** A deployment's own fields, without where it went or its history. */
function runOf(entry: Json): DeploymentRun {
  const e = entry as unknown as DeploymentRun;
  return {
    id: e.id ?? null,
    state: e.state,
    ref: e.ref ?? null,
    sha: e.sha ?? null,
    url: e.url ?? null,
    logUrl: e.logUrl ?? null,
    workflow: e.workflow ?? null,
    runId: e.runId ?? null,
    creator: e.creator ?? null,
    at: e.at,
  };
}

/**
 * A deployment's status, given what's kept for its environment: the same
 * deployment updates it; a newer one puts the kept one in its history; an
 * older one's (GitHub marking it inactive) updates it there.
 */
function mergeDeployment(
  old: Json,
  incoming: DeploymentEntry,
): DeploymentEntry {
  const history = (
    Array.isArray(old.history) ? old.history : []
  ) as DeploymentRun[];
  const keptId = num(old.id);
  // Same one — or kept before ids were: it goes on.
  if (incoming.id === null || keptId === incoming.id)
    return { ...incoming, history };
  if (keptId !== null && incoming.id < keptId) {
    const run = runOf(incoming as unknown as Json);
    return {
      ...(old as unknown as DeploymentEntry),
      history: history.map((h) =>
        h.id === incoming.id ? { ...h, ...run, at: h.at } : h,
      ),
    };
  }
  // A newer one: the kept one, no longer running there, is history.
  const was = runOf(old);
  return {
    ...incoming,
    history: [
      { ...was, state: was.state === "success" ? "inactive" : was.state },
      ...history.filter((h) => h.id === null || h.id !== was.id),
    ].slice(0, MAX_DEPLOYMENTS),
  };
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
      mergeSha: incoming.mergeSha ?? was.mergeSha ?? null,
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
  if (incoming.kind === "deployment") return mergeDeployment(old, incoming);
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
