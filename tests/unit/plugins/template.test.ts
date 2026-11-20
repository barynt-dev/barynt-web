import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { APP_VERSION } from "@/lib/app-info";
import { isCompatible, validateManifest } from "@/lib/plugins/manifest";

// The plugin template (BARY-222): what someone copies has to install as it
// is. Its own tests, build and release run in the copy (see its README).

const read = (path: string) =>
  JSON.parse(readFileSync(`templates/plugin/${path}`, "utf8"));

describe("the plugin template", () => {
  it("has a manifest Barynt takes, for this version", () => {
    const parsed = validateManifest(read("manifest.json"));
    expect(parsed.ok ? [] : parsed.errors).toEqual([]);
    if (parsed.ok)
      expect(isCompatible(parsed.manifest, APP_VERSION)).toBe(true);
  });

  it("names the view its code registers", () => {
    const manifest = read("manifest.json");
    const code = readFileSync("templates/plugin/src/main.ts", "utf8");
    for (const view of manifest.contributes.projectViews)
      expect(code).toContain(`id: "${view.id}"`);
  });

  it("takes the SDK from a Barynt checkout next to it", () => {
    expect(read("package.json").devDependencies["@barynt/plugin-sdk"]).toBe(
      "file:../barynt/packages/plugin-sdk",
    );
  });
});
