import { describe, expect, it } from "bun:test";
import {
  findIssueRefs,
  linkKey,
  mergeEntry,
  type PullRequestEntry,
  readLinkFindings,
} from "@/lib/plugins/link";

// What Barynt reads of GitHub's webhooks (BARY-226) — payloads cut down
// from GitHub's own examples to what's read.

const at = new Date("2026-11-19T10:00:00Z");
const repository = { full_name: "acme/web" };
const read = (event: string, body: Record<string, unknown>) =>
  readLinkFindings("github", event, { repository, ...body }, at);

const pr = (over: Record<string, unknown> = {}) => ({
  number: 42,
  title: "Keep the session cookie through the Safari redirect",
  body: "Fixes WEB-42, see also web-7",
  state: "open",
  draft: false,
  merged: false,
  html_url: "https://github.com/acme/web/pull/42",
  head: { ref: "ada/web-42-oauth-callback" },
  base: { ref: "main" },
  user: { login: "ada" },
  additions: 120,
  deletions: 34,
  ...over,
});

describe("reading GitHub's events", () => {
  it("reads a pull request, its state and where to look for keys", () => {
    const [found] = read("pull_request", {
      action: "opened",
      pull_request: pr(),
    });
    expect(found.key).toBe("pr:acme:web:42");
    expect(found.entry).toEqual({
      kind: "pull_request",
      repo: "acme/web",
      number: 42,
      title: "Keep the session cookie through the Safari redirect",
      state: "open",
      review: null,
      url: "https://github.com/acme/web/pull/42",
      branch: "ada/web-42-oauth-callback",
      base: "main",
      author: "ada",
      additions: 120,
      deletions: 34,
      at: at.toISOString(),
    });
    expect(found.texts).toContain("ada/web-42-oauth-callback");

    const state = (over: Record<string, unknown>) =>
      (
        read("pull_request", { pull_request: pr(over) })[0].entry as {
          state: string;
        }
      ).state;
    expect(state({ draft: true })).toBe("draft");
    expect(state({ state: "closed", merged: true })).toBe("merged");
    expect(state({ state: "closed" })).toBe("closed");
  });

  it("takes a review that decides, and leaves a plain comment", () => {
    const review = (state: string) =>
      read("pull_request_review", { review: { state }, pull_request: pr() });
    expect(
      (review("changes_requested")[0].entry as { review: string }).review,
    ).toBe("changes_requested");
    expect((review("APPROVED")[0].entry as { review: string }).review).toBe(
      "approved",
    );
    expect(review("commented")).toEqual([]);
  });

  it("files a push's commits under their messages and their branch", () => {
    const found = read("push", {
      ref: "refs/heads/ada/web-42-oauth-callback",
      commits: [
        {
          id: "9f3a1c2d4e5f60718293a4b5c6d7e8f901234567",
          message: "Keep cookie on redirect\n\nlonger text",
          url: "https://github.com/acme/web/commit/9f3a1c2",
          author: { name: "Ada", username: "ada" },
          timestamp: "2026-11-19T09:58:00Z",
        },
      ],
    });
    expect(found).toHaveLength(1);
    expect(found[0].key).toBe("commit:acme:web:9f3a1c2d4e5f");
    expect(found[0].entry).toMatchObject({
      kind: "commit",
      message: "Keep cookie on redirect",
      author: "ada",
      branch: "ada/web-42-oauth-callback",
    });
    expect(found[0].texts).toContain("ada/web-42-oauth-callback");
    // A tag isn't a branch.
    expect(read("push", { ref: "refs/tags/v1", commits: [] })).toEqual([]);
  });

  it("knows a branch made and removed", () => {
    const made = read("create", { ref: "web-7-dark-mode", ref_type: "branch" });
    expect(made[0].key).toBe(linkKey.branch("acme/web", "web-7-dark-mode"));
    expect(made[0].entry).toMatchObject({
      deleted: false,
      url: "https://github.com/acme/web/tree/web-7-dark-mode",
    });
    const gone = read("delete", { ref: "web-7-dark-mode", ref_type: "branch" });
    expect(gone[0].entry).toMatchObject({ deleted: true });
    expect(read("create", { ref: "v1.0", ref_type: "tag" })).toEqual([]);
  });

  it("reads a check run on a branch", () => {
    const [found] = read("check_run", {
      check_run: {
        name: "e2e (safari)",
        status: "in_progress",
        conclusion: null,
        head_sha: "abc123",
        html_url: "https://github.com/acme/web/runs/1",
        check_suite: { head_branch: "ada/web-42-oauth-callback" },
        pull_requests: [],
      },
    });
    expect(found.key).toBe(
      linkKey.checks("acme/web", "ada/web-42-oauth-callback"),
    );
    expect(found.entry).toMatchObject({
      kind: "checks",
      sha: "abc123",
      state: "pending",
      runs: [{ name: "e2e (safari)", state: "pending" }],
    });
  });

  it("leaves what it doesn't read, and other providers for now", () => {
    expect(read("issues", { action: "opened" })).toEqual([]);
    expect(
      readLinkFindings("github", "pull_request", { pull_request: pr() }),
    ).toEqual([]);
    expect(readLinkFindings("gitlab", "merge_request", {})).toEqual([]);
  });

  it("keeps every key within what plugin data allows", () => {
    for (const key of [
      linkKey.pullRequest("acme/web.site", 1),
      linkKey.branch("acme/web", "feature/ünïcode & more"),
      linkKey.commit("acme/web", "f".repeat(40)),
      linkKey.checks("a/b", "x/y"),
    ])
      expect(key).toMatch(/^[A-Za-z0-9_.:-]{1,100}$/);
  });
});

describe("keeping an entry", () => {
  const prEntry = () =>
    read("pull_request", { pull_request: pr() })[0].entry as PullRequestEntry;

  it("keeps a pull request's review until a new one decides", () => {
    const reviewed = { ...prEntry(), review: "approved" as const };
    expect(mergeEntry(reviewed, prEntry())).toMatchObject({
      review: "approved",
    });
    expect(
      mergeEntry(reviewed, { ...prEntry(), review: "changes_requested" }),
    ).toMatchObject({ review: "changes_requested" });
  });

  it("gathers check runs by name, and starts over on a new commit", () => {
    const run = (
      name: string,
      status: string,
      conclusion: string | null,
      sha = "s1",
    ) =>
      read("check_run", {
        check_run: {
          name,
          status,
          conclusion,
          head_sha: sha,
          check_suite: { head_branch: "web-42" },
        },
      })[0].entry;
    let kept = mergeEntry(undefined, run("build", "completed", "success"));
    kept = mergeEntry(kept, run("test", "completed", "failure"));
    kept = mergeEntry(kept, run("build", "completed", "success"));
    expect(kept).toMatchObject({
      state: "failure",
      runs: [
        { name: "test", state: "failure" },
        { name: "build", state: "success" },
      ],
    });
    expect(mergeEntry(kept, run("build", "queued", null, "s2"))).toMatchObject({
      sha: "s2",
      state: "pending",
      runs: [{ name: "build" }],
    });
  });
});

describe("findIssueRefs", () => {
  it("finds the keys of known prefixes, as branches write them too", () => {
    expect(
      findIssueRefs(
        ["Fixes WEB-42", "ada/web-42-oauth", "feature/WEB_7", "API-3 OTHER-9"],
        ["WEB", "API"],
      ),
    ).toEqual([
      { prefix: "WEB", key: 42 },
      { prefix: "WEB", key: 7 },
      { prefix: "API", key: 3 },
    ]);
    expect(findIssueRefs(["WEB-42"], [])).toEqual([]);
  });
});
