import { describe, expect, it } from "bun:test";
import { validateManifest } from "@/lib/plugins/manifest";
import { slotEntries, slotKindOfPath } from "@/lib/plugins/slots";

// The places a sandboxed plugin fills (BARY-148).

const parsed = validateManifest({
  id: "timeline",
  name: "Timeline",
  version: "1.0.0",
  minBaryntVersion: "0.1.0",
  author: "Acme",
  description: "Issues on a time line.",
  license: "MIT",
  kind: "sandbox",
  levels: ["workspace", "project"],
  capabilities: ["issues:read", "ui:project-view", "ui:nav-item"],
  network: [],
  contributes: {
    projectViews: [{ id: "timeline", title: "Timeline", icon: "lucide:clock" }],
    navItems: [{ id: "roadmap", title: "Roadmap" }],
  },
});
if (!parsed.ok) throw new Error("fixture");
const manifest = parsed.manifest;

describe("slotEntries", () => {
  it("lists what the plugin fills, with its capability confirmed", () => {
    expect(slotEntries(manifest, ["ui:project-view", "ui:nav-item"])).toEqual([
      {
        kind: "projectView",
        id: "timeline",
        title: "Timeline",
        icon: "lucide:clock",
      },
      { kind: "page", id: "roadmap", title: "Roadmap", icon: null },
    ]);
  });

  it("leaves out a slot whose capability wasn't confirmed here", () => {
    expect(
      slotEntries(manifest, ["ui:project-view"]).map((e) => e.kind),
    ).toEqual(["projectView"]);
    expect(slotEntries(manifest, [])).toEqual([]);
  });

  it("fills nothing for a plugin without code", () => {
    expect(
      slotEntries({ ...manifest, kind: "service" }, ["ui:project-view"]),
    ).toEqual([]);
  });

  it("knows a slot by its address segment only", () => {
    expect(slotKindOfPath("view")).toBe("projectView");
    expect(slotKindOfPath("page")).toBe("page");
    expect(slotKindOfPath("settings")).toBeNull();
  });
});
