import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { APP_VERSION } from "@/lib/app-info";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { pluginDevSources } from "@/lib/plugins/dev";
import {
  isPreviewImage,
  LOGO_MAX_BYTES,
  PREVIEW_MAX_BYTES,
  RELEASE_FILES,
  type ReleaseFileName,
  type ReleaseFiles,
  releaseHash,
  requiredFiles,
} from "@/lib/plugins/directory";
import {
  ABOUT_FILE_MAX_BYTES,
  ABOUT_FILE_RE,
  aboutFiles,
  isCompatible,
  type PluginManifest,
  validateManifest,
  withAboutFiles,
} from "@/lib/plugins/manifest";

// A plugin in development (BARY-221): its build output in a local folder
// (or the folder's `dist/`) or on a dev server on localhost, loaded without a release or a hash. Barynt
// reads it again whenever a frame loads or a page asks whether it changed,
// checks the manifest every time, and keeps the plugin's row in step — so
// everything else (slots, settings, what it may do) reads it as usual.

export type DevRead =
  | {
      ok: true;
      manifest: PluginManifest;
      files: ReleaseFiles;
      /** The files' release hash — what tells a change. */
      fingerprint: string;
    }
  | { ok: false; errors: string[] };

const NAMES = Object.keys(RELEASE_FILES) as (keyof typeof RELEASE_FILES)[];

async function readOne(
  source: string,
  name: ReleaseFileName,
  max: number = RELEASE_FILES[name as keyof typeof RELEASE_FILES],
): Promise<Uint8Array | null | "too_large"> {
  let bytes: Uint8Array;
  try {
    if (source.startsWith("/")) {
      // The project's folder: its build output may sit in `dist/`.
      bytes = new Uint8Array(
        await readFile(join(source, name)).catch(() =>
          readFile(join(source, "dist", name)),
        ),
      );
    } else {
      const res = await fetch(`${source}/${name}`, { cache: "no-store" });
      if (!res.ok) return null;
      bytes = new Uint8Array(await res.arrayBuffer());
    }
  } catch {
    return null;
  }
  return bytes.byteLength > max ? "too_large" : bytes;
}

/** A plugin's files from its folder or dev server, checked like a
 *  release's — only the hash isn't, there's none to check against. */
export async function readDevPlugin(source: string): Promise<DevRead> {
  const files: ReleaseFiles = {};
  const errors: string[] = [];
  for (const name of NAMES) {
    const bytes = await readOne(source, name);
    if (bytes === "too_large") errors.push(`${name}: too large`);
    else if (bytes) files[name] = bytes;
  }
  const raw = files["manifest.json"];
  if (!raw) return { ok: false, errors: ["manifest.json: not found"] };
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return { ok: false, errors: ["manifest.json: not valid JSON"] };
  }
  const parsed = validateManifest(json);
  if (!parsed.ok)
    return {
      ok: false,
      errors: parsed.errors.map((e) => `${e.path || "manifest"}: ${e.message}`),
    };
  const { manifest } = parsed;
  // Its pictures too (BARY-235): the previews and the logo it names.
  const pictures: [ReleaseFileName, number][] = [
    ...(manifest.previews ?? []).map(
      (p) =>
        [p.file as ReleaseFileName, PREVIEW_MAX_BYTES] as [
          ReleaseFileName,
          number,
        ],
    ),
    ...(manifest.logo
      ? [
          [manifest.logo as ReleaseFileName, LOGO_MAX_BYTES] as [
            ReleaseFileName,
            number,
          ],
        ]
      : []),
  ];
  for (const [name, max] of pictures) {
    const bytes = await readOne(source, name, max);
    if (bytes === "too_large") errors.push(`${name}: too large`);
    else if (!bytes) errors.push(`${name}: not found`);
    else if (!isPreviewImage(name, bytes))
      errors.push(`${name}: not a PNG or WebP`);
    else files[name] = bytes;
  }
  // And its page text files (`about.md`, BARY-237), put in their place.
  for (const name of aboutFiles(manifest)) {
    const bytes = await readOne(source, name, ABOUT_FILE_MAX_BYTES);
    if (bytes === "too_large") errors.push(`${name}: too large`);
    else if (bytes) files[name] = bytes;
  }
  const texts = withAboutFiles(manifest, files);
  if (!texts.ok) errors.push(texts.detail);
  for (const name of requiredFiles(manifest.kind))
    if (!files[name]) errors.push(`${name}: not found`);
  if (!isCompatible(manifest, APP_VERSION))
    errors.push(`minBaryntVersion: needs another Barynt than ${APP_VERSION}`);
  if (errors.length > 0 || !texts.ok) return { ok: false, errors };
  return {
    ok: true,
    manifest: texts.manifest,
    files,
    fingerprint: releaseHash(files),
  };
}

