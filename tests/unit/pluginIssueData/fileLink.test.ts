import { beforeEach, describe, expect, it, mock } from "bun:test";

// Filing a GitLab/GitHub call under the issues it names (BARY-216), and the
// rules the plugin's app follows. `@/lib/db`, the permissions and the API
// mutations are mocked — a process of its own (scripts/run-tests.ts).

const projects = [
  { id: "p-web", prefix: "WEB" },
  { id: "p-ops", prefix: "OPS" },
];
const issues: Record<string, { id: string; status: string }> = {
  "p-web:42": { id: "i-42", status: "s-progress" },
};
const projectFind = mock(async (_: unknown) => projects);
const upsert = mock(async (_: unknown) => ({}));
const findMany = mock(async (_: unknown) => [] as unknown[]);
const updateIssueForUser = mock(async (..._: unknown[]) => ({ ok: true }));
const createCommentForUser = mock(async (..._: unknown[]) => ({ ok: true }));

mock.module("@/lib/db", () => ({
  db: {
    project: { findMany: projectFind },
    issue: {
      findFirst: async ({
        where,
      }: {
        where: { projectId: string; key: number };
      }) => issues[`${where.projectId}:${where.key}`] ?? null,
    },
    pluginIssueData: { upsert, findMany, deleteMany: async () => ({}) },
    workspaceStatus: {
      findFirst: async () => ({ statusId: "s-done" }),
    },
  },
}));
mock.module("@/lib/permissions", () => ({
  accessibleProjectIds: async () => new Set(["p-web"]),
}));
mock.module("@/features/api-v1/mutations", () => ({
  updateIssueForUser,
  createCommentForUser,
}));

const { fileLink, readIssueData, writeIssueData } = await import(
  "@/features/plugins/issue-data"
);

const activation = {
  id: "act-1",
  workspaceId: "ws-1",
  projectId: null,
  botUserId: "bot-1",
};
const mergeRequest = (action: string) => ({
  user: { name: "Ada" },
  object_attributes: {
    iid: 412,
    title: "Fix the login",
    source_branch: "ada/web-42-login",
    state: action === "merge" ? "merged" : "opened",
    action,
  },
});

beforeEach(() => {
  projectFind.mockClear();
  upsert.mockClear();
  findMany.mockClear();
  updateIssueForUser.mockClear();
  createCommentForUser.mockClear();
});

describe("fileLink", () => {
  it("files a merge request under the issue its branch names", async () => {
    const reached = await fileLink(
      activation,
      { provider: "gitlab", rules: [] },
      "merge_request",
      mergeRequest("open"),
    );
    expect(reached).toBe(1);
    const call = upsert.mock.calls[0][0] as {
      where: { activationId_issueId_key: Record<string, string> };
      create: { value: { state: string } };
    };
    expect(call.where.activationId_issueId_key).toEqual({
      activationId: "act-1",
      issueId: "i-42",
      key: "mr:412",
    });
    expect(call.create.value.state).toBe("opened");
    // No rule on: the app does nothing.
    expect(updateIssueForUser).not.toHaveBeenCalled();
    expect(createCommentForUser).not.toHaveBeenCalled();
  });

  it("looks in a workspace plugin's public projects, a project plugin's own", async () => {
    await fileLink(
      activation,
      { provider: "gitlab", rules: [] },
      "merge_request",
      mergeRequest("open"),
    );
    expect(
      (projectFind.mock.calls[0][0] as { where: Record<string, unknown> })
        .where,
    ).toEqual({ workspaceId: "ws-1", visibility: "public" });

    await fileLink(
      { ...activation, projectId: "p-web" },
      { provider: "gitlab", rules: [] },
      "merge_request",
      mergeRequest("open"),
    );
    expect(
      (projectFind.mock.calls[1][0] as { where: Record<string, unknown> })
        .where,
    ).toEqual({ workspaceId: "ws-1", id: "p-web" });
  });

  it("sets the issue done on a merge, as the app", async () => {
    await fileLink(
      activation,
      { provider: "gitlab", rules: ["merged_to_done"] },
      "merge_request",
      mergeRequest("merge"),
    );
    expect(updateIssueForUser).toHaveBeenCalledWith("bot-1", "i-42", {
      status: "s-done",
    });
  });

  it("comments when a merge request is opened, as the app", async () => {
    await fileLink(
      activation,
      { provider: "gitlab", rules: ["comment_on_open", "merged_to_done"] },
      "merge_request",
      mergeRequest("open"),
    );
    expect(createCommentForUser).toHaveBeenCalledTimes(1);
    expect(createCommentForUser.mock.calls[0][0]).toBe("bot-1");
    expect(updateIssueForUser).not.toHaveBeenCalled();
  });

  it("files nothing for an issue that doesn't exist or a call it can't read", async () => {
    const none = await fileLink(
      activation,
      { provider: "gitlab", rules: [] },
      "merge_request",
      {
        object_attributes: { iid: 1, title: "OPS-9", source_branch: "x" },
      },
    );
    expect(none).toBe(0);
    expect(
      await fileLink(
        activation,
        { provider: "gitlab", rules: [] },
        "tag_push",
        {},
      ),
    ).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("readIssueData / writeIssueData", () => {
  it("reads the plugin's entries in projects the person sees", async () => {
    findMany.mockResolvedValueOnce([
      {
        issueId: "i-42",
        key: "mr:412",
        value: { state: "opened" },
        updatedAt: new Date(0),
      },
    ]);
    const data = await readIssueData("u-1", "ci", "ws-1", ["i-42", "i-42"]);
    expect(Object.keys(data)).toEqual(["i-42"]);
    const where = (
      findMany.mock.calls[0][0] as { where: Record<string, unknown> }
    ).where;
    expect(where).toEqual({
      issueId: { in: ["i-42"] },
      activation: { pluginId: "ci", workspaceId: "ws-1" },
      issue: { projectId: { in: ["p-web"] } },
    });
  });

  it("refuses a value too large or a key it can't take", async () => {
    expect(await writeIssueData("act-1", "i-42", "a b", 1)).toBe("bad_key");
    expect(
      await writeIssueData("act-1", "i-42", "big", "x".repeat(17 * 1024)),
    ).toBe("too_large");
    expect(await writeIssueData("act-1", "i-42", "ok", { a: 1 })).toBe("ok");
  });
});
