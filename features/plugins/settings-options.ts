import "server-only";
import { placeRepositories } from "@/features/github/connections";
import { db } from "@/lib/db";
import type { PluginManifest } from "@/lib/plugins/manifest";

// The choices of a plugin's `member`, `label` (BARY-204) and `status`
// (BARY-224) settings: the place's people, labels and statuses, not the
// manifest's. The form offers them, and
// both ways of saving (`savePluginSettings`, `settings.set`) check against
// the same list.

type Setting = NonNullable<PluginManifest["contributes"]["settings"]>[number];

export type PlacedSetting = Omit<Setting, "options"> & {
  options?: { id: string; label: string; color?: string; private?: boolean }[];
  /** A `repositories` setting: whether the place has a connection to list
   *  them from, and the accounts GitHub didn't answer for (BARY-238). */
  connected?: boolean;
  failed?: string[];
};

/** The manifest's settings with `member`, `label` and `status` given the
 *  place's options: in a project its members and the labels it shows, in the
 *  workspace its members and its own labels — the statuses are the
 *  workspace's in both. */
export async function placeSettings(
  scope: { workspaceId: string; projectId: string | null },
  settings: readonly Setting[],
  /** For the form: also list what `repositories` settings may pick from —
   *  asked of GitHub, so saving leaves it out (BARY-238). */
  repositoriesOf?: string,
): Promise<PlacedSetting[]> {
  const needs = (type: Setting["type"]) =>
    settings.some((s) => s.type === type);
  const [members, labels, statuses, repos] = await Promise.all([
    needs("member") ? placeMembers(scope) : [],
    needs("label") ? placeLabels(scope) : [],
    needs("status") ? placeStatuses(scope.workspaceId) : [],
    needs("repositories") && repositoriesOf
      ? placeRepositories(repositoriesOf, scope)
      : null,
  ]);
  const placed: Partial<Record<Setting["type"], PlacedSetting["options"]>> = {
    member: members,
    label: labels,
    status: statuses,
  };
  return settings.map((s) => {
    if (s.type === "repositories" && repos)
      return {
        ...s,
        options: repos.repositories.map((r) => ({
          id: r.fullName,
          label: r.fullName,
          private: r.private,
        })),
        connected: repos.connections.length > 0,
        failed: repos.failed,
      };
    return placed[s.type] ? { ...s, options: placed[s.type] } : s;
  });
}

async function placeMembers(scope: {
  workspaceId: string;
  projectId: string | null;
}) {
  const user = { select: { id: true, firstName: true, lastName: true } };
  const rows = scope.projectId
    ? await db.projectMember.findMany({
        where: { projectId: scope.projectId },
        select: { user },
      })
    : await db.workspaceMember.findMany({
        where: { workspaceId: scope.workspaceId, pending: false },
        select: { user },
      });
  return rows
    .map(({ user: u }) => ({
      id: u.id,
      label: `${u.firstName} ${u.lastName}`.trim(),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

async function placeLabels(scope: {
  workspaceId: string;
  projectId: string | null;
}) {
  const rows = await db.label.findMany({
    where: scope.projectId
      ? {
          workspaceId: scope.workspaceId,
          OR: [{ projectId: null }, { projectId: scope.projectId }],
          hiddenIn: { none: { projectId: scope.projectId } },
        }
      : { workspaceId: scope.workspaceId, projectId: null },
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });
  return rows.map((l) => ({ id: l.id, label: l.name, color: l.color }));
}

/** The workspace's statuses in board order — also what a `link` hook's
 *  rules pick from (BARY-227). */
export async function placeStatuses(workspaceId: string) {
  const rows = await db.workspaceStatus.findMany({
    where: { workspaceId },
    select: { status: { select: { id: true, name: true, color: true } } },
    orderBy: { status: { position: "asc" } },
  });
  return rows.map(({ status: s }) => ({
    id: s.id,
    label: s.name,
    color: s.color,
  }));
}
