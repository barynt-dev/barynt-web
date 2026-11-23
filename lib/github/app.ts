import { createSign } from "node:crypto";

// The GitHub App of a Barynt instance (BARY-238), the parts that need no
// network and no database: the manifest GitHub creates it from, the JWT it
// signs in with, the addresses a person is sent to, and which repository an
// API request is about. The calls are `features/github/app.ts`.
//
// Why an app and not an OAuth app or tokens: as Linear, Plane or Jira do,
// it's installed once on an organization, where its owner picks the
// repositories; its webhooks reach Barynt without anyone adding one per
// repository; and its tokens act for the installation, not for a person
// who might leave.

export const GITHUB_API = "https://api.github.com";
export const GITHUB_WEB = "https://github.com";

/** What the app may do in a repository: read what the plugin shows, and
 *  write refs to start a branch. Metadata is always granted. */
export const APP_PERMISSIONS = {
  contents: "write",
  pull_requests: "read",
  checks: "read",
  metadata: "read",
} as const;

/** The webhook events the GitHub plugin's `link` hook reads. */
export const APP_EVENTS = [
  "create",
  "delete",
  "push",
  "pull_request",
  "pull_request_review",
  "check_run",
  "check_suite",
] as const;

/** Barynt's paths GitHub calls or sends people to. */
export const GITHUB_PATHS = {
  created: "/api/github/app/created",
  callback: "/api/github/callback",
  webhook: "/api/github/webhook",
} as const;

/**
 * The manifest GitHub creates the app from (the manifest flow): a click in
 * Admin → Plugins sends it to GitHub, GitHub shows it, and returns with a
 * code Barynt trades for the app's keys. `public` lets it be installed on
 * any account — needed when it's created on a person's account but the
 * repositories belong to an organization.
 */
export function appManifest(input: {
  baseUrl: string;
  name: string;
  public: boolean;
}) {
  const base = input.baseUrl.replace(/\/+$/, "");
  return {
    name: input.name.slice(0, 34),
    url: base,
    description: "Pull requests, branches and checks on Barynt's issues.",
    hook_attributes: { url: `${base}${GITHUB_PATHS.webhook}`, active: true },
    redirect_url: `${base}${GITHUB_PATHS.created}`,
    callback_urls: [`${base}${GITHUB_PATHS.callback}`],
    // After installing, GitHub asks the person to sign in, so Barynt can
    // see the installation is theirs before it connects it.
    request_oauth_on_install: true,
    setup_on_update: true,
    public: input.public,
    default_permissions: APP_PERMISSIONS,
    default_events: [...APP_EVENTS],
  };
}

/** Where the manifest is posted: a person's account, or an organization. */
export function newAppUrl(organization: string | null, state: string): string {
  const path = organization
    ? `/organizations/${encodeURIComponent(organization)}/settings/apps/new`
    : "/settings/apps/new";
  return `${GITHUB_WEB}${path}?state=${encodeURIComponent(state)}`;
}

/** Install the app on an account, choosing the repositories there. */
export function installUrl(slug: string, state: string): string {
  return `${GITHUB_WEB}/apps/${encodeURIComponent(slug)}/installations/new?state=${encodeURIComponent(state)}`;
}

/** Sign in with GitHub as the app — to see the person's installations. */
export function authorizeUrl(
  clientId: string,
  state: string,
  redirectUri: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    state,
    redirect_uri: redirectUri,
  });
  return `${GITHUB_WEB}/login/oauth/authorize?${params}`;
}

/** Where an installation's repositories are changed on GitHub. */
export function manageInstallationUrl(installation: {
  id: string;
  account: string;
  accountType: string;
}): string {
  return installation.accountType === "Organization"
    ? `${GITHUB_WEB}/organizations/${encodeURIComponent(installation.account)}/settings/installations/${installation.id}`
    : `${GITHUB_WEB}/settings/installations/${installation.id}`;
}

const b64url = (value: string | Buffer) =>
  Buffer.from(value).toString("base64url");

/**
 * The JWT the app signs in with (RS256, ten minutes at most): backdated a
 * minute for a clock that runs behind, nine minutes ahead.
 */
export function appJwt(
  appId: string,
  privateKey: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ iat: nowSeconds - 60, exp: nowSeconds + 540, iss: appId }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(privateKey).toString("base64url")}`;
}

/** A private key from the environment: one line with `\n`, or as is. */
export const readPrivateKey = (value: string) =>
  value.includes("\\n") ? value.replaceAll("\\n", "\n") : value;

/**
 * The repository an API request is about — `/repos/{owner}/{name}/…` —
 * or `null` for any other address. Only such a request may go with an
 * installation's token, and only for a repository the place chose.
 */
export function repositoryOfRequest(url: URL): string | null {
  if (url.hostname !== "api.github.com") return null;
  const [, first, owner, name] = url.pathname.split("/");
  if (first !== "repos" || !owner || !name) return null;
  try {
    return `${decodeURIComponent(owner)}/${decodeURIComponent(name)}`;
  } catch {
    return null;
  }
}

/** Is `repo` one of `chosen`, as GitHub compares names — without case? */
export const isChosen = (repo: string, chosen: readonly string[]) =>
  chosen.some((c) => c.toLowerCase() === repo.toLowerCase());
