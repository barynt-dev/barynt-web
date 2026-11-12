import { beforeEach, describe, expect, it, mock } from "bun:test";

// The server side of a sandboxed plugin (BARY-144): where it runs, and what
// a request over the host bridge may do. Database, permissions and the API
// queries mocked away. Own process: it replaces `@/lib/permissions`.

const db = {
  project: { findUnique: mock() },
  pluginActivation: { findUnique: mock() },
  plugin: { findFirst: mock() },
  pluginFile: { findMany: mock() },
  pluginStorage: {
    findUnique: mock(),
    aggregate: mock(),
    upsert: mock(),
    deleteMany: mock(),
    findMany: mock(),
  },
  pluginSettings: { findUnique: mock() },
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
  listCommentsForUser: mock(),
  listLabelsForUser: mock(),
  listProjectCustomFieldsForUser: mock(),
  listProjectMembersForUser: mock(),
  listProjectsForUser: mock(),
  listWorkspaceMembersForUser: mock(),
}));
const createIssueForUser = mock();
const updateIssueForUser = mock();
const createCommentForUser = mock();
mock.module("@/features/api-v1/mutations", () => ({
  createIssueForUser,
  updateIssueForUser,
  createCommentForUser,
}));
const countRequest = mock(async () => ({ ok: true, info: {} }));
mock.module("@/lib/api/rateLimit", () => ({ countRequest }));
const recordAudit = mock(async (_input: unknown) => {});
mock.module("@/lib/audit", () => ({ recordAudit }));

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
  countRequest.mockImplementation(async () => ({ ok: true, info: {} }));
  for (const fn of [
    listIssuesForUser,
    getIssueForUser,
    createIssueForUser,
    updateIssueForUser,
    createCommentForUser,
    recordAudit,
  ])
    fn.mockReset();
  db.project.findUnique.mockResolvedValue({ workspaceId: "ws1" });
  db.pluginActivation.findUnique.mockResolvedValue({
    id: "act1",
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

describe("callBridge (BARY-145)", () => {
  const confirm = (...capabilities: string[]) =>
    db.pluginActivation.findUnique.mockResolvedValue({
      id: "act1",
      enabled: true,
      capabilities,
    });

  it("stops a plugin over its budget before anything else", async () => {
    countRequest.mockImplementation(async () => ({ ok: false, info: {} }));
    expect(await callBridge("u1", place, "issues.list", {})).toEqual({
      ok: false,
      error: "too_many_requests",
    });
    expect(listIssuesForUser).not.toHaveBeenCalled();
  });

  it("writes as the plugin, in the person's name, and logs it", async () => {
    confirm("issues:write");
    createIssueForUser.mockResolvedValue({
      ok: true,
      data: { id: "i1", ref: "WEB-1" },
    });
    const res = await callBridge("u1", place, "issues.create", {
      title: "From a plugin",
    });
    expect(res.ok).toBe(true);
    expect(createIssueForUser.mock.calls[0]?.[0]).toBe("u1");
    expect(createIssueForUser.mock.calls[0]?.[1]).toBe("p1");
    expect(createIssueForUser.mock.calls[0]?.[3]).toBe("PLUGIN");
    expect(recordAudit).toHaveBeenCalledTimes(1);
    expect(recordAudit.mock.calls[0]?.[0]).toMatchObject({
      action: "plugin.acted",
      actorId: "u1",
      target: { type: "plugin", id: "timeline" },
      meta: { method: "issues.create", ref: "WEB-1" },
    });
  });

  it("logs nothing for a read, or a refused write", async () => {
    confirm("issues:read", "issues:write");
    listIssuesForUser.mockResolvedValue({ rows: [], hasMore: false });
    await callBridge("u1", place, "issues.list", {});
    createIssueForUser.mockResolvedValue({ ok: false, status: 404 });
    expect(
      await callBridge("u1", place, "issues.create", { title: "x" }),
    ).toEqual({ ok: false, error: "not_found" });
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("needs fields:write to set custom field values", async () => {
    confirm("issues:write");
    expect(
      await callBridge("u1", place, "issues.create", {
        title: "x",
        customFields: { size: 3 },
      }),
    ).toEqual({ ok: false, error: "capability_not_confirmed" });
  });

  it("keeps a plugin's storage within its limits", async () => {
    confirm("storage:own");
    db.pluginStorage.aggregate.mockResolvedValue({
      _sum: { size: 0 },
      _count: 0,
    });
    db.pluginStorage.findUnique.mockResolvedValue(null);
    expect(
      await callBridge("u1", place, "storage.set", {
        key: "a",
        value: { n: 1 },
      }),
    ).toEqual({ ok: true, result: null });
    expect(db.pluginStorage.upsert.mock.calls[0]?.[0]).toMatchObject({
      create: { activationId: "act1", key: "a" },
    });
    expect(
      await callBridge("u1", place, "storage.set", {
        key: "big",
        value: "x".repeat(70 * 1024),
      }),
    ).toEqual({ ok: false, error: "storage_full" });
    db.pluginStorage.aggregate.mockResolvedValue({
      _sum: { size: 0 },
      _count: 500,
    });
    expect(
      await callBridge("u1", place, "storage.set", { key: "new", value: 1 }),
    ).toEqual({ ok: false, error: "storage_full" });
  });

  it("gives a plugin its own settings, defaults filled in", async () => {
    confirm();
    db.plugin.findFirst.mockResolvedValue({
      id: "row1",
      manifest: {
        ...manifest,
        contributes: {
          ...manifest.contributes,
          settings: [
            { key: "zoom", type: "number", label: "Zoom", default: 2 },
            { key: "title", type: "text", label: "Title" },
          ],
        },
      },
    });
    db.pluginSettings.findUnique.mockResolvedValue({ values: { title: "Hi" } });
    expect(await callBridge("u1", place, "settings.get", {})).toEqual({
      ok: true,
      result: { zoom: 2, title: "Hi" },
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
