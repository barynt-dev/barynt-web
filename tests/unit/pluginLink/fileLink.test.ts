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

const { fileLink } = await import("@/features/plugins/link");
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
