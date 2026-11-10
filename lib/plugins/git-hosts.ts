// Where a directory and a plugin's releases live (BARY-198): any Git host,
// not just GitHub. Pure — no network, no environment. Each provider answers
// three questions: where is a repository's `plugins.json`, where are a
// release's files, and how does a token travel. The directory client
// (`features/plugins/directory.ts`) does the fetching.
//
// A token belongs to one instance (provider + origin). It's only ever sent
// there — a plugin hosted somewhere else, or a download that points to
// another host, goes without.

export const GIT_PROVIDERS = [
  "github",
  "gitlab",
  "gitea",
  "bitbucket",
  "https",
] as const;
export type GitProvider = (typeof GIT_PROVIDERS)[number];

export const isGitProvider = (value: unknown): value is GitProvider =>
  (GIT_PROVIDERS as readonly unknown[]).includes(value);

/**
 * A repository on a Git host — or, for `https`, a plain address: the
 * directory file itself (a source) or a folder of releases (a plugin).
 */
export interface GitRepo {
  provider: GitProvider;
  /** `https://gitlab.acme.dev` — where the token belongs. */
  origin: string;
  /** `group/sub/name` on a Git host; the whole path for `https`. */
  path: string;
}

/** Hosts whose provider is known by name. */
const KNOWN_HOSTS: Record<string, GitProvider> = {
  "github.com": "github",
  "www.github.com": "github",
  "gitlab.com": "gitlab",
  "codeberg.org": "gitea",
  "gitea.com": "gitea",
  "bitbucket.org": "bitbucket",
};

/**
 * The provider a host most likely runs: a known host, or a self-hosted one
 * named after its software (`gitlab.acme.dev`, `git.forgejo.example`).
 * `null` when it can't be told — then someone has to pick.
 */
export function detectProvider(url: URL): GitProvider | null {
  const host = url.hostname.toLowerCase();
  if (KNOWN_HOSTS[host]) return KNOWN_HOSTS[host];
  const labels = host.split(".");
  if (labels.includes("gitlab")) return "gitlab";
  if (labels.some((l) => l === "gitea" || l === "forgejo")) return "gitea";
  if (url.pathname.endsWith(".json")) return "https";
  return null;
}

/** `owner/name` — GitHub's short form, as directories have always used. */
const SHORT_REPO_RE =
  /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
const SEGMENT_RE = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Reads a repository address — `https://host/owner/name(.git)`, or GitHub's
 * `owner/name` — for `provider` (or the one `detectProvider` finds).
 * `allowHttp` lets the local demo directory through in development.
 * `null` for anything that isn't one.
 */
export function parseGitRepo(
  input: string,
  provider?: GitProvider | null,
  options: { allowHttp?: boolean } = {},
): GitRepo | null {
  const raw = input.trim();
  if (SHORT_REPO_RE.test(raw) && (!provider || provider === "github"))
    return { provider: "github", origin: "https://github.com", path: raw };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const httpOk =
    url.protocol === "https:" ||
    (options.allowHttp && url.protocol === "http:");
  if (!httpOk || url.username || url.password || url.hash) return null;
  const kind = provider ?? detectProvider(url);
  if (!kind) return null;

  if (kind === "https") {
    if (url.search) return null;
    return {
      provider: "https",
      origin: url.origin,
      path: url.pathname.replace(/\/+$/, "") || "/",
    };
  }
  if (url.search) return null;
  const segments = url.pathname
    .replace(/\.git\/?$/, "")
    .split("/")
    .filter(Boolean);
  // GitLab nests groups; the others are owner/name.
  const fits = kind === "gitlab" ? segments.length >= 2 : segments.length === 2;
  if (!fits || !segments.every((s) => SEGMENT_RE.test(s))) return null;
  const origin =
    kind === "github" && url.hostname === "www.github.com"
      ? "https://github.com"
      : url.origin;
  // Bitbucket Cloud only; Bitbucket Server/Data Center works differently.
  if (kind === "bitbucket" && origin !== "https://bitbucket.org") return null;
  return { provider: kind, origin, path: segments.join("/") };
}