/** Each source of `PLUGIN_DEV_DIRS`, read — for the admin's list. */
export async function listDevPlugins(): Promise<
  ({ source: string } & DevRead)[]
> {
  return Promise.all(
    pluginDevSources().map(async (source) => ({
      source,
      ...(await readDevPlugin(source)),
    })),
  );
}

/** The row's version: the manifest's, marked as not a release. */
export const devVersion = (manifest: PluginManifest) =>
  `${manifest.version}-dev`;

/**
 * An installed dev plugin read again: a changed one updates its row
 * (manifest, version, kind, fingerprint), so what it asks for now is what
 * counts — more capabilities than confirmed ask again, as after an update.
 * A source no longer listed, a manifest that fails, another plugin's id:
 * the row stays as it was, and the error is answered.
 */
export async function syncDevPlugin(row: {
  id: string;
  pluginId: string;
  hash: string;
  devSource: string;
}): Promise<DevRead> {
  if (!pluginDevSources().includes(row.devSource))
    return { ok: false, errors: ["PLUGIN_DEV_DIRS: no longer listed"] };
  const read = await readDevPlugin(row.devSource);
  if (!read.ok) return read;
  if (read.manifest.id !== row.pluginId)
    return { ok: false, errors: [`id: expected ${row.pluginId}`] };
  if (read.fingerprint !== row.hash)
    await db.plugin.update({
      where: { id: row.id },
      data: {
        manifest: read.manifest as unknown as Prisma.InputJsonValue,
        version: devVersion(read.manifest),
        kind: read.manifest.kind,
        hash: read.fingerprint,
        // Its stored files too: what Barynt serves itself, the logo and
        // the previews (BARY-235), shows the folder as it is now.
        files: { deleteMany: {}, create: storedFiles(read.files) },
      },
    });
  return read;
}

/** The installed dev plugins, read again — by plugin, its fingerprint or
 *  `null` while it fails. What open frames poll to reload. */
export async function devFingerprints(): Promise<
  Record<string, string | null>
> {
  if (pluginDevSources().length === 0) return {};
  const rows = await db.plugin.findMany({
    where: { status: "active", devSource: { not: null } },
    select: { id: true, pluginId: true, hash: true, devSource: true },
  });
  const out: Record<string, string | null> = {};
  for (const row of rows) {
    const read = await syncDevPlugin({
      ...row,
      devSource: row.devSource as string,
    });
    out[row.pluginId] = read.ok ? read.fingerprint : null;
  }
  return out;
}

/** A plugin's files as its row keeps them: all but the manifest, which is a
 *  column of its own, and the page text files, whose text is in it. */
export function storedFiles(files: ReleaseFiles) {
  return (Object.keys(files) as ReleaseFileName[]).flatMap((name) => {
    const content = files[name];
    return content && name !== "manifest.json" && !ABOUT_FILE_RE.test(name)
      ? [{ name, content: Buffer.from(content), size: content.byteLength }]
      : [];
  });
}
