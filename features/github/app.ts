import "server-only";
import { db } from "@/lib/db";
import {
  appJwt,
  GITHUB_API,
  GITHUB_WEB,
  readPrivateKey,
} from "@/lib/github/app";
import type { GitHubAccount } from "@/lib/github/state";
import { openSecret, sealSecret } from "@/lib/secret-box";

// The instance's GitHub App (BARY-238): where its keys come from, the
// tokens it gets for an installation, and what it reads there. Barynt calls
// GitHub here itself — this is Barynt's own integration, not a plugin's
// request (those go through the host proxy, `features/plugins/proxy.ts`).

const PURPOSE = "github-app";
const TIMEOUT_MS = 10_000;

export interface GitHubAppConfig {
  appId: string;
  slug: string;
  name: string;
  htmlUrl: string;
  owner: string | null;
  clientId: string;
  clientSecret: string;
  privateKey: string;
  webhookSecret: string;
  /** Set by the environment (`GITHUB_APP_*`) — then it's only shown. */
  fromEnv: boolean;
}

/** The app from `GITHUB_APP_*`, when all of it is set. */
function fromEnv(): GitHubAppConfig | null {
  const e = process.env;
  if (
    !e.GITHUB_APP_ID ||
    !e.GITHUB_APP_SLUG ||
    !e.GITHUB_APP_CLIENT_ID ||
    !e.GITHUB_APP_CLIENT_SECRET ||
    !e.GITHUB_APP_PRIVATE_KEY ||
    !e.GITHUB_APP_WEBHOOK_SECRET
  )
    return null;
  return {
    appId: e.GITHUB_APP_ID,
    slug: e.GITHUB_APP_SLUG,
    name: e.GITHUB_APP_SLUG,
    htmlUrl: `${GITHUB_WEB}/apps/${e.GITHUB_APP_SLUG}`,
    owner: null,
    clientId: e.GITHUB_APP_CLIENT_ID,
    clientSecret: e.GITHUB_APP_CLIENT_SECRET,
    privateKey: readPrivateKey(e.GITHUB_APP_PRIVATE_KEY),
    webhookSecret: e.GITHUB_APP_WEBHOOK_SECRET,
    fromEnv: true,
  };
}

/** The app: from the environment, else the one created in Admin →
 *  Plugins. `null` while there's none. */
export async function getGitHubApp(): Promise<GitHubAppConfig | null> {
  const env = fromEnv();
  if (env) return env;
  const row = await db.gitHubApp.findUnique({ where: { id: "github" } });
  if (!row) return null;
  const clientSecret = openSecret(row.clientSecretCipher, PURPOSE);
  const privateKey = openSecret(row.privateKeyCipher, PURPOSE);
  const webhookSecret = openSecret(row.webhookSecretCipher, PURPOSE);
  // A changed AUTH_SECRET: it has to be created again.
  if (!clientSecret || !privateKey || !webhookSecret) return null;
  return {
    appId: row.appId,
    slug: row.slug,
    name: row.name,
    htmlUrl: row.htmlUrl,
    owner: row.owner,
    clientId: row.clientId,
    clientSecret,
    privateKey,
    webhookSecret,
    fromEnv: false,
  };
}

/** One call to GitHub's API: the status and the parsed answer. */
async function call<T>(
  path: string,
  init: { token?: string; jwt?: string; method?: string; body?: unknown } = {},
): Promise<{ status: number; data: T | null }> {
  const auth = init.jwt ?? init.token;
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Barynt",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(auth && { Authorization: `Bearer ${auth}` }),
      ...(init.body !== undefined && { "Content-Type": "application/json" }),
    },
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {}
  return { status: res.status, data };
}

/**
 * Trades the code GitHub returns after the manifest flow for the app's
 * keys and keeps them, sealed. Replaces an app created before.
 */
export async function createAppFromCode(
  code: string,
  createdById: string,
): Promise<{ ok: true; name: string } | { error: string }> {
  const res = await call<{
    id?: number;
    slug?: string;
    name?: string;
    html_url?: string;
    owner?: { login?: string };
    client_id?: string;
    client_secret?: string;
    webhook_secret?: string;
    pem?: string;
  }>(`/app-manifests/${encodeURIComponent(code)}/conversions`, {
    method: "POST",
  });
  const d = res.data;
  if (
    res.status !== 201 ||
    !d?.id ||
    !d.slug ||
    !d.client_id ||
    !d.client_secret ||
    !d.webhook_secret ||
    !d.pem
  )
    return { error: "github_app_failed" };
  const data = {
    appId: String(d.id),
    slug: d.slug,
    name: d.name ?? d.slug,
    htmlUrl: d.html_url ?? `${GITHUB_WEB}/apps/${d.slug}`,
    owner: d.owner?.login ?? null,
    clientId: d.client_id,
    clientSecretCipher: sealSecret(d.client_secret, PURPOSE),
    privateKeyCipher: sealSecret(d.pem, PURPOSE),
    webhookSecretCipher: sealSecret(d.webhook_secret, PURPOSE),
    createdById,
  };
  const before = await db.gitHubApp.findUnique({
    where: { id: "github" },
    select: { appId: true },
  });
  await db.$transaction([
    db.gitHubApp.upsert({
      where: { id: "github" },
      create: data,
      update: data,
    }),
    // Installations belong to an app: those of the one before can't be
    // reached with the new one, so their connections go — connect again.
    ...(before && before.appId !== data.appId
      ? [db.pluginConnection.deleteMany({ where: { provider: "github" } })]
      : []),
  ]);
  tokens.clear();
  repoCache.clear();
  return { ok: true, name: data.name };
}

