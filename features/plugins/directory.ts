import "server-only";
import { APP_VERSION } from "@/lib/app-info";
import { db } from "@/lib/db";
import { isDevUrl, pluginDevBase } from "@/lib/plugins/dev";
import {
  assetApiUrl,
  DIRECTORY_MAX_BYTES,
  type DirectoryEntry,
  type DirectoryIssue,
  loadRelease,
  parseDirectory,
  publicAssetUrl,
  type ReleaseFetch,
  type ReleaseResult,
  releaseApiUrl,
} from "@/lib/plugins/directory";
import { fetchPublic } from "@/lib/public-fetch";
import { openSecret, sealSecret } from "@/lib/secret-box";

// The directory client (BARY-141): reads a source's `plugins.json` and loads
// a release from GitHub, through the same guarded fetch as link previews
// (`lib/public-fetch.ts` — public addresses only, every redirect checked,
// size and time capped). What gets checked lives in `lib/plugins/directory`.
// Installing what comes back is the lifecycle's job (BARY-142).

const TOKEN_PURPOSE = "plugin-source-token";
const USER_AGENT = "Barynt-plugins";
/** A release's files may take a moment; a directory may not. */
const FILE_TIMEOUT_MS = 20_000;
const DIRECTORY_TIMEOUT_MS = 8_000;

/** Seals a source's access token for `PluginSource.tokenCipher`. */
export function sealSourceToken(token: string): string {
  return sealSecret(token, TOKEN_PURPOSE);
}

/** A source's token in the clear — `null` without one, or when it can't be
 *  opened any more (`AUTH_SECRET` changed): then it has to be entered again. */
function sourceToken(source: { tokenCipher: string | null }): string | null {
  return source.tokenCipher
    ? openSecret(source.tokenCipher, TOKEN_PURPOSE)
    : null;
}

const auth = (token: string | null) =>
  token ? { authorization: `Bearer ${token}` } : undefined;

export type DirectoryRead =
  | { ok: true; entries: DirectoryEntry[]; issues: DirectoryIssue[] }
  | { ok: false; error: string };

/**
 * Reads a source's directory and notes the outcome on the source
 * (`lastSyncAt`, `lastSyncError`). A disabled source isn't read.
 */
export async function readSource(sourceId: string): Promise<DirectoryRead> {
  const source = await db.pluginSource.findUnique({ where: { id: sourceId } });
  if (!source) return { ok: false, error: "not_found" };
  if (!source.enabled) return { ok: false, error: "disabled" };

  const result = await readDirectory(source);
  await db.pluginSource.update({
    where: { id: source.id },
    data: {
      lastSyncAt: new Date(),
      lastSyncError: result.ok ? null : result.error,
    },
  });
  return result;
}

async function readDirectory(source: {
  url: string;
  tokenCipher: string | null;
}): Promise<DirectoryRead> {
  if (source.tokenCipher && !sourceToken(source))
    return { ok: false, error: "token_unreadable" };
  let url: URL;
  try {
    url = new URL(source.url);
  } catch {
    return { ok: false, error: "invalid_url" };
  }
  const res = await fetchPublic(url, {
    accept: "application/json",
    maxBytes: DIRECTORY_MAX_BYTES,
    types: /^(application\/json|text\/plain)$/,
    protocols: ["https:"],
    ...(isDevUrl(url) && { localOrigin: url.origin }),
    headers: auth(sourceToken(source)),
    userAgent: USER_AGENT,
    timeoutMs: DIRECTORY_TIMEOUT_MS,
  });
  if (!res) return { ok: false, error: "unreachable" };
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(res.body));
  } catch {
    return { ok: false, error: "not_json" };
  }
  const { entries, issues } = parseDirectory(json);
  if (!entries.length && issues.some((i) => i.index === -1))
    return { ok: false, error: issues[0].message };
  return { ok: true, entries, issues };
}

/**
 * How a release's files travel: from GitHub's public download address, or —
 * with the source's token, for a private repository — through the API,
 * asset by asset. The token is sent to `api.github.com` only; the signed
 * download it redirects to goes without (`fetchPublic`).
 */
function releaseFetch(
  entry: DirectoryEntry,
  version: string,
  token: string | null,
): ReleaseFetch {
  const get = (url: URL, maxBytes: number, accept: string, types: RegExp) =>
    fetchPublic(url, {
      accept,
      maxBytes,
      types,
      protocols: ["https:"],
      headers: auth(token),
      userAgent: USER_AGENT,
      timeoutMs: FILE_TIMEOUT_MS,
    }).then((res) => res?.body ?? null);
  // GitHub serves assets as octet streams; a few mirrors label them.
  const anyType = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/;

  // In development, a local directory serves the releases too.
  const dev = pluginDevBase();
  if (dev && !token)
    return (file, maxBytes) =>
      fetchPublic(publicAssetUrl(entry.repo, version, file, dev.origin), {
        accept: "*/*",
        maxBytes,
        types: anyType,
        protocols: ["https:"],
        localOrigin: dev.origin,
        userAgent: USER_AGENT,
        timeoutMs: FILE_TIMEOUT_MS,
      }).then((res) => res?.body ?? null);

  if (!token)
    return (file, maxBytes) =>
      get(publicAssetUrl(entry.repo, version, file), maxBytes, "*/*", anyType);

  let release: Promise<unknown> | null = null;
  const metadata = () => {
    release ??= get(
      releaseApiUrl(entry.repo, version),
      256 * 1024,
      "application/vnd.github+json",
      /^application\/json$/,
    ).then((body) => {
      try {
        return body ? JSON.parse(new TextDecoder().decode(body)) : null;
      } catch {
        return null;
      }
    });
    return release;
  };
  return async (file, maxBytes) => {
    const url = assetApiUrl(await metadata(), file);
    return url ? get(url, maxBytes, "application/octet-stream", anyType) : null;
  };
}

/**
 * Loads `version` of plugin `pluginId` as the source lists it, checked end
 * to end (`loadRelease`) against this Barynt's version. Nothing is stored.
 */
export async function fetchRelease(
  sourceId: string,
  pluginId: string,
  version: string,
): Promise<
  | ReleaseResult
  | { ok: false; error: "source" | "not_in_directory"; detail?: string }
> {
  const source = await db.pluginSource.findUnique({ where: { id: sourceId } });
  if (!source?.enabled) return { ok: false, error: "source" };
  const read = await readDirectory(source);
  if (!read.ok) return { ok: false, error: "source", detail: read.error };
  const entry = read.entries.find((e) => e.id === pluginId);
  if (!entry) return { ok: false, error: "not_in_directory" };
  return loadRelease(
    entry,
    version,
    releaseFetch(entry, version, sourceToken(source)),
    APP_VERSION,
  );
}
