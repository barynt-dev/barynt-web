import { beforeEach, describe, expect, it, mock } from "bun:test";

// The plugin lifecycle's server actions (BARY-142), with the database, the
// permission check, the audit log and the directory client mocked away. Own
// process: it replaces `@/lib/permissions` and `@/lib/audit`.

const tx = {
  plugin: { updateMany: mock(), create: mock() },
};

mock.module("@/lib/db", () => ({
  db: {
    plugin: {
      findMany: mock(),
      findFirst: mock(),
      count: mock(),
      update: mock(),
      deleteMany: mock(),
    },
    pluginSource: {
      findUnique: mock(),
      create: mock(),
      update: mock(),
      delete: mock(),
    },
    pluginActivation: {
      upsert: mock(),
      updateMany: mock(),
      deleteMany: mock(),
      findUnique: mock(),
    },
    pluginSettings: { upsert: mock() },
    pluginCredential: { upsert: mock(), deleteMany: mock() },
    pluginGrant: { findUnique: mock(), upsert: mock(), deleteMany: mock() },
    project: { findUnique: mock() },
    $transaction: mock(async (arg: unknown) =>
      typeof arg === "function"
        ? (arg as (t: typeof tx) => unknown)(tx)
        : Promise.all(arg as Promise<unknown>[]),
    ),
  },
}));

class PermissionError extends Error {}
mock.module("@/lib/permissions", () => ({
  PLATFORM: { scope: "platform" },
  requirePermission: mock(async () => "admin-1"),
  currentUserId: mock(async () => "person-1"),
  PermissionError,
}));
mock.module("@/lib/audit", () => ({ recordAudit: mock(async () => {}) }));
mock.module("next/cache", () => ({ revalidatePath: mock() }));
mock.module("@/features/plugins/directory", () => ({
  fetchRelease: mock(),
  readDirectory: mock(),
  forgetSource: mock(),
  sealSourceToken: (t: string) => `sealed(${t})`,
}));

import {
  activatePlugin,
  addPluginSource,
  checkPluginSource,
  deactivatePlugin,
  installPlugin,
  previewRelease,
  removePluginCredential,
  rollbackPlugin,
  savePluginCredential,
  savePluginSettings,
  setPluginBlocked,
  setPluginGrant,
  uninstallPlugin,
  updatePluginSource,
} from "@/features/plugins/actions";
import { fetchRelease, readDirectory } from "@/features/plugins/directory";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";

type M = ReturnType<typeof mock>;
const plugin = db.plugin as unknown as Record<string, M>;
const source = db.pluginSource as unknown as Record<string, M>;
const activation = db.pluginActivation as unknown as Record<string, M>;
const settingsRow = db.pluginSettings as unknown as Record<string, M>;
const grant = db.pluginGrant as unknown as Record<string, M>;
const credential = db.pluginCredential as unknown as Record<string, M>;
const project = db.project.findUnique as unknown as M;
const perm = requirePermission as unknown as M;
const audit = recordAudit as unknown as M;
const release = fetchRelease as unknown as M;

const manifest = {
  id: "gantt-timeline",
  name: "Gantt Timeline",
  version: "1.1.0",
  minBaryntVersion: "0.9.0",
  author: "Acme",
  description: "Issues on a time line.",
  license: "MIT",
  kind: "sandbox",
  levels: ["project"],
  capabilities: ["issues:read", "ui:project-view"],
  network: [],
  contributes: { projectViews: [{ id: "timeline", title: "Timeline" }] },
};

const okRelease = {
  ok: true,
  manifest,
  hash: "f".repeat(64),
  files: {
    "manifest.json": new Uint8Array([1]),
    "main.js": new Uint8Array([1, 2, 3]),
  },
};

beforeEach(() => {
  for (const group of [
    plugin,
    source,
    activation,
    grant,
    settingsRow,
    credential,
    tx.plugin,
  ])
    for (const fn of Object.values(group)) (fn as M).mockReset();
  project.mockReset();
  audit.mockClear();
  release.mockReset();
  perm.mockReset();
  perm.mockImplementation(async () => "admin-1");
  tx.plugin.create.mockResolvedValue({ id: "row-1" });
  // Released for projects unless a test says otherwise.
  grant.findUnique.mockResolvedValue({ pluginId: "gantt-timeline" });
});

