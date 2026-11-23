import "server-only";
import { cookies } from "next/headers";
import { appBaseUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
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
import { pluginSettingsPath } from "@/lib/nav";
import { currentUserId } from "@/lib/permissions";
import { activationScopeKey } from "@/lib/plugins/activation";
import type { PluginManifest } from "@/lib/plugins/manifest";
import type { GitHubRepository } from "./app";
import { getGitHubApp } from "./app";
import { chosenRepositories, placeRepositories } from "./connections";

// What the GitHub parts of the plugin pages show (BARY-238).

export interface ConnectionRepository {
  fullName: string;
  visibility: "public" | "private" | "internal";
  archived: boolean;
  fork: boolean;
  description: string | null;
  url: string;
  /** Chosen by a project, but no connection reaches it (any more). */
  unreachable: boolean;
  projects: { name: string; color: string; href: string }[];
}

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
    /** GitHub gives no token for it any more: uninstalled, or the app was
     *  created anew — connect again. */
    broken: boolean;
  }[];
  /** After signing in at GitHub: the installations the person may connect
   *  here and hasn't yet. */
  choice: GitHubAccount[] | null;
  /** In the workspace, once connected: every repository the connections
   *  reach — and any a project chose that they don't — with the projects
   *  that work with it. `null` in a project. */
  repositories: ConnectionRepository[] | null;
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
  const [app, reach, userId, store] = await Promise.all([
    getGitHubApp(),
    placeRepositories(pluginId, place),
    currentUserId(),
    cookies(),
  ]);
  const { connections } = reach;
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
      broken: reach.failed.includes(c.account),
    })),
    choice,
    repositories:
      place.projectId === null && connections.length > 0
        ? await workspaceRepositories(
            pluginId,
            manifest,
            place.workspaceId,
            reach.repositories,
          )
        : null,
    connectHref: `/api/github/connect?${query}`,
    installHref: `/api/github/connect?${query}&mode=install`,
  };
}

/** Which project works with which repository, across the workspace. */
async function workspaceRepositories(
  pluginId: string,
  manifest: PluginManifest,
  workspaceId: string,
  reached: GitHubRepository[],
): Promise<ConnectionRepository[]> {
  const activations = await db.pluginActivation.findMany({
    where: { pluginId, workspaceId, enabled: true, projectId: { not: null } },
    select: { projectId: true, settings: { select: { values: true } } },
  });
  const projects = await db.project.findMany({
    where: { id: { in: activations.flatMap((a) => a.projectId ?? []) } },
    select: { id: true, name: true, slug: true, color: true },
  });
  const rows = new Map<string, ConnectionRepository>();
  for (const r of reached)
    rows.set(r.fullName.toLowerCase(), {
      fullName: r.fullName,
      visibility: r.visibility,
      archived: r.archived,
      fork: r.fork,
      description: r.description,
      url: r.url,
      unreachable: false,
      projects: [],
    });
  for (const a of activations) {
    const project = projects.find((p) => p.id === a.projectId);
    if (!project) continue;
    for (const name of chosenRepositories(manifest, a.settings?.values)) {
      const key = name.toLowerCase();
      const row = rows.get(key) ?? {
        fullName: name,
        visibility: "public" as const,
        archived: false,
        fork: false,
        description: null,
        url: `https://github.com/${name}`,
        unreachable: true,
        projects: [],
      };
      row.projects.push({
        name: project.name,
        color: project.color,
        href: pluginSettingsPath(workspaceId, project.slug, pluginId),
      });
      rows.set(key, row);
    }
  }
  // Linked first, then by name.
  return [...rows.values()].sort(
    (a, b) =>
      Number(b.projects.length > 0) - Number(a.projects.length > 0) ||
      a.fullName.localeCompare(b.fullName),
  );
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
