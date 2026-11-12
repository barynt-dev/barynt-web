import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import {
  type DirectoryEntry,
  isPreviewImage,
  loadRelease,
  parseDirectory,
  previewFiles,
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

  it("takes release notes per listed version (BARY-200)", () => {
    const good = entry(release());
    const notes = { "1.2.0": "- Faster\n- Fixed the export" };
    expect(parseDirectory([{ ...good, notes }]).entries[0].notes).toEqual(
      notes,
    );
    expect(
      parseDirectory([{ ...good, notes: { latest: "x" } }]).entries,
    ).toEqual([]);
    expect(
      parseDirectory([{ ...good, notes: { "1.2.0": "x".repeat(2001) } }])
        .entries,
    ).toEqual([]);
  });

  it("takes categories, featured and a date for the store (BARY-200)", () => {
    const good = entry(release());
    const meta = {
      categories: ["planning", "time"],
      featured: true,
      added: "2026-11-02",
    };
    expect(parseDirectory([{ ...good, ...meta }]).entries[0]).toMatchObject(
      meta,
    );
    for (const bad of [
      { categories: ["games"] },
      { categories: ["planning", "time", "reports", "support"] },
      { added: "02.11.2026" },
      { featured: "yes" },
    ])
      expect(parseDirectory([{ ...good, ...bad }]).entries).toEqual([]);
  });

  it("wants a repository address and a SHA-256 per version", () => {
    const good = entry(release());
    for (const repo of [
      "https://github.com/acme/x",
      "https://gitlab.acme.dev/team/sub/x",
    ])
      expect(parseDirectory([{ ...good, repo }]).entries).toHaveLength(1);
    expect(
      parseDirectory([{ ...good, repo: "ftp://acme.dev/x" }]).entries,
    ).toEqual([]);
    expect(parseDirectory([{ ...good, provider: "svn" }]).entries).toEqual([]);
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

describe("preview images (BARY-199)", () => {
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2,
  ]);
  const webp = encode("RIFF\0\0\0\0WEBPVP8 ");
  const withPreviews = (files: Partial<ReleaseFiles> = {}) => ({
    ...release({
      previews: [
        { file: "preview-1.png", title: "Timeline" },
        { file: "preview-2.webp", title: "Settings" },
      ],
    }),
    "preview-1.png": png,
    "preview-2.webp": webp,
    ...files,
  });

  it("loads the ones the manifest names, and hashes them along", async () => {
    const files = withPreviews();
    const { fetch, asked } = serve(files);
    const result = await loadRelease(entry(files), "1.2.0", fetch, "1.0.0");
    expect(result.ok).toBe(true);
    expect(asked).toContain("preview-2.webp");
    if (result.ok) expect(result.files["preview-1.png"]).toEqual(png);
  });

  it("refuses a swapped or missing preview", async () => {
    const files = withPreviews();
    const swapped = serve({
      ...files,
      "preview-1.png": new Uint8Array([...png, 9]),
    });
    expect(
      await loadRelease(entry(files), "1.2.0", swapped.fetch, "1.0.0"),
    ).toMatchObject({ ok: false, error: "hash_mismatch" });
    const { "preview-2.webp": _, ...missing } = files;
    expect(
      await loadRelease(entry(files), "1.2.0", serve(missing).fetch, "1.0.0"),
    ).toMatchObject({
      ok: false,
      error: "download_failed",
      detail: "preview-2.webp",
    });
  });

  it("refuses a preview that isn't the image its name says", async () => {
    const files = withPreviews({
      "preview-1.png": encode("<svg onload=alert(1)>"),
    });
    expect(
      await loadRelease(entry(files), "1.2.0", serve(files).fetch, "1.0.0"),
    ).toMatchObject({ ok: false, error: "invalid_manifest" });
  });

  it("knows PNG and WebP by their signature", () => {
    expect(isPreviewImage("preview-1.png", png)).toBe(true);
    expect(isPreviewImage("preview-1.webp", webp)).toBe(true);
    expect(isPreviewImage("preview-1.webp", png)).toBe(false);
    expect(
      previewFiles({
        previews: [
          { file: "../main.js" },
          { file: "preview-7.png" },
          { file: "preview-1.png" },
        ],
      }),
    ).toEqual(["preview-1.png"]);
  });
});