/** The address a repository is stored and shown as. */
export function repoUrl(repo: GitRepo): string {
  return repo.provider === "https"
    ? `${repo.origin}${repo.path}`
    : `${repo.origin}/${repo.path}`;
}

/** Whether a token for `a` may go to `b` — the same instance. */
export function sameInstance(a: GitRepo, b: GitRepo): boolean {
  return a.provider === b.provider && a.origin === b.origin;
}

/** The headers that carry `token` to a provider. `user:secret` is sent as
 *  Basic auth where a provider takes it (Bitbucket app passwords, a plain
 *  web server); everything else as the provider expects its tokens. */
export function authHeaders(
  provider: GitProvider,
  token: string | null,
): Record<string, string> | undefined {
  if (!token) return undefined;
  switch (provider) {
    case "gitlab":
      return { "private-token": token };
    case "gitea":
      return { authorization: `token ${token}` };
    case "bitbucket":
    case "https":
      return token.includes(":")
        ? { authorization: `Basic ${Buffer.from(token).toString("base64")}` }
        : { authorization: `Bearer ${token}` };
    default:
      return { authorization: `Bearer ${token}` };
  }
}

/** One request: where to, and what to accept back. */
export interface GitRequest {
  url: URL;
  accept: string;
}

const enc = encodeURIComponent;
const DIRECTORY_FILE = "plugins.json";

/**
 * Where a source's `plugins.json` is: in the repository's root at `ref`
 * (its default branch when there's none), or — for `https` — the address
 * itself. Bitbucket has no "default branch" address for a file, so it reads
 * `main` unless told otherwise.
 */
export function directoryRequest(
  repo: GitRepo,
  ref: string | null,
  withToken: boolean,
): GitRequest {
  const json = "application/json";
  switch (repo.provider) {
    case "github":
      return withToken
        ? {
            url: new URL(
              `https://api.github.com/repos/${repo.path}/contents/${DIRECTORY_FILE}${ref ? `?ref=${enc(ref)}` : ""}`,
            ),
            accept: "application/vnd.github.raw",
          }
        : {
            url: new URL(
              `https://raw.githubusercontent.com/${repo.path}/${enc(ref ?? "HEAD")}/${DIRECTORY_FILE}`,
            ),
            accept: json,
          };
    case "gitlab":
      return {
        url: new URL(
          `${repo.origin}/api/v4/projects/${enc(repo.path)}/repository/files/${DIRECTORY_FILE}/raw${ref ? `?ref=${enc(ref)}` : ""}`,
        ),
        accept: json,
      };
    case "gitea":
      return {
        url: new URL(
          `${repo.origin}/api/v1/repos/${repo.path}/raw/${DIRECTORY_FILE}${ref ? `?ref=${enc(ref)}` : ""}`,
        ),
        accept: json,
      };
    case "bitbucket":
      return {
        url: new URL(
          `https://api.bitbucket.org/2.0/repositories/${repo.path}/src/${enc(ref ?? "main")}/${DIRECTORY_FILE}`,
        ),
        accept: json,
      };
    case "https":
      return { url: new URL(repoUrl(repo)), accept: json };
  }
}

/**
 * How a release's file is had. The tag is the version itself.
 *
 * - `direct`: one address per file (Bitbucket reads it from the tag, a
 *   plain web server serves `<base>/<version>/<file>`, GitHub and Gitea
 *   have a public download address).
 * - `metadata`: first the release's metadata, which names each file's
 *   download address (`assetUrl`) — GitHub with a token, GitLab always,
 *   Gitea with a token.
 */
export type ReleasePlan =
  | { kind: "direct"; url: (file: string) => URL }
  | { kind: "metadata"; request: GitRequest };

