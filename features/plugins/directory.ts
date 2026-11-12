import "server-only";
import { APP_VERSION } from "@/lib/app-info";
import { db } from "@/lib/db";
import { isDevUrl, pluginInternalHosts } from "@/lib/plugins/dev";
import {
  DIRECTORY_MAX_BYTES,
  type DirectoryEntry,
  type DirectoryIssue,
  loadRelease,
  parseDirectory,
  type ReleaseFetch,
  type ReleaseResult,
} from "@/lib/plugins/directory";
import {
  assetUrl,
  authHeaders,
  directoryRequest,
  type GitRepo,
  isGitProvider,
  parseGitRepo,
  releasePlan,
  resolvePluginRepo,
  sameInstance,
} from "@/lib/plugins/git-hosts";
import { fetchPublic } from "@/lib/public-fetch";
import { openSecret, sealSecret } from "@/lib/secret-box";

// The directory client (BARY-141): reads a source's `plugins.json` and loads
// a release from wherever the plugin lives — GitHub, GitLab, Gitea/Forgejo,
// Bitbucket or a plain web server (BARY-198, `lib/plugins/git-hosts.ts`) —
// through the same guarded fetch as link previews
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

const ANY_TYPE = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/;
/** What a directory may come back as: JSON, or raw file contents as the
 *  hosts label them. */
const DIRECTORY_TYPES =
  /^(application\/json|text\/plain|application\/octet-stream|application\/vnd\.github\.raw)$/;

/** Every request of the plugin client: the guarded fetch, with the local
 *  demo directory (development) and the admin's internal hosts let through. */
function get(
  url: URL,
  options: {
    accept: string;
    maxBytes: number;
    types: RegExp;
    headers?: Record<string, string>;
    timeoutMs: number;
  },
) {
  return fetchPublic(url, {
    ...options,
    protocols: ["https:"],
    userAgent: USER_AGENT,
    internalHosts: pluginInternalHosts(),
    ...(isDevUrl(url) && { localOrigin: url.origin }),
  });
}

/** A source's repository — `null` when its address doesn't parse (any
 *  more) for its provider. Plain http only for the local demo directory. */
export function sourceRepo(source: {
  url: string;
  provider: string;
}): GitRepo | null {
  let http = false;
  try {
    http = isDevUrl(new URL(source.url));
  } catch {}
  return parseGitRepo(
    source.url,
    isGitProvider(source.provider) ? source.provider : null,
    { allowHttp: http },
  );
}

/** Where a directory entry's plugin lives (`resolvePluginRepo`); plain http
 *  only on the local demo directory. */
export function pluginRepo(
  entry: DirectoryEntry,
  source: GitRepo,
): GitRepo | null {
  let http = false;
  try {
    http = isDevUrl(new URL(entry.repo));
  } catch {}
  return resolvePluginRepo(entry, source, { allowHttp: http });
}

export type DirectoryRead =
  | { ok: true; entries: DirectoryEntry[]; issues: DirectoryIssue[] }
  | { ok: false; error: string };

/** What the store page read last, per source — the directory lives on
 *  another server and the page shouldn't wait for it on every visit. */
const recent = new Map<string, { at: number; read: DirectoryRead }>();
const RECENT_MS = 5 * 60_000;

/** `readSource`, unless it was read in the last few minutes. */
export async function readSourceRecent(
  sourceId: string,
): Promise<DirectoryRead> {
  const hit = recent.get(sourceId);
  if (hit && Date.now() - hit.at < RECENT_MS) return hit.read;
  return readSource(sourceId);
}

/** Forgets what was read — after the source changed or on "Fetch now". */
export function forgetSource(sourceId: string): void {
  recent.delete(sourceId);
}

/**
 * Reads a source's directory and notes the outcome on the source
 * (`lastSyncAt`, `lastSyncError`). A disabled source isn't read.
 */
export async function readSource(sourceId: string): Promise<DirectoryRead> {
  const source = await db.pluginSource.findUnique({ where: { id: sourceId } });
  if (!source) return { ok: false, error: "not_found" };
  if (!source.enabled) return { ok: false, error: "disabled" };

  const result = await readStoredDirectory(source);
  recent.set(source.id, { at: Date.now(), read: result });
  await db.pluginSource.update({
    where: { id: source.id },
    data: {
      lastSyncAt: new Date(),
      lastSyncError: result.ok ? null : result.error,
    },
  });
  return result;
}

function readStoredDirectory(source: {
  url: string;
  provider: string;
  ref: string | null;
  tokenCipher: string | null;
}): Promise<DirectoryRead> {
  const token = sourceToken(source);
  if (source.tokenCipher && !token)
    return Promise.resolve({ ok: false, error: "token_unreadable" });
  return readDirectory({ ...source, token });
}

/**
 * Reads the `plugins.json` of a source that may not be stored yet — what
 * "Check connection" does before saving.
 */
export async function readDirectory(source: {
  url: string;
  provider: string;
  ref: string | null;
  token: string | null;
}): Promise<DirectoryRead> {
  const repo = sourceRepo(source);
  if (!repo) return { ok: false, error: "invalid_url" };
  const request = directoryRequest(repo, source.ref, !!source.token);
  const res = await get(request.url, {
    accept: request.accept,
    maxBytes: DIRECTORY_MAX_BYTES,
    types: DIRECTORY_TYPES,
    headers: authHeaders(repo.provider, source.token),
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
 * How a release's files travel from wherever the plugin lives
 * (`releasePlan`): one address per file, or the release's metadata first.
 * `token` is the source's, and only when the plugin is on the source's own
 * instance; a download that leads off that instance goes without.
 */
function releaseFetch(
  repo: GitRepo,
  version: string,
  token: string | null,
): ReleaseFetch {
  const headers = authHeaders(repo.provider, token);
  const file = (url: URL, maxBytes: number, accept: string, withToken = true) =>
    get(url, {
      accept,
      maxBytes,
      types: ANY_TYPE,
      headers: withToken ? headers : undefined,
      timeoutMs: FILE_TIMEOUT_MS,
    }).then((res) => res?.body ?? null);

  const plan = releasePlan(repo, version, !!token);
  if (plan.kind === "direct")
    return (name, maxBytes) => file(plan.url(name), maxBytes, "*/*");

  let release: Promise<unknown> | null = null;
  const metadata = () => {
    release ??= get(plan.request.url, {
      accept: plan.request.accept,
      maxBytes: 256 * 1024,
      types: /^application\/json$/,
      headers,
      timeoutMs: FILE_TIMEOUT_MS,
    }).then((res) => {
      try {
        return res ? JSON.parse(new TextDecoder().decode(res.body)) : null;
      } catch {
        return null;
      }
    });
    return release;
  };
  return async (name, maxBytes) => {
    const asset = assetUrl(repo, await metadata(), name);
    return asset
      ? file(asset.url, maxBytes, asset.accept, asset.withToken)
      : null;
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
  const read = await readStoredDirectory(source);
  if (!read.ok) return { ok: false, error: "source", detail: read.error };
  const entry = read.entries.find((e) => e.id === pluginId);
  if (!entry) return { ok: false, error: "not_in_directory" };
  const home = sourceRepo(source) as GitRepo;
  const repo = pluginRepo(entry, home);
  if (!repo) return { ok: false, error: "not_in_directory", detail: "repo" };
  const token = sameInstance(home, repo) ? sourceToken(source) : null;
  return loadRelease(
    entry,
    version,
    releaseFetch(repo, version, token),
    APP_VERSION,
  );
}
