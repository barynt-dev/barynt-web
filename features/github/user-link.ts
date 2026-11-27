import "server-only";
import { db } from "@/lib/db";
import { loginTokenReaches } from "@/lib/github/app";
import { openSecret, sealSecret } from "@/lib/secret-box";
import {
  getGitHubApp,
  gitHubUser,
  refreshUserTokens,
  type UserTokens,
} from "./app";

// A person's own GitHub account (BARY-238), for plugins that work with
// GitHub: linked through the instance's app ("Connect GitHub" on a
// plugin's Personal tab), or — without one — the GitHub account they sign
// in to Barynt with, where its token reaches repositories. A plugin's
// request to GitHub then goes as them (`features/plugins/proxy.ts`).

const PURPOSE = "github-user";
/** Renewed this long before it runs out. */
const EARLY_MS = 60_000;

/** Keeps a person's link — again is fine, the newest wins. */
export async function saveUserLink(
  userId: string,
  tokens: UserTokens,
  user: { id: string; login: string; avatar: string | null },
): Promise<void> {
  const data = {
    githubId: user.id,
    login: user.login,
    avatar: user.avatar,
    accessCipher: sealSecret(tokens.access, PURPOSE),
    refreshCipher: tokens.refresh ? sealSecret(tokens.refresh, PURPOSE) : null,
    expiresAt: tokens.expiresAt,
    refreshExpiresAt: tokens.refreshExpiresAt,
  };
  await db.gitHubUserLink.upsert({
    where: { userId },
    create: { userId, ...data },
    update: { ...data, connectedAt: new Date() },
  });
}

export async function removeUserLink(userId: string): Promise<void> {
  await db.gitHubUserLink.deleteMany({ where: { userId } });
}

const fresh = (expiresAt: Date | null) =>
  !expiresAt || expiresAt.getTime() - EARLY_MS > Date.now();

/** The linked account's token, renewed when it's about to run out. `null`
 *  without a link, or once it can't be renewed (they connect again). */
async function linkToken(userId: string): Promise<string | null> {
  const link = await db.gitHubUserLink.findUnique({ where: { userId } });
  if (!link) return null;
  if (fresh(link.expiresAt)) return openSecret(link.accessCipher, PURPOSE);
  const refresh = link.refreshCipher
    ? openSecret(link.refreshCipher, PURPOSE)
    : null;
  if (!refresh || !fresh(link.refreshExpiresAt)) return null;
  const tokens = await refreshUserTokens(refresh);
  if (!tokens) return null;
  await saveUserLink(userId, tokens, {
    id: link.githubId,
    login: link.login,
    avatar: link.avatar,
  });
  return tokens.access;
}

/** The account they sign in to Barynt with, when it's GitHub's. */
async function loginAccount(userId: string) {
  return db.account.findFirst({
    where: { userId, provider: "github", access_token: { not: null } },
    select: {
      id: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
      scope: true,
    },
  });
}

/** The sign-in's token, when it reaches repositories and is still good —
 *  renewed through the app where it's the app's. */
async function loginToken(userId: string): Promise<string | null> {
  const [account, app] = await Promise.all([
    loginAccount(userId),
    getGitHubApp(),
  ]);
  if (!account?.access_token) return null;
  const appClient = app?.clientId ?? null;
  if (!loginTokenReaches(account, process.env.AUTH_GITHUB_ID, appClient))
    return null;
  const expiresAt = account.expires_at
    ? new Date(account.expires_at * 1000)
    : null;
  if (fresh(expiresAt)) return account.access_token;
  if (!account.refresh_token || process.env.AUTH_GITHUB_ID !== appClient)
    return null;
  const tokens = await refreshUserTokens(account.refresh_token);
  if (!tokens) return null;
  await db.account.update({
    where: { id: account.id },
    data: {
      access_token: tokens.access,
      refresh_token: tokens.refresh ?? account.refresh_token,
      expires_at: tokens.expiresAt
        ? Math.floor(tokens.expiresAt.getTime() / 1000)
        : null,
    },
  });
  return tokens.access;
}

/** The token a plugin's request to GitHub goes with as this person: their
 *  linked account's, else their sign-in's. `null` without either. */
export async function userGitHubToken(userId: string): Promise<string | null> {
  return (await linkToken(userId)) ?? (await loginToken(userId));
}

export interface UserLinkView {
  /** The instance has its app — connecting works. */
  appReady: boolean;
  /** The account plugins act as. */
  account: {
    login: string;
    avatar: string | null;
    /** Linked here, or taken from the sign-in with GitHub. */
    via: "link" | "login";
    /** The link can't be renewed any more: connect again. */
    expired?: boolean;
  } | null;
  /** Signed in with GitHub, but that token doesn't reach repositories —
   *  one click links it. */
  signedInAs: string | null;
}

/** What the Personal tab shows of a person's GitHub account. */
export async function getUserLinkView(userId: string): Promise<UserLinkView> {
  const [link, app, account] = await Promise.all([
    db.gitHubUserLink.findUnique({ where: { userId } }),
    getGitHubApp(),
    loginAccount(userId),
  ]);
  const appReady = app !== null;
  if (link)
    return {
      appReady,
      account: {
        login: link.login,
        avatar: link.avatar,
        via: "link",
        ...((await linkToken(userId)) === null && { expired: true }),
      },
      signedInAs: null,
    };
  const loginUser = account?.access_token
    ? await gitHubUser(account.access_token)
    : null;
  if (loginUser && (await loginToken(userId)))
    return {
      appReady,
      account: {
        login: loginUser.login,
        avatar: loginUser.avatar,
        via: "login",
      },
      signedInAs: null,
    };
  return { appReady, account: null, signedInAs: loginUser?.login ?? null };
}