describe("sources", () => {
  it("adds an https source with a sealed token", async () => {
    source.findUnique.mockResolvedValue(null);
    source.create.mockResolvedValue({ id: "s1", tokenCipher: "sealed(t)" });
    const result = await addPluginSource({
      name: "Acme",
      url: "https://example.com/plugins.json",
      token: " t ",
    });
    expect(result).toEqual({ ok: true, id: "s1" });
    expect(perm).toHaveBeenCalledWith("plugin.manage", { scope: "platform" });
    expect(source.create.mock.calls[0][0].data.tokenCipher).toBe("sealed(t)");
    expect(audit.mock.calls[0][0].action).toBe("plugin.source.added");
  });

  it("refuses plain http and a duplicate", async () => {
    expect(
      await addPluginSource({ name: "A", url: "http://example.com/p.json" }),
    ).toEqual({ error: "invalid_url" });
    source.findUnique.mockResolvedValue({ id: "s0" });
    expect(
      await addPluginSource({ name: "A", url: "https://example.com/p.json" }),
    ).toEqual({ error: "source_exists" });
  });

  it("stores a Git repository normalized, with its provider (BARY-198)", async () => {
    source.findUnique.mockResolvedValue(null);
    source.create.mockResolvedValue({ id: "s2", tokenCipher: null });
    await addPluginSource({
      name: "Acme",
      url: " https://gitlab.acme.dev/team/plugins.git ",
      ref: "release",
    });
    const data = source.create.mock.calls[0][0].data;
    expect(data.url).toBe("https://gitlab.acme.dev/team/plugins");
    expect(data.provider).toBe("gitlab");
    expect(data.ref).toBe("release");
  });

  it("asks for the provider when the host doesn't tell", async () => {
    expect(
      await addPluginSource({ name: "A", url: "https://git.acme.dev/t/p" }),
    ).toEqual({ error: "provider_required" });
    source.findUnique.mockResolvedValue(null);
    source.create.mockResolvedValue({ id: "s3", tokenCipher: null });
    await addPluginSource({
      name: "A",
      url: "https://git.acme.dev/t/p",
      provider: "gitea",
    });
    expect(source.create.mock.calls[0][0].data.provider).toBe("gitea");
    expect(
      await addPluginSource({
        name: "A",
        url: "https://gitlab.com/t/p",
        ref: "main; rm",
      }),
    ).toEqual({ error: "invalid_ref" });
  });

  it("checks a source before it's saved", async () => {
    (readDirectory as ReturnType<typeof mock>).mockResolvedValue({
      ok: true,
      entries: [
        { versions: { "1.0.0": "a", "1.1.0": "b" } },
        { versions: { "2.0.0": "c" } },
      ],
      issues: [],
    });
    expect(
      await checkPluginSource({
        url: "https://codeberg.org/n/plugins",
        token: " t ",
      }),
    ).toEqual({
      ok: true,
      provider: "gitea",
      plugins: 2,
      versions: 3,
      skipped: 0,
    });
    expect((readDirectory as ReturnType<typeof mock>).mock.calls[0][0]).toEqual(
      {
        url: "https://codeberg.org/n/plugins",
        provider: "gitea",
        ref: null,
        token: "t",
      },
    );
    expect(source.create).not.toHaveBeenCalled();
  });

  it("never writes the token into the audit log", async () => {
    source.findUnique.mockResolvedValue({ id: "s1", name: "Acme" });
    await updatePluginSource("s1", { token: "ghp_secret" });
    expect(JSON.stringify(audit.mock.calls[0][0])).not.toContain("ghp_secret");
    expect(audit.mock.calls[0][0].meta.token).toBe("set");
  });

  it("fails closed without the permission", async () => {
    perm.mockImplementation(async () => {
      throw new PermissionError("plugin.manage");
    });
    await expect(
      addPluginSource({ name: "A", url: "https://example.com/p.json" }),
    ).rejects.toThrow();
    expect(source.create).not.toHaveBeenCalled();
  });
});

