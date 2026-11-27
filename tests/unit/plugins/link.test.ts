import { describe, expect, it } from "bun:test";
import {
  deploymentFinding,
  findIssueRefs,
  type LinkEntry,
  linkKey,
  MAX_DEPLOYMENTS,
  mergeEntry,
  type PullRequestEntry,
  readLinkFindings,
} from "@/lib/plugins/link";
import { baseMatches, closingMentions } from "@/lib/plugins/link-rules";

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
      mergeSha: null,
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
    expect(
      read("create", { ref: "ada/web-7 dark", ref_type: "branch" })[0].entry,
    ).toMatchObject({
      url: "https://github.com/acme/web/tree/ada/web-7%20dark",
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

describe("what a pull request works on (BARY-227)", () => {
  it("knows each step of its way (BARY-238)", () => {
    const trigger = (action: string, over: Record<string, unknown> = {}) =>
      read("pull_request", { action, pull_request: pr(over) })[0].trigger;
    expect(trigger("opened", { draft: true })).toBe("pull_request.draft");
    expect(trigger("converted_to_draft", { draft: true })).toBe(
      "pull_request.draft",
    );
    expect(trigger("opened")).toBe("pull_request.opened");
    expect(trigger("ready_for_review")).toBe("pull_request.opened");
    expect(trigger("review_requested")).toBe("pull_request.review_requested");
    expect(trigger("review_requested", { draft: true })).toBeUndefined();
    expect(trigger("closed", { state: "closed", merged: true })).toBe(
      "pull_request.merged",
    );
    expect(trigger("closed", { state: "closed" })).toBe("pull_request.closed");
    expect(trigger("synchronize")).toBeUndefined();
  });

  it("knows a review that decides", () => {
    const trigger = (state: string) =>
      read("pull_request_review", {
        action: "submitted",
        review: { state },
        pull_request: pr(),
      })[0]?.trigger;
    expect(trigger("APPROVED")).toBe("pull_request.approved");
    expect(trigger("CHANGES_REQUESTED")).toBe("pull_request.changes_requested");
    expect(trigger("COMMENTED")).toBeUndefined();
  });

  it("knows checks that failed on the branch, and what it works on", () => {
    const run = (conclusion: string | null) =>
      read("check_run", {
        check_run: {
          name: "test",
          status: conclusion ? "completed" : "in_progress",
          conclusion,
          head_sha: "abc",
          check_suite: { head_branch: "ada/web-42-oauth-callback" },
          pull_requests: [],
        },
      })[0];
    const failed = run("failure");
    expect(failed.trigger).toBe("checks.failed");
    expect(findIssueRefs(failed.closes ?? [], ["WEB"])).toEqual([
      { prefix: "WEB", key: 42 },
    ]);
    expect(run("success").trigger).toBeUndefined();
    expect(run(null).trigger).toBeUndefined();
  });

  it("keeps the commit a merge made", () => {
    const [found] = read("pull_request", {
      action: "closed",
      pull_request: pr({
        state: "closed",
        merged: true,
        merge_commit_sha: "m1",
      }),
    });
    expect(found.entry).toMatchObject({ mergeSha: "m1" });
  });

  it("reads a deployment, and what a rule reacts to", () => {
    const deploy = (state: string, over: Record<string, unknown> = {}) =>
      read("deployment_status", {
        deployment: {
          id: 7,
          ref: "ada/web-42-oauth-callback",
          sha: "abc",
          environment: "preview",
          production_environment: false,
          ...over,
        },
        deployment_status: {
          state,
          environment_url: "https://web-42.preview.acme.dev",
        },
      })[0];
    const preview = deploy("success");
    expect(preview.entry).toMatchObject({
      kind: "deployment",
      environment: "preview",
      production: false,
      state: "success",
      url: "https://web-42.preview.acme.dev",
    });
    expect(preview.trigger).toBe("deployment.test");
    expect(findIssueRefs(preview.closes ?? [], ["WEB"])).toEqual([
      { prefix: "WEB", key: 42 },
    ]);
    expect(
      deploy("success", {
        environment: "production",
        production_environment: undefined,
      }).trigger,
    ).toBe("deployment.production");
    expect(deploy("in_progress").trigger).toBeUndefined();
    expect(deploy("failure").entry).toMatchObject({ state: "failure" });
  });

  it("keeps an environment's deployments before the latest", () => {
    const status = (id: number, state: string, sha = `s${id}`) =>
      deploymentFinding(
        "acme/web",
        {
          id,
          ref: "main",
          sha,
          environment: "staging",
          creator: { login: "ada" },
        },
        { state, log_url: `https://github.com/acme/web/actions/runs/${id}` },
        at.toISOString(),
        ["WEB-1"],
        { id: 900 + id, name: "Deploy" },
      )?.entry as LinkEntry;
    let kept = mergeEntry(undefined, status(1, "in_progress"));
    kept = mergeEntry(kept, status(1, "success"));
    expect(kept).toMatchObject({
      id: 1,
      state: "success",
      workflow: "Deploy",
      runId: 901,
      creator: "ada",
      logUrl: "https://github.com/acme/web/actions/runs/1",
      history: [],
    });
    // A newer one: the one before is history, no longer what runs there.
    kept = mergeEntry(kept, status(2, "failure"));
    expect(kept).toMatchObject({ id: 2, state: "failure" });
    expect((kept as { history: unknown[] }).history).toMatchObject([
      { id: 1, sha: "s1", state: "inactive" },
    ]);
    // GitHub marking an older one inactive changes it in the history only.
    kept = mergeEntry(kept, status(3, "success"));
    kept = mergeEntry(kept, status(2, "inactive"));
    expect(kept).toMatchObject({ id: 3, state: "success" });
    expect((kept as { history: unknown[] }).history).toMatchObject([
      { id: 2, state: "inactive" },
      { id: 1, state: "inactive" },
    ]);
    for (let id = 4; id < 20; id++)
      kept = mergeEntry(kept, status(id, "success"));
    expect((kept as { history: unknown[] }).history).toHaveLength(
      MAX_DEPLOYMENTS,
    );
  });

  it("takes the keys a deployment of main shipped from the host", () => {
    const found = deploymentFinding(
      "acme/web",
      { ref: "main", environment: "production", production_environment: true },
      { state: "success" },
      at.toISOString(),
      ["Merge pull request #42 from ada/web-42-oauth", "WEB-7"],
    );
    expect(found?.trigger).toBe("deployment.production");
    expect(findIssueRefs(found?.closes ?? [], ["WEB"])).toEqual([
      { prefix: "WEB", key: 42 },
      { prefix: "WEB", key: 7 },
    ]);
  });

  it("counts a target branch by the place's list", () => {
    expect(baseMatches("develop", [])).toBe(true);
    expect(baseMatches("main", ["main"])).toBe(true);
    expect(baseMatches("develop", ["main"])).toBe(false);
    expect(baseMatches("release/2.1", ["main", "release/*"])).toBe(true);
    expect(baseMatches("release", ["release/*"])).toBe(false);
    expect(baseMatches(null, ["main"])).toBe(false);
  });

  it("names what it closes: the branch, and what follows fixes/closes/resolves", () => {
    expect(
      closingMentions("Fixes WEB-42. Closes web-7, WEB-8 and WEB_9; see WEB-1"),
    ).toEqual(["WEB-42", "web-7, WEB-8 and WEB_9"]);
    expect(closingMentions("resolved: API-3")).toEqual(["API-3"]);
    expect(closingMentions("prefix WEB-1 fixed later")).toEqual([]);
    const [found] = read("pull_request", {
      action: "opened",
      pull_request: pr({ body: "Fixes WEB-42, mentions WEB-7" }),
    });
    expect(findIssueRefs(found.closes ?? [], ["WEB"])).toEqual([
      { prefix: "WEB", key: 42 },
    ]);
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
