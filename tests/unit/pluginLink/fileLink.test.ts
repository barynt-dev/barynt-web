import { beforeEach, describe, expect, it, mock } from "bun:test";

// Filing a `link` hook's call (BARY-226): on the issues it names in the
// plugin's project, merged with what's kept, and the boards told. `@/lib/db`
// is mocked — a process of its own (scripts/run-tests.ts).

const kept = new Map<string, unknown>();
const upsert = mock(
  async (args: {
    where: { activationId_issueId_key: { issueId: string; key: string } };
    create: { value: unknown };
  }) => {
    const { issueId, key } = args.where.activationId_issueId_key;
    kept.set(`${issueId}|${key}`, args.create.value);
    return {};
  },
);
const issues: Record<string, string> = { "p-web|42": "i-42", "p-web|7": "i-7" };
const updates: { userId: string; issueId: string; status: string }[] = [];
const comments: { userId: string; issueId: string; body: string }[] = [];
// Its own tests run elsewhere; here, what the rules ask it to do.
mock.module("@/features/api-v1/mutations", () => ({
  updateIssueForUser: async (
    userId: string,
    issueId: string,
    input: { status: string },
  ) => {
    updates.push({ userId, issueId, status: input.status });
    return { ok: true, data: { id: issueId } };
  },
  createCommentForUser: async (
    userId: string,
    issueId: string,
    input: { body: string },
  ) => {
    comments.push({ userId, issueId, body: input.body });
    return { ok: true, data: {} };
  },
}));

mock.module("@/lib/db", () => ({
  db: {
    project: {
      findMany: async (args: { where: { id?: string } }) =>
        args.where.id === "p-web" ? [{ id: "p-web", prefix: "WEB" }] : [],
    },
    issue: {
      findFirst: async (args: {
        where: { projectId: string; key: number };
      }) => {
        const id = issues[`${args.where.projectId}|${args.where.key}`];
        return id ? { id } : null;
      },
    },
    status: {
      findMany: async () => [
        { id: "in_review", name: "In Review" },
        { id: "done", name: "Done" },
      ],
    },
    pluginIssueData: {
      findUnique: async (args: {
        where: { activationId_issueId_key: { issueId: string; key: string } };
      }) => {
        const { issueId, key } = args.where.activationId_issueId_key;
        const value = kept.get(`${issueId}|${key}`);
        return value ? { value } : null;
      },
      upsert,
    },
  },
}));

const { fileLink, handleLink } = await import("@/features/plugins/link");
const { pluginDataChangesSince } = await import("@/lib/realtime/store");

const activation = {
  id: "act-1",
  pluginId: "github",
  workspaceId: "ws-link",
  projectId: "p-web",
};
const repository = { full_name: "acme/web" };
const pullRequest = (over: Record<string, unknown> = {}) => ({
  number: 42,
  title: "Keep the cookie",
  body: "Fixes WEB-42",
  state: "open",
  head: { ref: "ada/web-42-cookie" },
  base: { ref: "main" },
  user: { login: "ada" },
  ...over,
});

beforeEach(() => {
  kept.clear();
  upsert.mockClear();
  updates.length = 0;
  comments.length = 0;
});