describe("installPlugin", () => {
  const input = {
    sourceId: "s1",
    pluginId: "gantt-timeline",
    version: "1.1.0",
    capabilities: ["ui:project-view", "issues:read"],
  };

  it("installs a checked release with confirmed capabilities", async () => {
    plugin.findMany.mockResolvedValue([]);
    release.mockResolvedValue(okRelease);
    const result = await installPlugin(input);
    expect(result).toEqual({ ok: true, id: "row-1", updatedFrom: null });
    const data = tx.plugin.create.mock.calls[0][0].data;
    expect(data.hash).toBe("f".repeat(64));
    // The manifest is stored as a column, only code and styles as files.
    expect(data.files.create.map((f: { name: string }) => f.name)).toEqual([
      "main.js",
    ]);
    expect(audit.mock.calls[0][0].action).toBe("plugin.installed");
  });

  it("stores the preview images with the version (BARY-199)", async () => {
    plugin.findMany.mockResolvedValue([]);
    release.mockResolvedValue({
      ...okRelease,
      files: { ...okRelease.files, "preview-1.png": new Uint8Array([9]) },
    });
    await installPlugin(input);
    const data = tx.plugin.create.mock.calls[0][0].data;
    expect(data.files.create.map((f: { name: string }) => f.name)).toEqual([
      "main.js",
      "preview-1.png",
    ]);
  });

  it("shows a release's previews before it's installed", async () => {
    release.mockResolvedValue({
      ...okRelease,
      manifest: {
        ...manifest,
        previews: [{ file: "preview-1.png", title: "Board" }],
      },
      files: { ...okRelease.files, "preview-1.png": new Uint8Array([9]) },
    });
    const result = await previewRelease(input);
    expect("preview" in result && result.preview.previews).toEqual([
      { title: "Board", src: "data:image/png;base64,CQ==" },
    ]);
  });

  it("is an update when another version is active", async () => {
    plugin.findMany.mockResolvedValue([{ version: "1.0.0", status: "active" }]);
    release.mockResolvedValue(okRelease);
    const result = await installPlugin(input);
    expect(result).toMatchObject({ ok: true, updatedFrom: "1.0.0" });
    expect(tx.plugin.updateMany.mock.calls[0][0]).toEqual({
      where: { pluginId: "gantt-timeline", status: "active" },
      data: { status: "superseded" },
    });
    expect(audit.mock.calls[0][0]).toMatchObject({
      action: "plugin.updated",
      meta: { from: "1.0.0", version: "1.1.0" },
    });
  });

  it("refuses unless the capabilities were confirmed exactly", async () => {
    plugin.findMany.mockResolvedValue([]);
    release.mockResolvedValue(okRelease);
    expect(
      await installPlugin({ ...input, capabilities: ["issues:read"] }),
    ).toEqual({ error: "capabilities_not_confirmed" });
    expect(tx.plugin.create).not.toHaveBeenCalled();
  });

  it("passes on what the directory client refused", async () => {
    plugin.findMany.mockResolvedValue([]);
    release.mockResolvedValue({ ok: false, error: "hash_mismatch" });
    expect(await installPlugin(input)).toEqual({ error: "hash_mismatch" });
    expect(tx.plugin.create).not.toHaveBeenCalled();
  });

  it("won't install a version twice or a blocked plugin", async () => {
    plugin.findMany.mockResolvedValue([{ version: "1.1.0", status: "active" }]);
    expect(await installPlugin(input)).toEqual({ error: "already_installed" });
    plugin.findMany.mockResolvedValue([
      { version: "1.0.0", status: "blocked" },
    ]);
    expect(await installPlugin(input)).toEqual({ error: "blocked" });
    expect(release).not.toHaveBeenCalled();
  });
});

