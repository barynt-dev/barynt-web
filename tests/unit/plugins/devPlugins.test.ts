import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A plugin loaded from a local folder (BARY-221): read and checked like a
// release minus the hash, its row kept in step when the folder changes.

const updates: { where: unknown; data: Record<string, unknown> }[] = [];
mock.module("@/lib/db", () => ({
  db: {
    plugin: {
      update: async (args: { where: unknown; data: Record<string, unknown> }) =>
        updates.push(args),
    },
  },
}));

import { readDevPlugin, syncDevPlugin } from "@/features/plugins/dev";
import { pluginDevSources } from "@/lib/plugins/dev";

const dir = mkdtempSync(join(tmpdir(), "barynt-dev-plugin-"));
const manifest = (over: Record<string, unknown> = {}) => ({
  id: "open-issues",
  name: "Open Issues",
  version: "0.1.0",
  minBaryntVersion: "0.1.0",
  author: "You",
  description: { short: "The project's open issues." },
  license: "MIT",
  kind: "sandbox",
  levels: ["project"],
  capabilities: [],
  network: [],
  ...over,
});
const write = (m: unknown, code: string | null = "export default 1;") => {
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(m));
  if (code === null) rmSync(join(dir, "main.js"), { force: true });
  else writeFileSync(join(dir, "main.js"), code);
};

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.PLUGIN_DEV_DIRS;
});
beforeEach(() => {
  updates.length = 0;
  process.env.PLUGIN_DEV_DIRS = `${dir}, http://localhost:5173/ ,https://example.com/x, relative/path`;
});

describe("PLUGIN_DEV_DIRS", () => {
  it("takes absolute folders and localhost servers, nothing else", () => {
    expect(pluginDevSources()).toEqual([dir, "http://localhost:5173"]);
  });
});

describe("readDevPlugin", () => {
  it("reads a folder's build output and checks its manifest", async () => {
    write(manifest());
    const read = await readDevPlugin(dir);
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.manifest.id).toBe("open-issues");
      expect(read.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("finds the build output in the folder's dist/", async () => {
    write(manifest(), null);
    mkdirSync(join(dir, "dist"), { recursive: true });
    writeFileSync(join(dir, "dist", "main.js"), "export default 2;");
    expect((await readDevPlugin(dir)).ok).toBe(true);
    rmSync(join(dir, "dist"), { recursive: true });
  });

  it("names what's wrong", async () => {
    write(manifest({ version: "one" }));
    const bad = await readDevPlugin(dir);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]).toStartWith("version:");

    write(manifest(), null);
    expect(await readDevPlugin(dir)).toEqual({
      ok: false,
      errors: ["main.js: not found"],
    });
    expect(await readDevPlugin(join(dir, "nowhere"))).toEqual({
      ok: false,
      errors: ["manifest.json: not found"],
    });
  });

  it("puts the page text file in its place (BARY-237)", async () => {
    const m = manifest({ description: { short: "Open.", about: "about.md" } });
    write(m);
    rmSync(join(dir, "about.md"), { force: true });
    expect(await readDevPlugin(dir)).toEqual({
      ok: false,
      errors: ["about.md: not found"],
    });
    writeFileSync(join(dir, "about.md"), "## Why\n\nBecause.\n");
    const read = await readDevPlugin(dir);
    expect(read.ok && read.manifest.description).toEqual({
      short: "Open.",
      about: "## Why\n\nBecause.",
    });
    rmSync(join(dir, "about.md"));
  });
});

describe("syncDevPlugin", () => {
  const row = { id: "row-1", pluginId: "open-issues", hash: "old" };

  it("updates the row when the folder changed, and only then", async () => {
    write(manifest({ version: "0.2.0", capabilities: ["issues:read"] }));
    const read = await syncDevPlugin({ ...row, devSource: dir });
    expect(read.ok).toBe(true);
    expect(updates).toHaveLength(1);
    expect(updates[0].data.version).toBe("0.2.0-dev");
    expect(
      (updates[0].data.manifest as { capabilities: string[] }).capabilities,
    ).toEqual(["issues:read"]);

    if (read.ok)
      await syncDevPlugin({ ...row, hash: read.fingerprint, devSource: dir });
    expect(updates).toHaveLength(1);
  });

  it("keeps the row as it was for another plugin or an unlisted folder", async () => {
    write(manifest({ id: "someone-else" }));
    expect(await syncDevPlugin({ ...row, devSource: dir })).toEqual({
      ok: false,
      errors: ["id: expected open-issues"],
    });
    process.env.PLUGIN_DEV_DIRS = "";
    expect((await syncDevPlugin({ ...row, devSource: dir })).ok).toBe(false);
    expect(updates).toHaveLength(0);
  });
});
