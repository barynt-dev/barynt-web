// A plugin directory (`plugins.json`) and the releases it points to
// (BARY-141). Like the manifest, no dependency on the app — the installer,
// the directory repository's CI and a plugin author's tooling share it. The
// network comes in as a function (`ReleaseFetch`), so this file decides
// *what* to load and check, never *how* it travels.
//
// The rule throughout: anything that doesn't check out is not loaded. A
// release whose files don't hash to what the directory lists, whose manifest
// names another plugin or version, or that needs another Barynt, is refused.

import { createHash } from "node:crypto";
import { z } from "zod";
import { GIT_PROVIDERS } from "./git-hosts";
import {
  isCompatible,
  PLUGIN_KINDS,
  PLUGIN_LEVELS,
  type PluginManifest,
  validateManifest,
} from "./manifest";
import { isSemver } from "./semver";

// ─── The directory ──────────────────────────────────────────────────────────

const ID_RE = /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/;
/** GitHub's short form, `owner/name`, or a repository's address on any
 *  Git host (`lib/plugins/git-hosts.ts` reads it). */
const REPO_RE =
  /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}|https?:\/\/\S{3,290})$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

/**
 * One plugin in a directory. `versions` maps every release the directory
 * vouches for to the hash of its files (`releaseHash`) — a release tag that
 * is later moved to other files no longer matches.
 */
export const directoryEntrySchema = z.strictObject({
  id: z.string().regex(ID_RE),
  name: z.string().trim().min(1).max(60),
  author: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(300),
  repo: z
    .string()
    .regex(REPO_RE, 'expected a repository address or "owner/name"'),
  /** The repository's host software, when its address doesn't tell. */
  provider: z.enum(GIT_PROVIDERS).optional(),
  levels: z.array(z.enum(PLUGIN_LEVELS)).min(1).max(2),
  kind: z.enum(PLUGIN_KINDS),
  versions: z
    .record(
      z.string().refine(isSemver, "expected MAJOR.MINOR.PATCH"),
      z.string().regex(SHA256_RE, "expected a lower-case SHA-256"),
    )
    .refine((v) => Object.keys(v).length > 0, "lists no version"),
});

export type DirectoryEntry = z.infer<typeof directoryEntrySchema>;

export interface DirectoryIssue {
  /** The entry's place in the list; `-1` for the file as a whole. */
  index: number;
  id?: string;
  message: string;
}

/**
 * A parsed `plugins.json` — a list of entries. One broken entry doesn't
 * take the directory down: it's left out and reported. A second entry with
 * an id already taken is left out too.
 */
export function parseDirectory(input: unknown): {
  entries: DirectoryEntry[];
  issues: DirectoryIssue[];
} {
  if (!Array.isArray(input))
    return {
      entries: [],
      issues: [{ index: -1, message: "expected a list of plugins" }],
    };
  const entries: DirectoryEntry[] = [];
  const issues: DirectoryIssue[] = [];
  const seen = new Set<string>();
  input.forEach((raw, index) => {
    const id =
      raw && typeof raw === "object" && typeof raw.id === "string"
        ? raw.id
        : undefined;
    const parsed = directoryEntrySchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      issues.push({
        index,
        id,
        message: `${first.path.join(".") || "entry"}: ${first.message}`,
      });
      return;
    }
    if (seen.has(parsed.data.id)) {
      issues.push({ index, id, message: "id listed twice" });
      return;
    }
    seen.add(parsed.data.id);
    entries.push(parsed.data);
  });
  return { entries, issues };
}

// ─── A release's files ──────────────────────────────────────────────────────

/** The files a release carries, and how big each may be. */
export const RELEASE_FILES = {
  "manifest.json": 64 * 1024,
  "main.js": 5 * 1024 * 1024,
  "styles.css": 1024 * 1024,
} as const;
export type ReleaseFileName = keyof typeof RELEASE_FILES;

export type ReleaseFiles = Partial<Record<ReleaseFileName, Uint8Array>>;

