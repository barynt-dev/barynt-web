import { describe, expect, it } from "bun:test";
import {
  pluginPath,
  pluginSettingsPath,
  pluginStorePath,
  pluginsPath,
  withQuery,
} from "@/lib/nav";
import { defaultLevel } from "@/lib/plugins/levels";

// The plugins' area and the store beside it (BARY-238).

describe("plugin paths", () => {
  it("puts the store at /store and every plugin's levels under /plugins", () => {
    expect(pluginStorePath("ws", { plugin: "github" })).toBe(
      "/ws/store?plugin=github",
    );
    expect(pluginsPath("ws")).toBe("/ws/plugins");
    expect(pluginPath("ws", "github")).toBe("/ws/plugins/github");
    expect(pluginPath("ws", "github", { kind: "personal" })).toBe(
      "/ws/plugins/github/personal",
    );
    expect(pluginPath("ws", "github", { kind: "project", slug: "web" })).toBe(
      "/ws/plugins/github/project/web",
    );
    expect(pluginSettingsPath("ws", null, "github")).toBe(
      "/ws/plugins/github/workspace",
    );
  });

  it("keeps a query through a redirect", () => {
    expect(withQuery("/a", { github: "connected", x: undefined })).toBe(
      "/a?github=connected",
    );
    expect(withQuery("/a", {})).toBe("/a");
    expect(withQuery("/a", { k: ["1", "2"] })).toBe("/a?k=1&k=2");
  });
});

describe("defaultLevel()", () => {
  const reach = {
    personal: true,
    workspace: true,
    projects: [
      { slug: "a", on: false },
      { slug: "b", on: true },
    ],
  };

  it("opens a project it's on in first", () => {
    expect(defaultLevel(reach)).toEqual({ kind: "project", slug: "b" });
  });

  it("falls back to the workspace, then to what's yours", () => {
    expect(defaultLevel({ ...reach, projects: [] })).toEqual({
      kind: "workspace",
    });
    expect(defaultLevel({ ...reach, projects: [], workspace: false })).toEqual({
      kind: "personal",
    });
    expect(
      defaultLevel({ personal: false, workspace: false, projects: [] }),
    ).toBeNull();
  });
});
