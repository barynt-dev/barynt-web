import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { APP_VERSION } from "@/lib/app-info";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { pluginDevSources } from "@/lib/plugins/dev";
import {
  RELEASE_FILES,
  type ReleaseFiles,
  releaseHash,
  requiredFiles,
} from "@/lib/plugins/directory";
import {
  isCompatible,
  type PluginManifest,
  validateManifest,
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
  name: keyof typeof RELEASE_FILES,
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
  return bytes.byteLength > RELEASE_FILES[name] ? "too_large" : bytes;
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
  for (const name of requiredFiles(manifest.kind))
    if (!files[name]) errors.push(`${name}: not found`);
  if (!isCompatible(manifest, APP_VERSION))
    errors.push(`minBaryntVersion: needs another Barynt than ${APP_VERSION}`);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, manifest, files, fingerprint: releaseHash(files) };
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