/** A directory may be this big. */
export const DIRECTORY_MAX_BYTES = 1024 * 1024;

const sha256 = (data: Uint8Array | string) =>
  createHash("sha256").update(data).digest("hex");

/**
 * The hash a directory lists for a release: SHA-256 over the `sha256sum`
 * lines of its files, sorted by name — what
 *
 *   sha256sum manifest.json main.js styles.css | sort -k2 | sha256sum
 *
 * prints, for the files the release has.
 */
export function releaseHash(files: ReleaseFiles): string {
  const lines = (Object.keys(files) as ReleaseFileName[])
    .filter((name) => files[name])
    .sort()
    .map((name) => `${sha256(files[name] as Uint8Array)}  ${name}\n`)
    .join("");
  return sha256(lines);
}

/** Which files a plugin of a kind must have. Code only runs in a sandbox
 *  plugin; the others are a manifest (and a service of their own). */
export function requiredFiles(kind: DirectoryEntry["kind"]): ReleaseFileName[] {
  return kind === "sandbox" ? ["manifest.json", "main.js"] : ["manifest.json"];
}

// ─── Loading a release ──────────────────────────────────────────────────────

/** One file of a release by name — `null` when it isn't there or can't be
 *  had within `maxBytes`. How it travels (and with which token) is the
 *  caller's business. */
export type ReleaseFetch = (
  file: ReleaseFileName,
  maxBytes: number,
) => Promise<Uint8Array | null>;

export type ReleaseError =
  | "not_listed"
  | "download_failed"
  | "hash_mismatch"
  | "invalid_manifest"
  | "id_mismatch"
  | "version_mismatch"
  | "kind_mismatch"
  | "incompatible";

export type ReleaseResult =
  | {
      ok: true;
      manifest: PluginManifest;
      files: ReleaseFiles;
      hash: string;
    }
  | { ok: false; error: ReleaseError; detail?: string };

/**
 * Loads `version` of a directory entry and checks it, in this order: the
 * directory lists the version; every required file arrives; the files hash
 * to what the directory lists; the manifest is valid and names this plugin,
 * this version, this kind and these levels; it runs on `baryntVersion`.
 * Only then are the files handed back.
 */
export async function loadRelease(
  entry: DirectoryEntry,
  version: string,
  fetchFile: ReleaseFetch,
  baryntVersion: string,
): Promise<ReleaseResult> {
  const expected = entry.versions[version];
  if (!expected) return { ok: false, error: "not_listed" };

  const required = requiredFiles(entry.kind);
  const files: ReleaseFiles = {};
  for (const name of Object.keys(RELEASE_FILES) as ReleaseFileName[]) {
    const data = await fetchFile(name, RELEASE_FILES[name]);
    if (data) files[name] = data;
    else if (required.includes(name))
      return { ok: false, error: "download_failed", detail: name };
  }

  // The hash covers whatever arrived — an optional file that failed to
  // load makes it differ too, so nothing half-downloaded slips through.
  const hash = releaseHash(files);
  if (hash !== expected) return { ok: false, error: "hash_mismatch" };

  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(files["manifest.json"]));
  } catch {
    return { ok: false, error: "invalid_manifest", detail: "not JSON" };
  }
  const result = validateManifest(raw);
  if (!result.ok)
    return {
      ok: false,
      error: "invalid_manifest",
      detail: result.errors
        .slice(0, 3)
        .map((e) => `${e.path || "manifest"}: ${e.message}`)
        .join("; "),
    };
  const manifest = result.manifest;

  if (manifest.id !== entry.id) return { ok: false, error: "id_mismatch" };
  if (manifest.version !== version)
    return { ok: false, error: "version_mismatch" };
  if (
    manifest.kind !== entry.kind ||
    [...manifest.levels].sort().join() !== [...entry.levels].sort().join()
  )
    return { ok: false, error: "kind_mismatch" };
  if (!isCompatible(manifest, baryntVersion))
    return { ok: false, error: "incompatible" };

  return { ok: true, manifest, files, hash };
}
