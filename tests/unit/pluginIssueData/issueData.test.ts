import { beforeEach, describe, expect, it, mock } from "bun:test";

// What a plugin keeps on issues (BARY-216): read only for issues the person
// sees, only the plugin's own, and written within limits. `@/lib/db` and
// the permissions are mocked — a process of its own (scripts/run-tests.ts).

const upsert = mock(async (_: unknown) => ({}));
const findMany = mock(async (_: unknown) => [] as unknown[]);
const deleteMany = mock(async (_: unknown) => ({}));

mock.module("@/lib/db", () => ({
  db: { pluginIssueData: { upsert, findMany, deleteMany } },
}));
mock.module("@/lib/permissions", () => ({
  accessibleProjectIds: async () => new Set(["p-web", "p-ops"]),
}));

const { deleteIssueData, readIssueData, writeIssueData } = await import(
  "@/features/plugins/issue-data"
);

beforeEach(() => {
  upsert.mockClear();
  findMany.mockClear();
  deleteMany.mockClear();
});

const whereOf = () =>
  (findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where;

describe("readIssueData", () => {
  it("reads the plugin's entries in projects the person sees, by issue", async () => {
    findMany.mockResolvedValueOnce([
      {
        issueId: "i-1",
        key: "mr",
        value: { state: "open" },
        updatedAt: new Date(0),
      },
      { issueId: "i-1", key: "ci", value: "green", updatedAt: new Date(0) },
    ]);
    const data = await readIssueData("u-1", "ci", "ws-1", [
      "i-1",
      "i-1",
      "i-2",
    ]);
    expect(Object.keys(data)).toEqual(["i-1"]);
    expect(data["i-1"].map((e) => e.key)).toEqual(["mr", "ci"]);
    expect(whereOf()).toEqual({
      issueId: { in: ["i-1", "i-2"] },
      activation: { pluginId: "ci", workspaceId: "ws-1" },
      issue: { projectId: { in: ["p-web", "p-ops"] } },
    });
  });

  it("keeps a project's plugin to its project", async () => {
    await readIssueData("u-1", "ci", "ws-1", ["i-1"], "p-ops");
    expect(whereOf().issue).toEqual({ projectId: { in: ["p-ops"] } });
  });

  it("asks for nothing without issues", async () => {
    expect(await readIssueData("u-1", "ci", "ws-1", [])).toEqual({});
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("writeIssueData / deleteIssueData", () => {
  it("refuses a key it can't take or a value too large", async () => {
    expect(await writeIssueData("act-1", "i-1", "a b", 1)).toBe("bad_key");
    expect(
      await writeIssueData("act-1", "i-1", "big", "x".repeat(17 * 1024)),
    ).toBe("too_large");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("keeps one entry per activation, issue and key", async () => {
    expect(await writeIssueData("act-1", "i-1", "mr:412", { a: 1 })).toBe("ok");
    expect((upsert.mock.calls[0][0] as { where: unknown }).where).toEqual({
      activationId_issueId_key: {
        activationId: "act-1",
        issueId: "i-1",
        key: "mr:412",
      },
    });
    await deleteIssueData("act-1", "i-1", "mr:412");
    expect(deleteMany).toHaveBeenCalledWith({
      where: { activationId: "act-1", issueId: "i-1", key: "mr:412" },
    });
  });
});
