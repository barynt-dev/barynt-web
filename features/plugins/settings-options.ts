import "server-only";
import { db } from "@/lib/db";
import type { PluginManifest } from "@/lib/plugins/manifest";

// The choices of a plugin's `member` and `label` settings (BARY-204): the
// place's people and labels, not the manifest's. The form offers them, and
// both ways of saving (`savePluginSettings`, `settings.set`) check against
// the same list.

type Setting = NonNullable<PluginManifest["contributes"]["settings"]>[number];

export type PlacedSetting = Omit<Setting, "options"> & {
  options?: { id: string; label: string; color?: string }[];
};

/** The manifest's settings with `member` and `label` given the place's
 *  options: in a project its members and the labels it shows, in the
 *  workspace its members and its own labels. */
export async function placeSettings(
  scope: { workspaceId: string; projectId: string | null },
  settings: readonly Setting[],
): Promise<PlacedSetting[]> {
  const needs = (type: Setting["type"]) =>
    settings.some((s) => s.type === type);
  const [members, labels] = await Promise.all([
    needs("member") ? placeMembers(scope) : [],
    needs("label") ? placeLabels(scope) : [],
  ]);
  return settings.map((s) =>
    s.type === "member"
      ? { ...s, options: members }
      : s.type === "label"
        ? { ...s, options: labels }
        : s,
  );
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
