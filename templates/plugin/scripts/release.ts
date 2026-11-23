import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir } from "node:fs/promises";

// A release of the plugin, from dist/: its files under release/<version>/,
// their hash, and this version in release/plugins.json — the directory
// Barynt installs from. How it all fits is in Barynt's
// docs/dev/plugins-publishing.md. `PLUGIN_REPO` is where the release lives
// (the entry's `repo`).

const sha256 = (data: Uint8Array | string) =>
  createHash("sha256").update(data).digest("hex");

const manifest = await Bun.file("dist/manifest.json").json();
const version: string = manifest.version;
const names = (await readdir("dist"))
  .filter(
    (name) =>
      ["manifest.json", "main.js", "styles.css"].includes(name) ||
      /^preview-[1-6]\.(webp|png)$/.test(name) ||
      /^logo\.(webp|png)$/.test(name) ||
      /^about(\.[a-z]{2})?\.md$/.test(name),
  )
  .sort();

// The release hash: SHA-256 over each file's own hash and name, sorted by
// name — what `sha256sum <files> | sort -k2 | sha256sum` prints.
const lines: string[] = [];
await mkdir(`release/${version}`, { recursive: true });
for (const name of names) {
  const bytes = new Uint8Array(await Bun.file(`dist/${name}`).arrayBuffer());
  lines.push(`${sha256(bytes)}  ${name}\n`);
  await copyFile(`dist/${name}`, `release/${version}/${name}`);
}
const hash = sha256(lines.join(""));

const directory = "release/plugins.json";
const entries: Record<string, unknown>[] = (await Bun.file(directory).exists())
  ? await Bun.file(directory).json()
  : [];
const previous = entries.find((e) => e.id === manifest.id);
const listed = (previous?.versions as Record<string, string>) ?? {};
// A release is fixed: once listed, its files never change.
if (listed[version] && listed[version] !== hash) {
  console.error(
    `${version} is already released with other files — bump the version.`,
  );
  process.exit(1);
}
const entry = {
  id: manifest.id,
  name: manifest.name,
  author: manifest.author,
  // The directory lists the short text; the page text is in the release.
  description: manifest.description.short,
  repo:
    process.env.PLUGIN_REPO ??
    previous?.repo ??
    "https://example.com/your/repo",
  levels: manifest.levels,
  kind: manifest.kind,
  versions: { ...listed, [version]: hash },
};
await Bun.write(
  directory,
  `${JSON.stringify(
    [...entries.filter((e) => e.id !== manifest.id), entry],
    null,
    2,
  )}\n`,
);

console.log(`release/${version}/: ${names.join(", ")}`);
console.log(`hash ${hash}`);
