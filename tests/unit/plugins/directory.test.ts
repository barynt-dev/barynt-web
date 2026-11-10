import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import {
  assetApiUrl,
  type DirectoryEntry,
  loadRelease,
  parseDirectory,
  publicAssetUrl,
  type ReleaseFileName,
  type ReleaseFiles,
  releaseHash,
} from "@/lib/plugins/directory";

const encode = (s: string) => new TextEncoder().encode(s);

const manifest = (over: Record<string, unknown> = {}) =>
  encode(
    JSON.stringify({
      id: "gantt-timeline",
      name: "Gantt Timeline",
      version: "1.2.0",
      minBaryntVersion: "0.9.0",
      author: "Acme GmbH",
      description: "Issues on a time line.",
      license: "MIT",
      kind: "sandbox",
      levels: ["project"],
      capabilities: ["issues:read", "ui:project-view"],
      network: [],
      contributes: { projectViews: [{ id: "timeline", title: "Timeline" }] },
      ...over,
    }),
  );

const release = (over: Record<string, unknown> = {}): ReleaseFiles => ({
  "manifest.json": manifest(over),
  "main.js": encode("export default class {}"),
});

const entry = (files: ReleaseFiles, version = "1.2.0"): DirectoryEntry => ({
  id: "gantt-timeline",
  name: "Gantt Timeline",
  author: "Acme GmbH",
  description: "Issues on a time line.",
  repo: "acme/barynt-gantt",
  levels: ["project"],
  kind: "sandbox",
  versions: { [version]: releaseHash(files) },
});

/** Serves `files`, counting what was asked for. */
const serve = (files: ReleaseFiles) => {
  const asked: ReleaseFileName[] = [];
  const fetch = async (name: ReleaseFileName, maxBytes: number) => {
    asked.push(name);
    const data = files[name];
    return data && data.byteLength <= maxBytes ? data : null;
  };
  return { fetch, asked };
};

describe("parseDirectory", () => {
  it("keeps the good entries and reports the broken ones", () => {
    const good = entry(release());
    const { entries, issues } = parseDirectory([
      good,
      { ...good, id: "Bad Id" },
      good,
      { ...good, id: "other-one", versions: {} },
    ]);
    expect(entries).toEqual([good]);
    expect(issues.map((i) => [i.index, i.message.split(":")[0]])).toEqual([
      [1, "id"],
      [2, "id listed twice"],
      [3, "versions"],
    ]);
  });

  it("refuses what isn't a list", () => {
    expect(parseDirectory({ plugins: [] }).issues[0].index).toBe(-1);
  });

  it("wants a GitHub repository and a SHA-256 per version", () => {
    const good = entry(release());
    expect(
      parseDirectory([{ ...good, repo: "https://github.com/acme/x" }]).entries,
    ).toEqual([]);
    expect(
      parseDirectory([{ ...good, versions: { "1.2.0": "abc" } }]).entries,
    ).toEqual([]);
  });
});

describe("releaseHash", () => {
  it("is what sha256sum | sort -k2 | sha256sum prints", () => {
    const files = release();
    const line = (name: ReleaseFileName) =>
      `${createHash("sha256")
        .update(files[name] as Uint8Array)
        .digest("hex")}  ${name}\n`;
    const expected = createHash("sha256")
      .update(line("main.js") + line("manifest.json"))
      .digest("hex");
    expect(releaseHash(files)).toBe(expected);
  });

  it("changes when any file does", () => {
    const a = release();
    const b = { ...a, "styles.css": encode("a{}") };
    expect(releaseHash(a)).not.toBe(releaseHash(b));
  });
});

describe("loadRelease", () => {
  it("hands back a release that checks out", async () => {
    const files = release();
    const { fetch, asked } = serve(files);
    const result = await loadRelease(entry(files), "1.2.0", fetch, "1.0.1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.id).toBe("gantt-timeline");
      expect(result.hash).toBe(releaseHash(files));
    }
    expect(asked).toEqual(["manifest.json", "main.js", "styles.css"]);
  });

  it("refuses a version the directory doesn't list", async () => {
    const files = release();
    const { fetch, asked } = serve(files);
    expect(await loadRelease(entry(files), "9.9.9", fetch, "1.0.1")).toEqual({
      ok: false,
      error: "not_listed",
    });
    expect(asked).toEqual([]);
  });

  it("refuses files that were swapped after listing", async () => {
    const listed = entry(release());
    const swapped = release({ description: "Now does something else." });
    expect(
      await loadRelease(listed, "1.2.0", serve(swapped).fetch, "1.0.1"),
    ).toEqual({ ok: false, error: "hash_mismatch" });
  });

  it("needs the code of a sandbox plugin", async () => {
    const files = { "manifest.json": manifest() };
    expect(
      await loadRelease(entry(files), "1.2.0", serve(files).fetch, "1.0.1"),
    ).toEqual({ ok: false, error: "download_failed", detail: "main.js" });
  });

  it("refuses a file over its size limit", async () => {
    const files = {
      ...release(),
      "styles.css": new Uint8Array(1024 * 1024 + 1),
    };
    // The oversized file doesn't arrive, so the hash can't match.
    expect(
      await loadRelease(entry(files), "1.2.0", serve(files).fetch, "1.0.1"),
    ).toEqual({ ok: false, error: "hash_mismatch" });
  });

  it("checks the manifest against the entry", async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ id: "someone-else" }, "id_mismatch"],
      [{ version: "1.2.1" }, "version_mismatch"],
      [{ levels: ["workspace"] }, "kind_mismatch"],
      [{ minBaryntVersion: "2.0.0" }, "incompatible"],
      [{ capabilities: ["root:all"] }, "invalid_manifest"],
    ];
    for (const [over, error] of cases) {
      const files = release(over);
      const result = await loadRelease(
        entry(files),
        "1.2.0",
        serve(files).fetch,
        "1.0.1",
      );
      expect(result.ok ? "ok" : result.error).toBe(error);
    }
  });

  it("refuses a manifest that isn't JSON", async () => {
    const files = { ...release(), "manifest.json": encode("{nope") };
    const result = await loadRelease(
      entry(files),
      "1.2.0",
      serve(files).fetch,
      "1.0.1",
    );
    expect(result.ok ? "ok" : result.error).toBe("invalid_manifest");
  });
});

describe("GitHub addresses", () => {
  it("builds the public download address from repo, tag and file", () => {
    expect(publicAssetUrl("acme/x", "1.2.0", "main.js").href).toBe(
      "https://github.com/acme/x/releases/download/1.2.0/main.js",
    );
  });

  it("takes an asset's API address, and only from api.github.com", () => {
    const meta = (url: string) => ({ assets: [{ name: "main.js", url }] });
    expect(
      assetApiUrl(
        meta("https://api.github.com/repos/acme/x/releases/assets/1"),
        "main.js",
      )?.href,
    ).toBe("https://api.github.com/repos/acme/x/releases/assets/1");
    expect(assetApiUrl(meta("https://evil.example/steal"), "main.js")).toBe(
      null,
    );
    expect(assetApiUrl(meta("https://api.github.com/x"), "styles.css")).toBe(
      null,
    );
    expect(assetApiUrl(null, "main.js")).toBe(null);
  });
});