describe("rollback, block, uninstall", () => {
  it("rolls back to the version before", async () => {
    plugin.findMany.mockResolvedValue([
      { version: "1.0.0", status: "superseded" },
      { version: "1.1.0", status: "active" },
    ]);
    plugin.findFirst.mockResolvedValue({ manifest });
    expect(await rollbackPlugin("gantt-timeline")).toEqual({
      ok: true,
      version: "1.0.0",
    });
    expect(plugin.update.mock.calls.map((c) => c[0].data.status)).toEqual([
      "superseded",
      "active",
    ]);
    expect(audit.mock.calls[0][0]).toMatchObject({
      action: "plugin.rolledback",
      meta: { from: "1.1.0", to: "1.0.0" },
    });
  });

  it("blocks the active version and unblocks the newest blocked one", async () => {
    plugin.findMany.mockResolvedValue([{ version: "1.1.0", status: "active" }]);
    await setPluginBlocked("gantt-timeline", true);
    expect(plugin.update.mock.calls[0][0].data.status).toBe("blocked");
    plugin.findMany.mockResolvedValue([
      { version: "1.1.0", status: "blocked" },
    ]);
    await setPluginBlocked("gantt-timeline", false);
    expect(plugin.update.mock.calls[1][0].data.status).toBe("active");
    expect(audit.mock.calls.map((c) => c[0].action)).toEqual([
      "plugin.blocked",
      "plugin.unblocked",
    ]);
  });

  it("keeps the activations switched off unless data is to go", async () => {
    plugin.count.mockResolvedValue(2);
    plugin.deleteMany.mockResolvedValue({ count: 2 });
    activation.updateMany.mockResolvedValue({ count: 3 });
    await uninstallPlugin("gantt-timeline", { deleteData: false });
    expect(activation.updateMany).toHaveBeenCalledWith({
      where: { pluginId: "gantt-timeline" },
      data: { enabled: false },
    });
    expect(activation.deleteMany).not.toHaveBeenCalled();

    activation.deleteMany.mockResolvedValue({ count: 3 });
    await uninstallPlugin("gantt-timeline", { deleteData: true });
    expect(activation.deleteMany).toHaveBeenCalledWith({
      where: { pluginId: "gantt-timeline" },
    });
  });

  it("changes nothing for a plugin that isn't installed", async () => {
    plugin.count.mockResolvedValue(0);
    expect(await uninstallPlugin("nope", { deleteData: true })).toEqual({
      error: "not_found",
    });
    expect(activation.deleteMany).not.toHaveBeenCalled();
  });
});

describe("activations", () => {
  const caps = ["issues:read", "ui:project-view"];

  it("switches on in a project, checked in that project", async () => {
    project.mockResolvedValue({ workspaceId: "ws-1" });
    plugin.findFirst.mockResolvedValue({ manifest });
    const result = await activatePlugin({
      pluginId: "gantt-timeline",
      workspaceId: "ws-other",
      projectId: "p1",
      capabilities: caps,
    });
    expect(result).toEqual({ ok: true });
    expect(perm).toHaveBeenCalledWith("plugin.enable", { projectId: "p1" });
    const upsert = activation.upsert.mock.calls[0][0];
    // The workspace comes from the project, not from the caller.
    expect(upsert.create).toMatchObject({
      workspaceId: "ws-1",
      projectId: "p1",
      scopeKey: "pr:p1",
      capabilities: manifest.capabilities,
    });
    expect(audit.mock.calls[0][0]).toMatchObject({
      action: "plugin.activated",
      workspaceId: "ws-1",
      projectId: "p1",
    });
  });

  it("refuses a level the manifest doesn't name", async () => {
    plugin.findFirst.mockResolvedValue({ manifest });
    expect(
      await activatePlugin({
        pluginId: "gantt-timeline",
        workspaceId: "ws-1",
        capabilities: caps,
      }),
    ).toEqual({ error: "level_not_allowed" });
    expect(perm).toHaveBeenCalledWith("plugin.enable", { workspaceId: "ws-1" });
  });

  it("refuses an unconfirmed capability and a plugin that isn't active", async () => {
    project.mockResolvedValue({ workspaceId: "ws-1" });
    plugin.findFirst.mockResolvedValue({ manifest });
    expect(
      await activatePlugin({
        pluginId: "gantt-timeline",
        workspaceId: "ws-1",
        projectId: "p1",
        capabilities: ["issues:read"],
      }),
    ).toEqual({ error: "capabilities_not_confirmed" });
    plugin.findFirst.mockResolvedValue(null);
    expect(
      await activatePlugin({
        pluginId: "gantt-timeline",
        workspaceId: "ws-1",
        projectId: "p1",
        capabilities: caps,
      }),
    ).toEqual({ error: "not_installed" });
    expect(activation.upsert).not.toHaveBeenCalled();
  });

  it("switches off, keeping the data", async () => {
    activation.updateMany.mockResolvedValue({ count: 1 });
    plugin.findFirst.mockResolvedValue({ manifest });
    expect(
      await deactivatePlugin({
        pluginId: "gantt-timeline",
        workspaceId: "ws-1",
      }),
    ).toEqual({ ok: true });
    expect(activation.updateMany).toHaveBeenCalledWith({
      where: { pluginId: "gantt-timeline", scopeKey: "ws:ws-1" },
      data: { enabled: false },
    });
  });

  it("needs the workspace's release for a project", async () => {
    project.mockResolvedValue({ workspaceId: "ws-1" });
    plugin.findFirst.mockResolvedValue({ manifest });
    grant.findUnique.mockResolvedValue(null);
    expect(
      await activatePlugin({
        pluginId: "gantt-timeline",
        workspaceId: "ws-1",
        projectId: "p1",
        capabilities: caps,
      }),
    ).toEqual({ error: "not_granted" });
    expect(grant.findUnique).toHaveBeenCalledWith({
      where: {
        pluginId_workspaceId: {
          pluginId: "gantt-timeline",
          workspaceId: "ws-1",
        },
      },
    });
    expect(activation.upsert).not.toHaveBeenCalled();
  });
});