describe("fileLink()", () => {
  it("keeps a pull request on the issues it names, and tells the boards", async () => {
    const since = Date.now();
    const reached = await fileLink(activation, "github", "pull_request", {
      action: "opened",
      repository,
      pull_request: pullRequest({ body: "Fixes WEB-42, also WEB-7 and OPS-1" }),
    });
    expect(reached.map((r) => r.issueId).sort()).toEqual(["i-42", "i-7"]);
    expect(kept.get("i-42|pr:acme:web:42")).toMatchObject({
      kind: "pull_request",
      state: "open",
    });
    expect(
      pluginDataChangesSince("ws-link", since)
        .map((c) => c.issueId)
        .sort(),
    ).toEqual(["i-42", "i-7"]);
  });

  it("merges a review into the pull request it's on", async () => {
    await fileLink(activation, "github", "pull_request_review", {
      repository,
      review: { state: "approved" },
      pull_request: pullRequest(),
    });
    await fileLink(activation, "github", "pull_request", {
      action: "synchronize",
      repository,
      pull_request: pullRequest({ title: "Keep the cookie, v2" }),
    });
    expect(kept.get("i-42|pr:acme:web:42")).toMatchObject({
      title: "Keep the cookie, v2",
      review: "approved",
    });
  });

  it("files nothing for an issue that doesn't exist or another project's key", async () => {
    const reached = await fileLink(activation, "github", "pull_request", {
      repository,
      pull_request: pullRequest({
        head: { ref: "fix" },
        title: "WEB-999 and OPS-1",
        body: "",
      }),
    });
    expect(reached).toEqual([]);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("handleLink(): the rules (BARY-227)", () => {
  const rules = [
    { id: "opened", on: "pull_request.opened" as const },
    { id: "merged", on: "pull_request.merged" as const },
  ];
  const app = {
    ...activation,
    botUserId: "bot-1",
    capabilities: [
      "issues:read",
      "issues:write",
      "comments:write",
      "webhooks:receive",
    ],
  };
  const plugin = { id: "github", name: "GitHub" };
  const hook = { provider: "github" as const, rules };
  const merged = (body: string, branch = "fix") => ({
    action: "closed",
    repository,
    pull_request: pullRequest({
      state: "closed",
      merged: true,
      body,
      head: { ref: branch },
      html_url: "https://github.com/acme/web/pull/42",
    }),
  });

  it("moves the issue a pull request closes, as the app, and says why", async () => {
    await handleLink(
      app,
      plugin,
      hook,
      { merged: "done" },
      "pull_request",
      merged("Fixes WEB-42"),
    );
    expect(updates).toEqual([
      { userId: "bot-1", issueId: "i-42", status: "done" },
    ]);
    expect(comments[0].body).toBe(
      "Pull request [acme/web#42](https://github.com/acme/web/pull/42) was merged — status set to **Done**.",
    );
  });

  it("counts the key in the branch's name, but not one only mentioned", async () => {
    await handleLink(
      app,
      plugin,
      hook,
      { merged: "done" },
      "pull_request",
      merged("mentions WEB-7", "ada/web-42-cookie"),
    );
    expect(updates.map((u) => u.issueId)).toEqual(["i-42"]);
    // WEB-7 still got the pull request filed.
    expect(kept.has("i-7|pr:acme:web:42")).toBe(true);
  });

  it("does nothing with a rule off, without issues:write, or without a bot", async () => {
    await handleLink(
      app,
      plugin,
      hook,
      { opened: "in_review" },
      "pull_request",
      merged("Fixes WEB-42"),
    );
    await handleLink(
      { ...app, capabilities: ["issues:read", "webhooks:receive"] },
      plugin,
      hook,
      { merged: "done" },
      "pull_request",
      merged("Fixes WEB-42"),
    );
    await handleLink(
      { ...app, botUserId: null },
      plugin,
      hook,
      { merged: "done" },
      "pull_request",
      merged("Fixes WEB-42"),
    );
    expect(updates).toEqual([]);
  });

  it("counts a pull request's rules only for the place's target branches (BARY-238)", async () => {
    const into = (base: string) => ({
      ...merged("Fixes WEB-42"),
      pull_request: {
        ...merged("Fixes WEB-42").pull_request,
        base: { ref: base },
      },
    });
    await handleLink(
      app,
      plugin,
      hook,
      { merged: "done", _bases: ["main"] },
      "pull_request",
      into("develop"),
    );
    expect(updates).toEqual([]);
    await handleLink(
      app,
      plugin,
      hook,
      { merged: "done", _bases: ["main"] },
      "pull_request",
      into("main"),
    );
    expect(updates).toHaveLength(1);
  });

  it("moves the issue whose branch's checks fail, and says which", async () => {
    await handleLink(
      app,
      plugin,
      {
        provider: "github",
        rules: [{ id: "failed", on: "checks.failed" as const }],
      },
      { failed: "blocked" },
      "check_run",
      {
        repository,
        check_run: {
          name: "test",
          status: "completed",
          conclusion: "failure",
          head_sha: "abc",
          html_url: "https://github.com/acme/web/runs/1",
          check_suite: { head_branch: "ada/web-42-cookie" },
          pull_requests: [],
        },
      },
    );
    expect(updates).toEqual([
      { userId: "bot-1", issueId: "i-42", status: "blocked" },
    ]);
    expect(comments[0].body).toBe(
      "[test](https://github.com/acme/web/runs/1) failed on `ada/web-42-cookie` — status set to **blocked**.",
    );
  });

  it("changes the status without a comment when it may not comment", async () => {
    await handleLink(
      { ...app, capabilities: ["issues:read", "issues:write"] },
      plugin,
      hook,
      { merged: "done" },
      "pull_request",
      merged("Fixes WEB-42"),
    );
    expect(updates).toHaveLength(1);
    expect(comments).toEqual([]);
  });
});
