import { describe, expect, it } from "bun:test";
import { validateManifest } from "@/lib/plugins/manifest";
import { settingLabelsOf } from "@/lib/plugins/setting-labels";

// What the settings search finds on a plugin's page: its form's fields and
// the credentials kept at that level, by the labels the page shows.

const plugin = {
  id: "tracker",
  name: "Tracker",
  version: "1.0.0",
  minBaryntVersion: "0.1.0",
  author: "Barynt",
  description: { short: "Tracks things." },
  license: "MIT",
  kind: "sandbox",
  levels: ["workspace", "project"],
  capabilities: ["issues:read"],
  network: ["api.example.com"],
  contributes: {
    settings: [
      { key: "prefix", type: "text", label: "Branch prefix" },
      { key: "auto", type: "boolean", label: "Link on its own" },
    ],
    credentials: [
      {
        key: "token",
        label: "Access token",
        level: "project",
        host: "api.example.com",
      },
      {
        key: "mine",
        label: "Personal token",
        level: "user",
        host: "api.example.com",
      },
    ],
  },
};

describe("settingLabelsOf", () => {
  it("is a valid manifest", () => {
    const r = validateManifest(plugin);
    expect(r.ok ? [] : r.errors).toEqual([]);
  });

  it("lists the form's fields and the level's credentials", () => {
    expect(settingLabelsOf(plugin, "project")).toEqual([
      "Branch prefix",
      "Link on its own",
      "Access token",
    ]);
    expect(settingLabelsOf(plugin, "workspace")).toEqual([
      "Branch prefix",
      "Link on its own",
    ]);
  });

  it("has only the person's credentials in the personal settings", () => {
    expect(settingLabelsOf(plugin, "user")).toEqual(["Personal token"]);
  });

  it("leaves out the form of a plugin that draws its whole page itself", () => {
    const own = {
      ...plugin,
      contributes: { ...plugin.contributes, settingsPage: true },
    };
    expect(settingLabelsOf(own, "project")).toEqual(["Access token"]);
    const section = {
      ...plugin,
      contributes: { ...plugin.contributes, settingsPage: "section" },
    };
    expect(settingLabelsOf(section, "project")).toHaveLength(3);
  });

  it("finds nothing in a broken manifest", () => {
    expect(settingLabelsOf({ id: 1 }, "project")).toEqual([]);
  });
});