describe("settings (BARY-201)", () => {
  const withSettings = {
    ...manifest,
    contributes: {
      ...manifest.contributes,
      settings: [
        { key: "channel", type: "text", label: "Channel" },
        { key: "loud", type: "boolean", label: "Loud" },
      ],
    },
  };

  it("saves what the manifest declares, checked where it's on", async () => {
    project.mockResolvedValue({ workspaceId: "ws-1" });
    activation.findUnique.mockResolvedValue({ id: "act-1" });
    plugin.findFirst.mockResolvedValue({ manifest: withSettings });
    const result = await savePluginSettings({
      pluginId: "gantt-timeline",
      workspaceId: "ws-other",
      projectId: "p1",
      values: { channel: " #dev ", loud: true, sneaky: "x" },
    });
    expect(result).toEqual({ ok: true });
    expect(perm).toHaveBeenCalledWith("plugin.enable", { projectId: "p1" });
    expect(activation.findUnique.mock.calls[0][0].where).toEqual({
      pluginId_scopeKey: { pluginId: "gantt-timeline", scopeKey: "pr:p1" },
    });
    expect(settingsRow.upsert.mock.calls[0][0].update).toEqual({
      values: { channel: "#dev", loud: true },
    });
    // Which keys, never what they hold.
    expect(audit.mock.calls[0][0]).toMatchObject({
      action: "plugin.settings.updated",
      meta: { keys: ["channel", "loud"] },
    });
    expect(JSON.stringify(audit.mock.calls[0][0])).not.toContain("#dev");
  });

  it("refuses a value the manifest doesn't allow, and a plugin that's off", async () => {
    activation.findUnique.mockResolvedValue({ id: "act-1" });
    plugin.findFirst.mockResolvedValue({ manifest: withSettings });
    expect(
      await savePluginSettings({
        pluginId: "gantt-timeline",
        workspaceId: "ws-1",
        values: { loud: "very" },
      }),
    ).toEqual({ error: "invalid_setting" });
    activation.findUnique.mockResolvedValue(null);
    expect(
      await savePluginSettings({
        pluginId: "gantt-timeline",
        workspaceId: "ws-1",
        values: {},
      }),
    ).toEqual({ error: "not_activated" });
    expect(settingsRow.upsert).not.toHaveBeenCalled();
  });
});