// ─── Installations ──────────────────────────────────────────────────────────

/** Installation tokens hold an hour; one is used until five minutes before. */
const tokens = new Map<string, { token: string; expires: number }>();

/** A token for an installation — `null` when GitHub won't give one (it was
 *  uninstalled, or the app is gone). */
export async function installationToken(
  installationId: string,
): Promise<string | null> {
  const cached = tokens.get(installationId);
  if (cached && cached.expires - 5 * 60_000 > Date.now()) return cached.token;
  const app = await getGitHubApp();
  if (!app) return null;
  const res = await call<{ token?: string; expires_at?: string }>(
    `/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    { method: "POST", jwt: appJwt(app.appId, app.privateKey) },
  );
  if (res.status !== 201 || !res.data?.token) {
    tokens.delete(installationId);
    return null;
  }
  tokens.set(installationId, {
    token: res.data.token,
    expires: res.data.expires_at
      ? Date.parse(res.data.expires_at)
      : Date.now() + 60 * 60_000,
  });
  return res.data.token;
}

type ApiAccount = { login?: string; type?: string; avatar_url?: string };
type ApiInstallation = { id?: number; account?: ApiAccount | null };

const accountOf = (i: ApiInstallation): GitHubAccount | null =>
  i.id && i.account?.login
    ? {
        id: String(i.id),
        account: i.account.login,
        accountType: i.account.type ?? "User",
        avatar: i.account.avatar_url ?? null,
      }
    : null;

/** An installation as the app sees it. */
export async function getInstallation(
  installationId: string,
): Promise<GitHubAccount | null> {
  const app = await getGitHubApp();
  if (!app) return null;
  const res = await call<ApiInstallation>(
    `/app/installations/${encodeURIComponent(installationId)}`,
    { jwt: appJwt(app.appId, app.privateKey) },
  );
  return res.status === 200 && res.data ? accountOf(res.data) : null;
}

/** Kept a minute: what the app and its installations were granted. */
const grantsCache = new Map<string, { at: number; value: AppGrants | null }>();
const GRANTS_TTL_MS = 60_000;

export interface AppGrants {
  permissions: Record<string, string>;
  events: string[];
  owner: { login: string; type: string } | null;
}

async function cachedGrants(
  key: string,
  load: () => Promise<AppGrants | null>,
): Promise<AppGrants | null> {
  const hit = grantsCache.get(key);
  if (hit && Date.now() - hit.at < GRANTS_TTL_MS) return hit.value;
  const value = await load().catch(() => null);
  grantsCache.set(key, { at: Date.now(), value });
  return value;
}

/** What the app itself may do and is sent — `null` when GitHub doesn't
 *  answer. */
export async function appGrants(): Promise<AppGrants | null> {
  const app = await getGitHubApp();
  if (!app) return null;
  return cachedGrants(`app:${app.appId}`, async () => {
    const res = await call<{
      permissions?: Record<string, string>;
      events?: string[];
      owner?: { login?: string; type?: string } | null;
    }>("/app", { jwt: appJwt(app.appId, app.privateKey) });
    if (res.status !== 200 || !res.data) return null;
    const owner = res.data.owner;
    return {
      permissions: res.data.permissions ?? {},
      events: res.data.events ?? [],
      owner:
        owner?.login && owner.type
          ? { login: owner.login, type: owner.type }
          : null,
    };
  });
}

/** What an installation's owner accepted — an app given new permissions
 *  waits for them to accept those. */
export async function installationGrants(
  installationId: string,
): Promise<AppGrants | null> {
  const app = await getGitHubApp();
  if (!app) return null;
  return cachedGrants(`installation:${installationId}`, async () => {
    const res = await call<{
      permissions?: Record<string, string>;
      events?: string[];
    }>(`/app/installations/${encodeURIComponent(installationId)}`, {
      jwt: appJwt(app.appId, app.privateKey),
    });
    if (res.status !== 200 || !res.data) return null;
    return {
      permissions: res.data.permissions ?? {},
      events: res.data.events ?? [],
      owner: null,
    };
  });
}

/** A call to GitHub's API as an installation. `null` without a token. */
export async function asInstallation<T>(
  installationId: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ status: number; data: T | null } | null> {
  const token = await installationToken(installationId);
  if (!token) return null;
  return call<T>(path, { ...init, token });
}

/** A call to GitHub's API as a person, with their token. */
export function asUser<T>(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ status: number; data: T | null }> {
  return call<T>(path, { ...init, token });
}

/** Forgets what an installation reaches — a repository was just added. */
export function forgetRepositories(installationId: string) {
  repoCache.delete(installationId);
}

export interface GitHubRepository {
  fullName: string;
  private: boolean;
  /** `public`, `private`, or `internal` (an enterprise's own). */
  visibility: "public" | "private" | "internal";
  archived: boolean;
  fork: boolean;
  description: string | null;
  /** Its page on GitHub. */
  url: string;
  installationId: string;
}

/** What an installation reaches, kept a minute — the settings page asks
 *  each time it's drawn. */
const repoCache = new Map<
  string,
  { at: number; repos: GitHubRepository[] | null }
>();

/** The repositories an installation may see — `null` when GitHub won't
 *  say (uninstalled, suspended). At most a thousand. */
export async function installationRepositories(
  installationId: string,
): Promise<GitHubRepository[] | null> {
  const cached = repoCache.get(installationId);
  if (cached && Date.now() - cached.at < 60_000) return cached.repos;
  const token = await installationToken(installationId);
  let repos: GitHubRepository[] | null = null;
  if (token) {
    repos = [];
    for (let page = 1; page <= 10; page++) {
      const res = await call<{
        total_count?: number;
        repositories?: {
          full_name?: string;
          private?: boolean;
          visibility?: string;
          archived?: boolean;
          fork?: boolean;
          description?: string | null;
          html_url?: string;
        }[];
      }>(`/installation/repositories?per_page=100&page=${page}`, { token });
      if (res.status !== 200) {
        repos = page === 1 ? null : repos;
        break;
      }
      const list = res.data?.repositories ?? [];
      for (const r of list)
        if (r.full_name)
          repos.push({
            fullName: r.full_name,
            private: r.private === true,
            visibility:
              r.visibility === "internal"
                ? "internal"
                : r.private
                  ? "private"
                  : "public",
            archived: r.archived === true,
            fork: r.fork === true,
            description: r.description?.trim().slice(0, 200) || null,
            url: r.html_url ?? `${GITHUB_WEB}/${r.full_name}`,
            installationId,
          });
      if (list.length < 100) break;
    }
  }
  repoCache.set(installationId, { at: Date.now(), repos });
  return repos;
}

// ─── A person, signed in at GitHub ──────────────────────────────────────────

/** Trades the code of GitHub's sign-in for the person's token — only used
 *  to list their installations, never kept. */
/** A person's token from the app, with what renews it. */
export interface UserTokens {
  access: string;
  refresh: string | null;
  /** When the token runs out — `null` for one that doesn't. */
  expiresAt: Date | null;
  refreshExpiresAt: Date | null;
}

/** Asks GitHub for a person's token: for the code they came back with, or
 *  a new one for their refresh token. */
async function userTokens(
  grant: { code: string } | { refresh_token: string },
): Promise<UserTokens | null> {
  const app = await getGitHubApp();
  if (!app) return null;
  const res = await fetch(`${GITHUB_WEB}/login/oauth/access_token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Barynt",
    },
    body: JSON.stringify({
      client_id: app.clientId,
      client_secret: app.clientSecret,
      ...grant,
      ...("refresh_token" in grant && { grant_type: "refresh_token" }),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    refresh_token_expires_in?: number;
  } | null;
  if (!data?.access_token) return null;
  const at = (seconds?: number) =>
    typeof seconds === "number" ? new Date(Date.now() + seconds * 1000) : null;
  return {
    access: data.access_token,
    refresh: data.refresh_token ?? null,
    expiresAt: at(data.expires_in),
    refreshExpiresAt: at(data.refresh_token_expires_in),
  };
}

/** The person's token for the code they came back from GitHub with. */
export async function exchangeUserCode(code: string): Promise<string | null> {
  return (await userTokens({ code }))?.access ?? null;
}

/** Their tokens for the code, refresh token included. */
export const exchangeUserCodeTokens = (code: string) => userTokens({ code });

/** New tokens for a refresh token. */
export const refreshUserTokens = (refresh: string) =>
  userTokens({ refresh_token: refresh });

/** Who a person's token belongs to on GitHub. */
export async function gitHubUser(
  token: string,
): Promise<{ id: string; login: string; avatar: string | null } | null> {
  const res = await call<{ id?: number; login?: string; avatar_url?: string }>(
    "/user",
    { token },
  );
  if (res.status !== 200 || !res.data?.login || !res.data.id) return null;
  return {
    id: String(res.data.id),
    login: res.data.login,
    avatar: res.data.avatar_url ?? null,
  };
}

/** The app's installations the person can reach on GitHub — the ones they
 *  may connect. */
export async function userInstallations(
  userToken: string,
): Promise<GitHubAccount[]> {
  const res = await call<{ installations?: ApiInstallation[] }>(
    "/user/installations?per_page=100",
    { token: userToken },
  );
  if (res.status !== 200) return [];
  return (res.data?.installations ?? []).flatMap((i) => {
    const a = accountOf(i);
    return a ? [a] : [];
  });
}

/** Forgets what's kept of an installation — after GitHub says it's gone. */
export function forgetInstallation(installationId: string) {
  tokens.delete(installationId);
  repoCache.delete(installationId);
}
