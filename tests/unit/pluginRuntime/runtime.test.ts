import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";

// The server side of a sandboxed plugin (BARY-144): where it runs, and what
// a request over the host bridge may do. Database, permissions and the API
// queries mocked away. Own process: it replaces `@/lib/permissions`.

// `sealSecret` needs an AUTH_SECRET; CI has none, a local .env might have
// one. A fixed one for this file, the one before restored after.
const savedSecret = process.env.AUTH_SECRET;
beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters!";
});
afterAll(() => {
  process.env.AUTH_SECRET = savedSecret;
});

const db = {
  pluginActivation: { findUnique: mock(), findMany: mock() },
  plugin: { findFirst: mock(), findMany: mock() },
  pluginFile: { findMany: mock() },
  pluginStorage: {
    findUnique: mock(),
    aggregate: mock(),
    upsert: mock(),
    deleteMany: mock(),
    findMany: mock(),
  },
  pluginSettings: { findUnique: mock(), upsert: mock() },
  pluginCredential: { findUnique: mock() },
  projectMember: { findMany: mock() },
  workspaceMember: { findMany: mock() },
  label: { findMany: mock() },
  project: { findUnique: mock(), findFirst: mock() },
};
mock.module("@/lib/db", () => ({ db }));
const can = mock(async (_u?: string, _permission?: string) => true);
const canEnterWorkspace = mock(async () => true);
const currentUserCanEnterWorkspace = mock(async () => true);
const hasPermission = mock(async () => true);
mock.module("@/lib/permissions", () => ({
  can,
  canEnterWorkspace,
  currentUserCanEnterWorkspace,
  hasPermission,
}));
const listIssuesForUser = mock();
const listProjectsForUser = mock();
const getIssueForUser = mock();
mock.module("@/features/api-v1/queries", () => ({
  listIssuesForUser,
  getIssueForUser,
  listCommentsForUser: mock(),
  listLabelsForUser: mock(),
  listProjectCustomFieldsForUser: mock(),
  listProjectMembersForUser: mock(),
  listProjectsForUser,
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

// The proxy's outside world (BARY-147): DNS answers and an HTTPS request
// that records what it was asked and answers from `upstream`.
const dnsLookup = mock(async () => [{ address: "93.184.216.34", family: 4 }]);
mock.module("node:dns/promises", () => ({ lookup: dnsLookup }));
const sent: {
  url: string;
  options: Record<string, unknown>;
  body: string;
  pinned?: string;
}[] = [];
let upstream = {
  status: 200,
  headers: { "content-type": "application/json" } as Record<string, string>,
  body: '{"ok":1}',
};
mock.module("node:https", () => {
  const request = (
    url: URL,
    options: Record<string, unknown>,
    onResponse: (res: unknown) => void,
  ) => {
    const record = { url: String(url), options, body: "" };
    sent.push(record);
    const lookup = options.lookup as (
      h: string,
      o: object,
      cb: (e: null, a: string) => void,
    ) => void;
    lookup("ignored", {}, (_e, address) => {
      (record as { pinned?: string }).pinned = address;
    });
    const { EventEmitter } = require("node:events");
    const req = new EventEmitter();
    req.write = (chunk: string) => {
      record.body += chunk;
    };
    req.end = () => {
      const res = new EventEmitter();
      res.statusCode = upstream.status;
      res.headers = upstream.headers;
      onResponse(res);
      res.emit("data", Buffer.from(upstream.body));
      res.emit("end");
    };
    return req;
  };
  return { default: { request }, request };
});
const { sealSecret } = await import("@/lib/secret-box");

const { callBridge, getPluginFrame, getPluginSlotView } = await import(
  "@/features/plugins/runtime"
);
const { parseWidgets } = await import("@/features/dashboard/widgets");
const {
  getPluginBadgeProviders,
  getPluginIssueActions,
  getPluginBlocks,
  getPluginIssuePanels,
  getPluginNav,
  getPluginWidgets,
} = await import("@/features/plugins/slots");

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
    listProjectsForUser,
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
    // Shown as the person's own, like the app's: no badge.
    expect(createIssueForUser.mock.calls[0]?.[3]).toBe("APP");
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

describe("slots (BARY-148)", () => {
  const wsPlace = { pluginId: "timeline", workspaceId: "ws1", projectId: null };

  it("lists a workspace plugin's issues across the workspace's projects", async () => {
    listProjectsForUser.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    listIssuesForUser.mockImplementation(
      async (_u: string, projectId: string) => ({
        rows:
          projectId === "p1"
            ? [{ id: "a", created: "2026-01-01" }]
            : [{ id: "b", created: "2026-02-01" }],
        hasMore: false,
      }),
    );
    const res = await callBridge("u1", wsPlace, "issues.list", { take: 1 });
    expect(res).toEqual({
      ok: true,
      result: {
        issues: [{ id: "b", created: "2026-02-01" }],
        nextCursor: null,
      },
    });
  });

  it("serves a workspace plugin's view and page, each with its capability", async () => {
    db.pluginFile.findMany.mockResolvedValue([
      { name: "main.js", content: new TextEncoder().encode("x") },
    ]);
    db.plugin.findFirst.mockResolvedValue({
      id: "row1",
      manifest: {
        ...manifest,
        levels: ["workspace", "project"],
        capabilities: ["issues:read", "ui:project-view", "ui:nav-item"],
        contributes: {
          ...manifest.contributes,
          navItems: [{ id: "roadmap", title: "Roadmap" }],
        },
      },
    });
    db.pluginActivation.findUnique.mockResolvedValue({
      id: "act1",
      enabled: true,
      capabilities: ["issues:read", "ui:project-view"],
    });
    expect(
      await getPluginFrame("u1", wsPlace, {
        kind: "projectView",
        id: "timeline",
      }),
    ).not.toBeNull();
    // ui:nav-item wasn't confirmed here.
    expect(
      await getPluginFrame("u1", wsPlace, { kind: "page", id: "roadmap" }),
    ).toBeNull();
  });
});

describe("getPluginNav (BARY-148)", () => {
  it("puts views and pages where the plugin is on, for visible projects", async () => {
    db.pluginActivation.findMany.mockResolvedValue([
      {
        pluginId: "timeline",
        projectId: null,
        capabilities: ["ui:project-view"],
      },
      {
        pluginId: "timeline",
        projectId: "p1",
        capabilities: ["ui:project-view", "ui:nav-item"],
      },
      {
        pluginId: "timeline",
        projectId: "hidden",
        capabilities: ["ui:project-view"],
      },
    ]);
    db.plugin.findMany.mockResolvedValue([
      {
        pluginId: "timeline",
        manifest: {
          ...manifest,
          levels: ["workspace", "project"],
          capabilities: ["issues:read", "ui:project-view", "ui:nav-item"],
          contributes: {
            ...manifest.contributes,
            navItems: [{ id: "roadmap", title: "Roadmap" }],
          },
        },
      },
    ]);
    const nav = await getPluginNav("ws-nav", ["p1"]);
    expect(nav.workspace.map((e) => e.path)).toEqual([
      "plugin/timeline/view/timeline",
    ]);
    expect(nav.projects.p1?.map((e) => e.path)).toEqual([
      "plugin/timeline/page/roadmap",
      "plugin/timeline/view/timeline",
    ]);
    // A project the person can't see stays out.
    expect(nav.projects.hidden).toBeUndefined();
  });
});

describe("widgets and settings pages (BARY-149)", () => {
  const withSettings = (extra: Record<string, unknown> = {}) =>
    db.plugin.findFirst.mockResolvedValue({
      id: "row1",
      manifest: {
        ...manifest,
        contributes: {
          ...manifest.contributes,
          settings: [{ key: "zoom", type: "number", label: "Zoom" }],
          settingsPage: true,
          ...extra,
        },
      },
    });

  it("saves its settings for someone who may change them, checked and logged", async () => {
    withSettings();
    db.pluginSettings.upsert.mockReset();
    expect(
      await callBridge("u1", place, "settings.set", {
        values: { zoom: 3, sneaky: "x" },
      }),
    ).toEqual({ ok: true, result: null });
    expect(db.pluginSettings.upsert.mock.calls[0]?.[0]).toMatchObject({
      create: { activationId: "act1", values: { zoom: 3 } },
    });
    expect(recordAudit.mock.calls.at(-1)?.[0]).toMatchObject({
      action: "plugin.settings.updated",
      meta: { keys: ["zoom"] },
    });
  });

  it("checks a member or label against the place's (BARY-204)", async () => {
    withSettings({
      settings: [
        { key: "who", type: "member", label: "Who" },
        { key: "tag", type: "label", label: "Tag" },
      ],
    });
    db.projectMember.findMany.mockResolvedValue([
      { user: { id: "u1", firstName: "Ada", lastName: "L" } },
    ]);
    db.label.findMany.mockResolvedValue([
      { id: "l1", name: "Bug", color: "#f00" },
    ]);
    expect(
      await callBridge("u1", place, "settings.set", {
        values: { who: "u1", tag: "l1" },
      }),
    ).toEqual({ ok: true, result: null });
    // The project's people, and the labels it shows.
    expect(db.projectMember.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { projectId: "p1" },
    });
    expect(db.label.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { hiddenIn: { none: { projectId: "p1" } } },
    });
    expect(
      await callBridge("u1", place, "settings.set", {
        values: { who: "stranger" },
      }),
    ).toEqual({ ok: false, error: "invalid_params" });
  });

  it("serves its section below the form, not a page (BARY-204)", async () => {
    db.pluginFile.findMany.mockResolvedValue([
      { name: "main.js", content: new TextEncoder().encode("x") },
    ]);
    withSettings({ settingsPage: "section" });
    expect(
      await getPluginFrame("u1", place, { kind: "settings", id: "section" }),
    ).not.toBeNull();
    expect(
      await getPluginFrame("u1", place, { kind: "settings", id: "settings" }),
    ).toBeNull();
  });

  it("refuses someone without plugin.enable, and a value that doesn't fit", async () => {
    withSettings();
    // Sees the project, may not change the plugin.
    can.mockImplementation(
      async (_u?: string, permission?: string) =>
        permission !== "plugin.enable",
    );
    expect(
      await callBridge("u1", place, "settings.set", { values: { zoom: 3 } }),
    ).toEqual({ ok: false, error: "forbidden" });
    can.mockImplementation(async () => true);
    expect(
      await callBridge("u1", place, "settings.set", {
        values: { zoom: "big" },
      }),
    ).toEqual({ ok: false, error: "invalid_params" });
  });

  it("serves its settings page only when it brings one", async () => {
    db.pluginFile.findMany.mockResolvedValue([
      { name: "main.js", content: new TextEncoder().encode("x") },
    ]);
    withSettings();
    expect(
      await getPluginFrame("u1", place, { kind: "settings", id: "settings" }),
    ).not.toBeNull();
    withSettings({ settingsPage: false });
    expect(
      await getPluginFrame("u1", place, { kind: "settings", id: "settings" }),
    ).toBeNull();
  });

  it("offers a place's plugin widgets with their capability confirmed", async () => {
    db.pluginActivation.findMany.mockResolvedValue([
      { pluginId: "timeline", capabilities: ["ui:dashboard-widget"] },
    ]);
    db.plugin.findMany.mockResolvedValue([
      {
        pluginId: "timeline",
        manifest: {
          ...manifest,
          capabilities: [...manifest.capabilities, "ui:dashboard-widget"],
          contributes: {
            ...manifest.contributes,
            dashboardWidgets: [{ id: "oldest", title: "Oldest open" }],
          },
        },
      },
    ]);
    expect(
      await getPluginWidgets({ workspaceId: "ws1", projectId: "p1" }),
    ).toEqual([
      {
        pluginId: "timeline",
        pluginName: "Timeline",
        widgetId: "oldest",
        title: "Oldest open",
      },
    ]);
  });

  it("offers a plugin's widget templates as custom widgets (BARY-203)", async () => {
    const withTemplates = {
      ...manifest,
      capabilities: [...manifest.capabilities, "ui:dashboard-widget"],
      contributes: {
        ...manifest.contributes,
        widgetTemplates: [
          {
            id: "bugs",
            title: "Open bugs",
            size: "M",
            blocks: [{ type: "kpi", config: { metric: "open" } }],
          },
        ],
      },
    };
    db.plugin.findMany.mockResolvedValue([
      { pluginId: "timeline", manifest: withTemplates },
    ]);
    db.pluginActivation.findMany.mockResolvedValue([
      { pluginId: "timeline", capabilities: ["ui:dashboard-widget"] },
    ]);
    const [entry] = await getPluginWidgets({
      workspaceId: "ws1",
      projectId: "p1",
    });
    expect(entry).toMatchObject({ widgetId: "bugs", title: "Open bugs" });
    expect(entry.template).toMatchObject({
      type: "blocks",
      size: "M",
      config: {
        title: "Open bugs",
        blocks: [{ id: "b1", type: "kpi", config: { metric: "open" } }],
      },
    });
    expect(parseWidgets([entry.template])).not.toBeNull();

    // Without the capability confirmed, nothing.
    db.pluginActivation.findMany.mockResolvedValue([
      { pluginId: "timeline", capabilities: [] },
    ]);
    expect(
      await getPluginWidgets({ workspaceId: "ws1", projectId: "p1" }),
    ).toEqual([]);
  });
});

describe("net.fetch (BARY-147)", () => {
  const withNetwork = (credentials: unknown[] = []) =>
    db.plugin.findFirst.mockResolvedValue({
      id: "row1",
      manifest: {
        ...manifest,
        network: ["api.acme.example"],
        contributes: { ...manifest.contributes, credentials },
      },
    });

  beforeEach(() => {
    sent.length = 0;
    dnsLookup.mockImplementation(async () => [
      { address: "93.184.216.34", family: 4 },
    ]);
    upstream = {
      status: 200,
      headers: { "content-type": "application/json" },
      body: '{"ok":1}',
    };
  });

  it("calls a host from network, at the address it checked", async () => {
    withNetwork();
    const res = await callBridge("u1", place, "net.fetch", {
      url: "https://api.acme.example/items",
      method: "POST",
      body: '{"a":1}',
    });
    expect(res).toEqual({
      ok: true,
      result: {
        status: 200,
        headers: { "content-type": "application/json" },
        text: '{"ok":1}',
      },
    });
    expect(sent[0]?.url).toBe("https://api.acme.example/items");
    expect(sent[0]?.pinned).toBe("93.184.216.34");
    expect(sent[0]?.body).toBe('{"a":1}');
  });

  it("refuses a host that isn't in network, or answers privately", async () => {
    withNetwork();
    expect(
      await callBridge("u1", place, "net.fetch", {
        url: "https://evil.example/",
      }),
    ).toEqual({ ok: false, error: "host_not_allowed" });
    dnsLookup.mockImplementation(async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ]);
    expect(
      await callBridge("u1", place, "net.fetch", {
        url: "https://api.acme.example/",
      }),
    ).toEqual({ ok: false, error: "host_not_allowed" });
    expect(sent).toHaveLength(0);
  });

  it("adds a kept credential itself, and refuses without one", async () => {
    withNetwork([
      {
        key: "token",
        label: "Token",
        level: "user",
        host: "api.acme.example",
        header: "PRIVATE-TOKEN",
        format: "{value}",
      },
    ]);
    db.pluginCredential.findUnique.mockResolvedValue(null);
    expect(
      await callBridge("u1", place, "net.fetch", {
        url: "https://api.acme.example/",
      }),
    ).toEqual({ ok: false, error: "credential_missing" });

    db.pluginCredential.findUnique.mockResolvedValue({
      valueCipher: sealSecret("glpat-secret", "plugin-credential"),
    });
    await callBridge("u1", place, "net.fetch", {
      url: "https://api.acme.example/",
      headers: { "PRIVATE-TOKEN": "from the plugin" },
    });
    const headers = sent[0]?.options.headers as Record<string, string>;
    expect(headers["private-token"]).toBe("glpat-secret");
    // Looked up as this person's own.
    expect(db.pluginCredential.findUnique.mock.calls.at(-1)?.[0]).toMatchObject(
      {
        where: { pluginId_scopeKey_key: { scopeKey: "us:u1", key: "token" } },
      },
    );
  });

  it("hands back a body that isn't text as base64", async () => {
    withNetwork();
    upstream = {
      status: 200,
      headers: { "content-type": "image/png" },
      body: "png",
    };
    const res = await callBridge("u1", place, "net.fetch", {
      url: "https://api.acme.example/logo.png",
    });
    expect(res).toMatchObject({
      ok: true,
      result: { base64: Buffer.from("png").toString("base64") },
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

describe("building blocks (BARY-205)", () => {
  const blocks = [
    {
      id: "due-soon",
      title: "Due soon",
      settings: [{ key: "days", type: "number", label: "Days", default: 7 }],
    },
    { id: "ring", title: "Done", draw: "plugin" },
  ];
  const withBlocks = {
    ...manifest,
    capabilities: [...manifest.capabilities, "ui:dashboard-widget"],
    contributes: { ...manifest.contributes, widgetBlocks: blocks },
  };

  it("says who draws a block, where it runs", async () => {
    db.pluginActivation.findUnique.mockResolvedValue({
      id: "act1",
      enabled: true,
      capabilities: ["issues:read", "ui:dashboard-widget"],
    });
    db.plugin.findFirst.mockResolvedValue({ id: "row1", manifest: withBlocks });
    expect(
      await getPluginSlotView("u1", place, { kind: "block", id: "due-soon" }),
    ).toEqual({ pluginName: "Timeline", title: "Due soon", draw: "barynt" });
    expect(
      await getPluginSlotView("u1", place, { kind: "block", id: "ring" }),
    ).toMatchObject({ draw: "plugin" });
    expect(
      await getPluginSlotView("u1", place, { kind: "block", id: "nope" }),
    ).toBeNull();
  });

  it("offers a place's blocks to the builder, with the capability confirmed", async () => {
    db.plugin.findMany.mockResolvedValue([
      { pluginId: "timeline", manifest: withBlocks },
    ]);
    db.pluginActivation.findMany.mockResolvedValue([
      { pluginId: "timeline", capabilities: ["ui:dashboard-widget"] },
    ]);
    const list = await getPluginBlocks({ workspaceId: "ws1", projectId: "p1" });
    expect(list.map((b) => [b.blockId, b.draw])).toEqual([
      ["ring", "plugin"],
      ["due-soon", "barynt"],
    ]);
    expect(list[1].settings[0]).toMatchObject({ key: "days", default: 7 });
    db.pluginActivation.findMany.mockResolvedValue([
      { pluginId: "timeline", capabilities: [] },
    ]);
    expect(
      await getPluginBlocks({ workspaceId: "ws1", projectId: "p1" }),
    ).toEqual([]);
  });
});

describe("issue panels (BARY-150)", () => {
  const withPanel = {
    ...manifest,
    capabilities: [...manifest.capabilities, "ui:issue-panel"],
    contributes: {
      ...manifest.contributes,
      issuePanels: [{ id: "schedule", title: "Schedule" }],
    },
  };

  it("lists a project's panels where they're confirmed", async () => {
    db.plugin.findMany.mockResolvedValue([
      { pluginId: "timeline", manifest: withPanel },
    ]);
    db.pluginActivation.findMany.mockResolvedValue([
      { pluginId: "timeline", capabilities: ["ui:issue-panel"] },
    ]);
    expect(
      await getPluginIssuePanels({ workspaceId: "ws1", projectId: "p-panels" }),
    ).toEqual([
      {
        pluginId: "timeline",
        pluginName: "Timeline",
        panelId: "schedule",
        title: "Schedule",
        placement: "main",
      },
    ]);
    expect(db.pluginActivation.findMany.mock.calls.at(-1)?.[0]).toMatchObject({
      where: { scopeKey: "pr:p-panels", enabled: true },
    });
    db.pluginActivation.findMany.mockResolvedValue([
      { pluginId: "timeline", capabilities: ["issues:read"] },
    ]);
    expect(
      await getPluginIssuePanels({ workspaceId: "ws1", projectId: "p-other" }),
    ).toEqual([]);
  });

  it("serves a panel's frame only with its capability", async () => {
    db.pluginFile.findMany.mockResolvedValue([
      { name: "main.js", content: new TextEncoder().encode("x") },
    ]);
    db.plugin.findFirst.mockResolvedValue({ id: "row1", manifest: withPanel });
    db.pluginActivation.findUnique.mockResolvedValue({
      id: "act1",
      enabled: true,
      capabilities: ["issues:read", "ui:issue-panel"],
    });
    expect(
      await getPluginFrame("u1", place, { kind: "issuePanel", id: "schedule" }),
    ).not.toBeNull();
    db.pluginActivation.findUnique.mockResolvedValue({
      id: "act1",
      enabled: true,
      capabilities: ["issues:read"],
    });
    expect(
      await getPluginFrame("u1", place, { kind: "issuePanel", id: "schedule" }),
    ).toBeNull();
  });
});

describe("badges (BARY-151)", () => {
  const withBadges = {
    ...manifest,
    capabilities: [...manifest.capabilities, "ui:issue-badge"],
    contributes: {
      ...manifest.contributes,
      issueBadges: [{ id: "due", title: "Due" }],
    },
  };

  it("names a project's badge plugins, and what they may read", async () => {
    db.project.findFirst.mockResolvedValue({ id: "p-badges", prefix: "WEB" });
    db.pluginActivation.findMany.mockResolvedValue([
      { pluginId: "timeline", capabilities: ["issues:read", "ui:issue-badge"] },
      { pluginId: "other", capabilities: ["issues:read"] },
    ]);
    db.plugin.findMany.mockResolvedValue([
      { pluginId: "timeline", manifest: withBadges },
    ]);
    expect(
      await getPluginBadgeProviders({ workspaceId: "ws1", projectSlug: "web" }),
    ).toEqual({
      projectId: "p-badges",
      prefix: "WEB",
      providers: [
        {
          pluginId: "timeline",
          pluginName: "Timeline",
          badges: [{ id: "due", title: "Due" }],
          canRead: true,
        },
      ],
    });
  });

  it("serves the badges frame only with the capability", async () => {
    db.pluginFile.findMany.mockResolvedValue([
      { name: "main.js", content: new TextEncoder().encode("x") },
    ]);
    db.plugin.findFirst.mockResolvedValue({ id: "row1", manifest: withBadges });
    db.pluginActivation.findUnique.mockResolvedValue({
      id: "act1",
      enabled: true,
      capabilities: ["ui:issue-badge"],
    });
    expect(
      await getPluginFrame("u1", place, { kind: "badges", id: "badges" }),
    ).not.toBeNull();
    db.pluginActivation.findUnique.mockResolvedValue({
      id: "act1",
      enabled: true,
      capabilities: [],
    });
    expect(
      await getPluginFrame("u1", place, { kind: "badges", id: "badges" }),
    ).toBeNull();
  });
});

describe("actions (BARY-152)", () => {
  const withActions = {
    ...manifest,
    capabilities: [...manifest.capabilities, "ui:action"],
    contributes: {
      ...manifest.contributes,
      actions: [
        { id: "rerun", title: "Re-run", icon: "lucide:rocket" },
        {
          id: "close",
          title: "Close",
          icon: "mdi:close",
          where: ["issueMenu"],
          confirm: "Sure?",
          danger: true,
        },
      ],
    },
  };

  it("offers a project's actions with ui:action confirmed", async () => {
    db.pluginActivation.findMany.mockResolvedValue([
      { pluginId: "timeline", capabilities: ["ui:action"] },
    ]);
    db.plugin.findMany.mockResolvedValue([
      { pluginId: "timeline", manifest: withActions },
    ]);
    const list = await getPluginIssueActions({
      workspaceId: "ws1",
      projectId: "p-actions",
    });
    expect(list.map((a) => [a.actionId, a.icon, a.where, a.confirm])).toEqual([
      ["close", "lucide:puzzle", ["issueMenu"], "Sure?"],
      [
        "rerun",
        "lucide:rocket",
        ["issueMenu", "cardMenu", "commandPalette"],
        null,
      ],
    ]);
  });

  it("serves the actions frame only with the capability", async () => {
    db.pluginFile.findMany.mockResolvedValue([
      { name: "main.js", content: new TextEncoder().encode("x") },
    ]);
    db.plugin.findFirst.mockResolvedValue({
      id: "row1",
      manifest: withActions,
    });
    db.pluginActivation.findUnique.mockResolvedValue({
      id: "act1",
      enabled: true,
      capabilities: ["ui:action"],
    });
    expect(
      await getPluginFrame("u1", place, { kind: "actions", id: "actions" }),
    ).not.toBeNull();
    db.pluginActivation.findUnique.mockResolvedValue({
      id: "act1",
      enabled: true,
      capabilities: [],
    });
    expect(
      await getPluginFrame("u1", place, { kind: "actions", id: "actions" }),
    ).toBeNull();
  });
});