describe("credentials (BARY-147)", () => {
  const withCredentials = {
    ...manifest,
    network: ["gitlab.example.com"],
    contributes: {
      ...manifest.contributes,
      credentials: [
        {
          key: "token",
          label: "Token",
          level: "user",
          host: "gitlab.example.com",
        },
        {
          key: "shared",
          label: "Shared",
          level: "project",
          host: "gitlab.example.com",
        },
      ],
    },
  };
  const ids = { pluginId: "gantt-timeline", workspaceId: "ws-1" };

  it("keeps a person's own credential sealed, without asking for a permission", async () => {
    plugin.findFirst.mockResolvedValue({ manifest: withCredentials });
    const result = await savePluginCredential({
      ...ids,
      key: "token",
      value: "  glpat-1  ",
    });
    expect(result).toEqual({ ok: true });
    const upsert = credential.upsert.mock.calls[0]?.[0] as {
      where: { pluginId_scopeKey_key: { scopeKey: string } };
      create: { valueCipher: string };
    };
    expect(upsert.where.pluginId_scopeKey_key.scopeKey).toBe("us:person-1");
    // Sealed, never the plain value.
    expect(upsert.create.valueCipher).not.toContain("glpat-1");
    expect(perm).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("keeps a project's credential for plugin.enable in the project, and logs which", async () => {
    plugin.findFirst.mockResolvedValue({ manifest: withCredentials });
    project.mockResolvedValue({ workspaceId: "ws-1" });
    await savePluginCredential({
      ...ids,
      projectId: "p-1",
      key: "shared",
      value: "x",
    });
    expect(perm.mock.calls[0]).toEqual(["plugin.enable", { projectId: "p-1" }]);
    expect(credential.upsert.mock.calls[0]?.[0]).toMatchObject({
      create: { scopeKey: "pr:p-1" },
    });
    expect(audit.mock.calls[0]?.[0]).toMatchObject({
      action: "plugin.credential.set",
      meta: { key: "shared" },
    });
    expect(JSON.stringify(audit.mock.calls[0]?.[0])).not.toContain('"x"');
  });

  it("refuses a credential the plugin doesn't declare, or an empty value", async () => {
    plugin.findFirst.mockResolvedValue({ manifest: withCredentials });
    expect(
      await savePluginCredential({ ...ids, key: "other", value: "x" }),
    ).toEqual({ error: "not_found" });
    expect(
      await savePluginCredential({ ...ids, key: "token", value: "   " }),
    ).toEqual({ error: "invalid_setting" });
    expect(credential.upsert).not.toHaveBeenCalled();
  });

  it("removes one", async () => {
    plugin.findFirst.mockResolvedValue({ manifest: withCredentials });
    expect(await removePluginCredential({ ...ids, key: "token" })).toEqual({
      ok: true,
    });
    expect(credential.deleteMany.mock.calls[0]?.[0]).toEqual({
      where: {
        pluginId: "gantt-timeline",
        scopeKey: "us:person-1",
        key: "token",
      },
    });
  });
});

describe("release for projects (BARY-143)", () => {
  it("grants a plugin that works in projects, checked in the workspace", async () => {
    plugin.findFirst.mockResolvedValue({ manifest });
    expect(
      await setPluginGrant({
        pluginId: "gantt-timeline",
        workspaceId: "ws-1",
        granted: true,
      }),
    ).toEqual({ ok: true });
    expect(perm).toHaveBeenCalledWith("plugin.enable", { workspaceId: "ws-1" });
    expect(grant.upsert.mock.calls[0][0].create).toMatchObject({
      pluginId: "gantt-timeline",
      workspaceId: "ws-1",
      grantedById: "admin-1",
    });
    expect(audit.mock.calls[0][0].action).toBe("plugin.granted");
  });

  it("won't grant a plugin that has no project level", async () => {
    plugin.findFirst.mockResolvedValue({
      manifest: { ...manifest, levels: ["workspace"], contributes: {} },
    });
    expect(
      await setPluginGrant({
        pluginId: "gantt-timeline",
        workspaceId: "ws-1",
        granted: true,
      }),
    ).toEqual({ error: "level_not_allowed" });
    expect(grant.upsert).not.toHaveBeenCalled();
  });

  it("taking it back switches the projects off, keeping their data", async () => {
    grant.deleteMany.mockResolvedValue({ count: 1 });
    activation.updateMany.mockResolvedValue({ count: 2 });
    plugin.findFirst.mockResolvedValue({ manifest });
    await setPluginGrant({
      pluginId: "gantt-timeline",
      workspaceId: "ws-1",
      granted: false,
    });
    expect(activation.updateMany).toHaveBeenCalledWith({
      where: {
        pluginId: "gantt-timeline",
        workspaceId: "ws-1",
        projectId: { not: null },
      },
      data: { enabled: false },
    });
    expect(activation.deleteMany).not.toHaveBeenCalled();
    expect(audit.mock.calls[0][0]).toMatchObject({
      action: "plugin.grant.revoked",
      meta: { projectsSwitchedOff: 2 },
    });
  });
});