export function releasePlan(
  repo: GitRepo,
  version: string,
  withToken: boolean,
): ReleasePlan {
  const tag = enc(version);
  const download = () => ({
    kind: "direct" as const,
    url: (file: string) =>
      new URL(`${repo.origin}/${repo.path}/releases/download/${tag}/${file}`),
  });
  switch (repo.provider) {
    case "github":
      return withToken
        ? {
            kind: "metadata",
            request: {
              url: new URL(
                `https://api.github.com/repos/${repo.path}/releases/tags/${tag}`,
              ),
              accept: "application/vnd.github+json",
            },
          }
        : download();
    case "gitea":
      return withToken
        ? {
            kind: "metadata",
            request: {
              url: new URL(
                `${repo.origin}/api/v1/repos/${repo.path}/releases/tags/${tag}`,
              ),
              accept: "application/json",
            },
          }
        : download();
    case "gitlab":
      return {
        kind: "metadata",
        request: {
          url: new URL(
            `${repo.origin}/api/v4/projects/${enc(repo.path)}/releases/${tag}`,
          ),
          accept: "application/json",
        },
      };
    case "bitbucket":
      return {
        kind: "direct",
        url: (file) =>
          new URL(
            `https://api.bitbucket.org/2.0/repositories/${repo.path}/src/${tag}/${file}`,
          ),
      };
    case "https":
      return {
        kind: "direct",
        url: (file) => new URL(`${repoUrl(repo)}/${tag}/${file}`),
      };
  }
}

/**
 * A file's download address in a release's metadata, and whether the token
 * may go along. GitHub's API assets (`api.github.com` only, as before);
 * Gitea's `browser_download_url`; GitLab's release links
 * (`direct_asset_url`, else `url`). The token only goes to the instance's
 * own API or origin — a link to anywhere else is fetched without it.
 */
export function assetUrl(
  repo: GitRepo,
  metadata: unknown,
  file: string,
): { url: URL; withToken: boolean; accept: string } | null {
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;
  const list =
    repo.provider === "gitlab"
      ? (record.assets as { links?: unknown } | undefined)?.links
      : record.assets;
  if (!Array.isArray(list)) return null;
  const asset = list.find(
    (a) =>
      a && typeof a === "object" && (a as { name?: unknown }).name === file,
  ) as Record<string, unknown> | undefined;
  if (!asset) return null;
  const href =
    repo.provider === "github"
      ? asset.url
      : repo.provider === "gitea"
        ? asset.browser_download_url
        : (asset.direct_asset_url ?? asset.url);
  if (typeof href !== "string") return null;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.origin !== repo.origin) return null;
  if (repo.provider === "github")
    return url.protocol === "https:" && url.hostname === "api.github.com"
      ? { url, withToken: true, accept: "application/octet-stream" }
      : null;
  return { url, withToken: url.origin === repo.origin, accept: "*/*" };
}

/**
 * Where a directory entry's plugin lives, seen from its source: the
 * entry's own `provider`, GitHub for `owner/name`, the source's provider
 * for an address on the source's host, a known host's provider — else a
 * plain web server (`https`). `null` when the address doesn't parse.
 */
export function resolvePluginRepo(
  entry: { repo: string; provider?: GitProvider },
  source: GitRepo,
  options: { allowHttp?: boolean } = {},
): GitRepo | null {
  if (entry.provider) return parseGitRepo(entry.repo, entry.provider, options);
  if (SHORT_REPO_RE.test(entry.repo)) return parseGitRepo(entry.repo, "github");
  let url: URL;
  try {
    url = new URL(entry.repo);
  } catch {
    return null;
  }
  const provider =
    url.origin === source.origin && source.provider !== "https"
      ? source.provider
      : (detectProvider(url) ?? "https");
  return parseGitRepo(entry.repo, provider, options);
}

/** The page a person opens to look at a release — `null` for a plain web
 *  server, which has none. */
export function releasePageUrl(repo: GitRepo, version: string): string | null {
  const base = repoUrl(repo);
  const tag = enc(version);
  switch (repo.provider) {
    case "github":
    case "gitea":
      return `${base}/releases/tag/${tag}`;
    case "gitlab":
      return `${base}/-/releases/${tag}`;
    case "bitbucket":
      return `${base}/src/${tag}`;
    case "https":
      return null;
  }
}
