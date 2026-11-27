import "server-only";
import { db } from "@/lib/db";
import { isChosen, repositoryOfRequest } from "@/lib/github/app";
import type { GitHubAccount } from "@/lib/github/state";
import { activationScopeKey } from "@/lib/plugins/activation";
import type { PluginManifest } from "@/lib/plugins/manifest";
import { repositoryList } from "@/lib/plugins/settings";
import { type GitHubRepository, installationRepositories } from "./app";

// A plugin's connections to GitHub (BARY-238): installations of the
// instance's app, connected to a workspace or a project. A workspace's count
// for every project in it — that's what connecting "for the workspace" means.

export interface Place {
  workspaceId: string;
  projectId: string | null;
}

/** The scopes whose connections count in a place: its own, and in a
 *  project also its workspace's. */
export const connectionScopes = (place: Place): string[] =>
  place.projectId
    ? [
        activationScopeKey(place),
        activationScopeKey({ ...place, projectId: null }),
      ]
    : [activationScopeKey(place)];

export interface PlaceConnection extends GitHubAccount {
  rowId: string;
  /** Connected for the whole workspace, seen from a project. */
  inherited: boolean;
}

/** The connections that count in a place, its own first. */
export async function placeConnections(
  pluginId: string,
  place: Place,
): Promise<PlaceConnection[]> {
  const own = activationScopeKey(place);
  const rows = await db.pluginConnection.findMany({
    where: { pluginId, scopeKey: { in: connectionScopes(place) } },
    orderBy: { connectedAt: "asc" },
  });
  return rows
    .map((r) => ({
      rowId: r.id,
      id: r.installationId,
      account: r.account,
      accountType: r.accountType,
      avatar: r.accountAvatar,
      inherited: r.scopeKey !== own,
    }))
    .sort((a, b) => Number(a.inherited) - Number(b.inherited));
}

/** Everything the place's connections reach, by name — for the picker.
 *  `failed` names the accounts GitHub didn't answer for. */
export async function placeRepositories(
  pluginId: string,
  place: Place,
): Promise<{
  connections: PlaceConnection[];
  repositories: GitHubRepository[];
  failed: string[];
}> {
  const connections = await placeConnections(pluginId, place);
  const seen = new Set<string>();
  const repositories: GitHubRepository[] = [];
  const failed: string[] = [];
  for (const c of connections) {
    const repos = await installationRepositories(c.id).catch(() => null);
    if (!repos) {
      failed.push(c.account);
      continue;
    }
    for (const r of repos) {
      const key = r.fullName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      repositories.push(r);
    }
  }
  repositories.sort((a, b) => a.fullName.localeCompare(b.fullName));
  return { connections, repositories, failed };
}

/** The repositories a place chose: every `repositories` setting's value. */
export function chosenRepositories(
  manifest: PluginManifest,
  values: unknown,
): string[] {
  const stored = (values ?? {}) as Record<string, unknown>;
  return (manifest.contributes.settings ?? [])
    .filter((s) => s.type === "repositories")
    .flatMap((s) => repositoryList(stored[s.key]));
}

/**
 * The installation a plugin's request to api.github.com may go with: only
 * for `/repos/{owner}/{name}/…` of a repository the place chose, through a
 * connection on that owner's account. Anything else goes without — the
 * person sees nothing of GitHub through the plugin that the place's admins
 * didn't pick.
 */
export async function connectionFor(
  plugin: { pluginId: string; activationId: string; manifest: PluginManifest },
  place: Place,
  url: URL,
): Promise<string | null> {
  if (
    !plugin.manifest.contributes.connections?.some(
      (c) => c.provider === "github",
    )
  )
    return null;
  const repo = repositoryOfRequest(url);
  if (!repo) return null;
  const settings = await db.pluginSettings.findUnique({
    where: { activationId: plugin.activationId },
    select: { values: true },
  });
  if (!isChosen(repo, chosenRepositories(plugin.manifest, settings?.values)))
    return null;
  const owner = repo.split("/")[0].toLowerCase();
  const connection = (await placeConnections(plugin.pluginId, place)).find(
    (c) => c.account.toLowerCase() === owner,
  );
  return connection?.id ?? null;
}
