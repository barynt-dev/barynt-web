import type { InboundProvider } from "./inbound";

// Filing a webhook from GitLab or GitHub under the issues it names
// (BARY-216): what Barynt reads of a merge request, a pipeline or a push,
// and where it finds issue keys — `WEB-42` in a branch, a title, a commit.
// No dependencies.

/** What a call is about, as the issue gets it — the same for GitLab and
 *  GitHub. `key` is what makes it one entry: a merge request updates its
 *  own, a second one beside it. */
export interface LinkRecord {
  key: string;
  kind: "merge_request" | "pipeline" | "commit";
  /** `!412`, `#7`, a pipeline's number, a commit's short sha. */
  number: string;
  title: string;
  /** `opened`, `merged`, `closed`; `running`, `success`, `failed`; `pushed`. */
  state: string;
  url: string | null;
  branch: string | null;
  author: string | null;
  /** ISO time of the call — newest wins in a list. */
  at: string;
}

/** A record and the texts to look for issue keys in. */
export interface LinkFinding {
  record: LinkRecord;
  texts: string[];
  /** This call opened it — not every later update of an open one. */
  opened?: boolean;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
const str = (v: unknown, max = 200): string | null =>
  typeof v === "string" && v
    ? v.slice(0, max)
    : typeof v === "number"
      ? String(v)
      : null;
const branchOf = (ref: unknown) =>
  str(ref)?.replace(/^refs\/heads\//, "") ?? null;

/** Most commits a push files — GitLab sends up to 20, GitHub up to 2048. */
const MAX_COMMITS = 20;

function commits(
  list: unknown,
  branch: string | null,
  at: string,
): LinkFinding[] {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_COMMITS).flatMap((raw) => {
    const c = obj(raw);
    const sha = str(c.id, 64);
    if (!sha) return [];
    const message = str(c.message, 500) ?? "";
    return [
      {
        record: {
          key: `commit:${sha.slice(0, 12)}`,
          kind: "commit" as const,
          number: sha.slice(0, 8),
          title: message.split("\n")[0].slice(0, 200),
          state: "pushed",
          url: str(c.url, 500),
          branch,
          author: str(obj(c.author).name) ?? str(obj(c.author).username),
          at,
        },
        texts: [message],
      },
    ];
  });
}

/** GitLab's merge requests, pipelines and pushes. */
function gitlab(event: string, body: Json, at: string): LinkFinding[] {
  const a = obj(body.object_attributes);
  if (event === "merge_request") {
    const iid = str(a.iid);
    if (!iid) return [];
    const branch = str(a.source_branch);
    const state =
      a.action === "merge" || a.state === "merged"
        ? "merged"
        : (str(a.state) ?? "opened");
    return [
      {
        record: {
          key: `mr:${iid}`,
          kind: "merge_request",
          number: `!${iid}`,
          title: str(a.title) ?? "",
          state,
          url: str(a.url, 500),
          branch,
          author: str(obj(body.user).name),
          at,
        },
        texts: [
          branch ?? "",
          str(a.title) ?? "",
          str(a.description, 2000) ?? "",
        ],
        opened: a.action === "open",
      },
    ];
  }
  if (event === "pipeline") {
    const id = str(a.id);
    if (!id) return [];
    const branch = branchOf(a.ref);
    const mr = obj(body.merge_request);
    return [
      {
        record: {
          key: `pipeline:${branch ?? id}`,
          kind: "pipeline",
          number: `#${id}`,
          title: str(obj(body.commit).message)?.split("\n")[0] ?? "",
          state: str(a.status) ?? "unknown",
          url: str(a.url, 500) ?? null,
          branch,
          author: str(obj(body.user).name),
          at,
        },
        texts: [
          branch ?? "",
          str(mr.title) ?? "",
          str(obj(body.commit).message, 500) ?? "",
        ],
      },
    ];
  }
  if (event === "push") return commits(body.commits, branchOf(body.ref), at);
  return [];
}

/** GitHub's pull requests, workflow runs and pushes. */
function github(event: string, body: Json, at: string): LinkFinding[] {
  if (event === "pull_request") {
    const pr = obj(body.pull_request);
    const number = str(pr.number);
    if (!number) return [];
    const branch = str(obj(pr.head).ref);
    const state =
      pr.merged === true
        ? "merged"
        : (str(pr.state) ?? "open") === "open"
          ? "opened"
          : "closed";
    return [
      {
        record: {
          key: `mr:${number}`,
          kind: "merge_request",
          number: `#${number}`,
          title: str(pr.title) ?? "",
          state,
          url: str(pr.html_url, 500),
          branch,
          author: str(obj(pr.user).login),
          at,
        },
        texts: [branch ?? "", str(pr.title) ?? "", str(pr.body, 2000) ?? ""],
        opened: body.action === "opened",
      },
    ];
  }
  if (event === "workflow_run" || event === "check_suite") {
    const run = obj(body[event]);
    const branch = str(run.head_branch);
    const id = str(run.run_number) ?? str(run.id);
    if (!id) return [];
    const state =
      str(run.conclusion) ??
      (run.status === "completed" ? "completed" : "running");
    return [
      {
        record: {
          key: `pipeline:${branch ?? id}`,
          kind: "pipeline",
          number: `#${id}`,
          title:
            str(run.name) ??
            str(obj(run.head_commit).message)?.split("\n")[0] ??
            "",
          state: state === "failure" ? "failed" : state,
          url: str(run.html_url, 500),
          branch,
          author: str(obj(run.actor).login),
          at,
        },
        texts: [branch ?? "", str(obj(run.head_commit).message, 500) ?? ""],
      },
    ];
  }
  if (event === "push") return commits(body.commits, branchOf(body.ref), at);
  return [];
}

/** What a call from GitLab or GitHub is about — nothing for an event this
 *  doesn't read (an issue comment, a tag), or a generic provider. */
export function readLinkFindings(
  provider: InboundProvider,
  event: string,
  body: unknown,
  at = new Date(),
): LinkFinding[] {
  const iso = at.toISOString();
  if (provider === "gitlab") return gitlab(event, obj(body), iso);
  if (provider === "github") return github(event, obj(body), iso);
  return [];
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

/** The rules an admin can switch on for a `link` hook. */
export const LINK_RULES = ["merged_to_done", "comment_on_open"] as const;
export type LinkRule = (typeof LINK_RULES)[number];

/** What a rule does for a finding — `null` when it doesn't apply. */
export function ruleAction(
  rule: LinkRule,
  finding: LinkFinding,
): "complete" | "comment" | null {
  if (finding.record.kind !== "merge_request") return null;
  if (rule === "merged_to_done" && finding.record.state === "merged")
    return "complete";
  if (rule === "comment_on_open" && finding.opened) return "comment";
  return null;
}
