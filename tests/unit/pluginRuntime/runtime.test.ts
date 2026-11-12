import { beforeEach, describe, expect, it, mock } from "bun:test";

// The server side of a sandboxed plugin (BARY-144): where it runs, and what
// a request over the host bridge may do. Database, permissions and the API
// queries mocked away. Own process: it replaces `@/lib/permissions`.

const db = {
  project: { findUnique: mock() },
  pluginActivation: { findUnique: mock() },
  plugin: { findFirst: mock() },
  pluginFile: { findMany: mock() },
};
mock.module("@/lib/db", () => ({ db }));
const can = mock(async () => true);
const canEnterWorkspace = mock(async () => true);
mock.module("@/lib/permissions", () => ({ can, canEnterWorkspace }));
const listIssuesForUser = mock();
const getIssueForUser = mock();
mock.module("@/features/api-v1/queries", () => ({
  listIssuesForUser,
  getIssueForUser,
}));

const { callBridge, getPluginFrame } = await import(
  "@/features/plugins/runtime"
);

const manifest = {
  id: "timeline",
  name: "Timeline",
  version: "1.0.0",
  minBaryntVersion: "0.1.0",
  author: "Acme",
  description: "Issues on a time line.",
  kind: "sandbox",
  levels: ["project"],
  capabilities: ["issues:read", "ui:project-view"],
  license: "MIT",
  network: [],
  contributes: { projectViews: [{ id: "timeline", title: "Timeline" }] },
};
const place = { pluginId: "timeline", workspaceId: "ws1", projectId: "p1" };

beforeEach(() => {
  for (const group of Object.values(db))
    for (const fn of Object.values(group))
      (fn as ReturnType<typeof mock>).mockReset();
  can.mockImplementation(async () => true);
  listIssuesForUser.mockReset();
  getIssueForUser.mockReset();
  db.project.findUnique.mockResolvedValue({ workspaceId: "ws1" });
  db.pluginActivation.findUnique.mockResolvedValue({
    enabled: true,
    capabilities: ["issues:read", "ui:project-view"],
  });
  db.plugin.findFirst.mockResolvedValue({ id: "row1", manifest });
});

describe("callBridge", () => {
  it("lists the project's issues as the person", async () => {
    listIssuesForUser.mockResolvedValue({
      rows: [{ id: "i1" }],
      hasMore: false,
    });
    const res = await callBridge("u1", place, "issues.list", { take: 500 });
    expect(res).toEqual({
      ok: true,
      result: { issues: [{ id: "i1" }], nextCursor: null },
    });
    // At most 100, and for the person whose session it is.
    expect(listIssuesForUser.mock.calls[0]?.[0]).toBe("u1");
    expect(listIssuesForUser.mock.calls[0]?.[2]).toMatchObject({ take: 100 });
  });

  it("refuses a method that doesn't exist", async () => {
    expect(await callBridge("u1", place, "db.raw", {})).toEqual({
      ok: false,
      error: "unknown_method",
    });
  });

  it("refuses what wasn't confirmed here", async () => {
    db.pluginActivation.findUnique.mockResolvedValue({
      enabled: true,
      capabilities: ["ui:project-view"],
    });
    expect(await callBridge("u1", place, "issues.list", {})).toEqual({
      ok: false,
      error: "capability_not_confirmed",
    });
  });

  it("refuses a plugin that's switched off, or blocked", async () => {
    db.pluginActivation.findUnique.mockResolvedValue({
      enabled: false,
      capabilities: [],
    });
    expect((await callBridge("u1", place, "issues.list", {})).ok).toBe(false);
    db.pluginActivation.findUnique.mockResolvedValue({
      enabled: true,
      capabilities: ["issues:read"],
    });
    db.plugin.findFirst.mockResolvedValue(null);
    expect(await callBridge("u1", place, "issues.list", {})).toEqual({
      ok: false,
      error: "not_active",
    });
  });

  it("refuses someone who can't see the project", async () => {
    can.mockImplementation(async () => false);
    expect(await callBridge("u1", place, "issues.list", {})).toEqual({
      ok: false,
      error: "not_active",
    });
  });

  it("keeps a project's plugin in its project", async () => {
    expect(
      await callBridge("u1", place, "issues.list", { projectId: "p2" }),
    ).toEqual({ ok: false, error: "forbidden" });
    getIssueForUser.mockResolvedValue({ id: "i9", project: { id: "p2" } });
    expect(await callBridge("u1", place, "issues.get", { id: "i9" })).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("takes a project's workspace from the project, not the caller", async () => {
    db.project.findUnique.mockResolvedValue({ workspaceId: "other" });
    expect(await callBridge("u1", place, "issues.list", {})).toEqual({
      ok: false,
      error: "not_active",
    });
  });
});

describe("getPluginFrame", () => {
  const file = (name: string, text: string) => ({
    name,
    content: new TextEncoder().encode(text),
  });

  it("serves the plugin's code in a sandboxed document", async () => {
    db.pluginFile.findMany.mockResolvedValue([
      file("main.js", "export default class {}"),
    ]);
    const frame = await getPluginFrame("u1", place, {
      kind: "projectView",
      id: "timeline",
    });
    expect(frame?.html).toContain("export default class {}");
    expect(frame?.csp).toContain("sandbox allow-scripts");
  });

  it("only for a view it declares and was confirmed", async () => {
    db.pluginFile.findMany.mockResolvedValue([file("main.js", "x")]);
    expect(
      await getPluginFrame("u1", place, { kind: "projectView", id: "other" }),
    ).toBeNull();
    db.pluginActivation.findUnique.mockResolvedValue({
      enabled: true,
      capabilities: ["issues:read"],
    });
    expect(
      await getPluginFrame("u1", place, {
        kind: "projectView",
        id: "timeline",
      }),
    ).toBeNull();
  });
});
