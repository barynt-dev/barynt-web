import "server-only";
import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { issuePath } from "@/lib/nav";
import { findIssueRefs, linkKey } from "@/lib/plugins/link";
import type { LinkReached } from "../plugins/link";
import { asInstallation } from "./app";

// The way back from GitHub (BARY-238): when a pull request starts working
// on issues — their key in its branch's name, or "Fixes WEB-42" — Barynt
// comments on it with a link to each, once, as the GitHub App. A project
// switches it on beside its pull request rules; it needs the app's
// "Pull requests: write".

type Json = Record<string, unknown>;
const obj = (v: unknown): Json =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};

/** The comment's text: a line per issue, linked. */
export function linkComment(
  issues: { ref: string; title: string; url: string }[],
): string {
  return [
    "Linked in Barynt:",
    "",
    ...issues.map(
      (i) =>
        `- [${i.ref}](${i.url}) ${i.title.replace(/\s+/g, " ").slice(0, 200)}`,
    ),
  ].join("\n");
}

/** Comments the issues a pull request newly works on, if any. */
export async function commentLinks(
  installationId: string,
  workspaceId: string,
  repo: string,
  body: unknown,
  reached: LinkReached[],
): Promise<void> {
  const pr = obj(obj(body).pull_request);
  const number = typeof pr.number === "number" ? pr.number : null;
  if (number === null) return;
  const key = linkKey.pullRequest(repo, number);
  const ids = reached
    .filter((r) => r.fresh.includes(key))
    .filter((r) =>
      r.findings.some(
        (f) =>
          f.key === key &&
          findIssueRefs(f.closes ?? [], [r.ref.prefix]).some(
            (ref) => ref.key === r.ref.key,
          ),
      ),
    )
    .map((r) => r.issueId);
  if (ids.length === 0) return;
  const issues = await db.issue.findMany({
    where: { id: { in: ids } },
    select: { key: true, title: true, project: { select: { prefix: true } } },
    orderBy: { key: "asc" },
  });
  if (issues.length === 0) return;
  const text = linkComment(
    issues.map((i) => {
      const ref = `${i.project.prefix}-${i.key}`;
      return { ref, title: i.title, url: appUrl(issuePath(workspaceId, ref)) };
    }),
  );
  await asInstallation(
    installationId,
    `/repos/${repo.split("/").map(encodeURIComponent).join("/")}/issues/${number}/comments`,
    { method: "POST", body: { body: text } },
  );
}
