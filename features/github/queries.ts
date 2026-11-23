import "server-only";
import { cookies } from "next/headers";
import { appBaseUrl } from "@/lib/app-url";
import {
  appManifest,
  GITHUB_PATHS,
  isPublicBase,
  manageInstallationUrl,
} from "@/lib/github/app";
import {
  CHOICE_COOKIE,
  type GitHubAccount,
  openChoice,
  sealState,
} from "@/lib/github/state";
import { currentUserId } from "@/lib/permissions";
import { activationScopeKey } from "@/lib/plugins/activation";
import type { PluginManifest } from "@/lib/plugins/manifest";
import { getGitHubApp } from "./app";
import { placeConnections } from "./connections";

// What the GitHub parts of the plugin pages show (BARY-238).

export interface PluginConnectionView {
  title: string;
  /** The instance has a GitHub App to connect with. */
  appReady: boolean;
  connections: {
    rowId: string;
    account: string;
    accountType: string;
    avatar: string | null;
    /** The workspace's, seen from a project — taken off there. */
    inherited: boolean;
    manageUrl: string;
  }[];
  /** After signing in at GitHub: the installations the person may connect
   *  here and hasn't yet. */
  choice: GitHubAccount[] | null;
  /** Starts connecting: sign in (and install, if need be), or install on
   *  another account. */
  connectHref: string;
  installHref: string;
}

/** The connection card of a plugin's page — `null` when it connects to
 *  nothing. */
export async function getConnectionView(
  pluginId: string,
  manifest: PluginManifest,
  place: { workspaceId: string; projectId: string | null },
): Promise<PluginConnectionView | null> {
  const declared = manifest.contributes.connections?.find(
    (c) => c.provider === "github",
  );
  if (!declared) return null;
  const [app, connections, userId, store] = await Promise.all([
    getGitHubApp(),
    placeConnections(pluginId, place),
    currentUserId(),
    cookies(),
  ]);
  const picked = openChoice(store.get(CHOICE_COOKIE)?.value);
  const choice =
    picked &&
    picked.userId === userId &&
    picked.pluginId === pluginId &&
    picked.scopeKey === activationScopeKey(place)
      ? picked.installations.filter(
          (i) => !connections.some((c) => !c.inherited && c.id === i.id),
        )
      : null;
  const query = new URLSearchParams({
    plugin: pluginId,
    workspace: place.workspaceId,
    ...(place.projectId && { project: place.projectId }),
  });
  return {
    title: declared.title,
    appReady: app !== null,
    connections: connections.map((c) => ({
      rowId: c.rowId,
      account: c.account,
      accountType: c.accountType,
      avatar: c.avatar,
      inherited: c.inherited,
      manageUrl: manageInstallationUrl(c),
    })),
    choice,
    connectHref: `/api/github/connect?${query}`,
    installHref: `/api/github/connect?${query}&mode=install`,
  };
}

export interface GitHubAppAdminView {
  app: {
    name: string;
    htmlUrl: string;
    owner: string | null;
    fromEnv: boolean;
  } | null;
  /** To create it: the manifest GitHub reads, and the state it returns. */
  manifest: string;
  state: string;
  webhookUrl: string;
  /** Barynt runs on an address GitHub can't reach (localhost): the app
   *  comes without a webhook. */
  local: boolean;
}

/** The GitHub App card of Admin → Plugins — for a platform admin. */
export async function getGitHubAppAdminView(
  back: string,
): Promise<GitHubAppAdminView | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const app = await getGitHubApp();
  const base = appBaseUrl();
  return {
    app: app && {
      name: app.name,
      htmlUrl: app.htmlUrl,
      owner: app.owner,
      fromEnv: app.fromEnv,
    },
    manifest: JSON.stringify(
      appManifest({
        baseUrl: base,
        name: `Barynt ${new URL(base).hostname}`,
        public: true,
      }),
    ),
    state: sealState({ kind: "app", userId, back }),
    webhookUrl: `${base}${GITHUB_PATHS.webhook}`,
    local: !isPublicBase(base),
  };
}
