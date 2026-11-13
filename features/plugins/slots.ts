import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { currentUserCanEnterWorkspace } from "@/lib/permissions";
import { activationScopeKey } from "@/lib/plugins/activation";
import { validateManifest } from "@/lib/plugins/manifest";
import { SLOTS, type SlotEntry, slotEntries } from "@/lib/plugins/slots";

// Where sandboxed plugins show in the sidebar (BARY-148): their views and
// pages, for the workspace and each project the person can see. Read once
// per request; what the entries open is checked again there
// (`getPluginSlotView`, `/api/plugins/frame`).

export interface PluginNavEntry extends SlotEntry {
  pluginId: string;
  pluginName: string;
  /** Under `…/plugin/<pluginId>/` — `view/<id>` or `page/<id>`. */
  path: string;
}

export interface PluginNav {
  /** On in the workspace: views for the main group, pages for "Plugins". */
  workspace: PluginNavEntry[];
  /** On in a project, by project id: under the project. */
  projects: Record<string, PluginNavEntry[]>;
}

export const getPluginNav = cache(
  async (
    workspaceId: string,
    visibleProjectIds: readonly string[],
  ): Promise<PluginNav> => {
    const empty: PluginNav = { workspace: [], projects: {} };
    if (!(await currentUserCanEnterWorkspace(workspaceId))) return empty;
    const activations = await db.pluginActivation.findMany({
      where: { workspaceId, enabled: true },
      select: { pluginId: true, projectId: true, capabilities: true },
    });
    if (activations.length === 0) return empty;
    const rows = await db.plugin.findMany({
      where: {
        pluginId: { in: [...new Set(activations.map((a) => a.pluginId))] },
        status: "active",
      },
      select: { pluginId: true, manifest: true },
    });
    const manifests = new Map(
      rows.flatMap((r) => {
        const parsed = validateManifest(r.manifest);
        return parsed.ok ? [[r.pluginId, parsed.manifest] as const] : [];
      }),
    );

    const nav: PluginNav = { workspace: [], projects: {} };
    for (const a of activations) {
      const manifest = manifests.get(a.pluginId);
      if (!manifest) continue;
      if (a.projectId && !visibleProjectIds.includes(a.projectId)) continue;
      const entries = slotEntries(manifest, a.capabilities).map((e) => ({
        ...e,
        pluginId: a.pluginId,
        pluginName: manifest.name,
        path: `plugin/${a.pluginId}/${SLOTS[e.kind].path ?? e.kind}/${e.id}`,
      }));
      if (!a.projectId) nav.workspace.push(...entries);
      else
        nav.projects[a.projectId] = [
          ...(nav.projects[a.projectId] ?? []),
          ...entries,
        ];
    }
    const byName = (x: PluginNavEntry, y: PluginNavEntry) =>
      x.pluginName.localeCompare(y.pluginName) ||
      x.title.localeCompare(y.title);
    nav.workspace.sort(byName);
    for (const list of Object.values(nav.projects)) list.sort(byName);
    return nav;
  },
);

/** The widgets the plugins switched on in a place bring — what a
 *  dashboard's gallery offers there (BARY-149). Whether one still runs is
 *  checked again when it's drawn. */
export async function getPluginWidgets(place: {
  workspaceId: string;
  projectId: string | null;
}): Promise<
  { pluginId: string; pluginName: string; widgetId: string; title: string }[]
> {
  const activations = await db.pluginActivation.findMany({
    where: { scopeKey: activationScopeKey(place), enabled: true },
    select: { pluginId: true, capabilities: true },
  });
  if (activations.length === 0) return [];
  const rows = await db.plugin.findMany({
    where: {
      pluginId: { in: activations.map((a) => a.pluginId) },
      status: "active",
    },
    select: { pluginId: true, manifest: true },
  });
  return activations
    .flatMap((a) => {
      const row = rows.find((r) => r.pluginId === a.pluginId);
      const parsed = row ? validateManifest(row.manifest) : null;
      if (!parsed?.ok) return [];
      return slotEntries(parsed.manifest, a.capabilities)
        .filter((e) => e.kind === "widget")
        .map((e) => ({
          pluginId: a.pluginId,
          pluginName: parsed.manifest.name,
          widgetId: e.id,
          title: e.title,
        }));
    })
    .sort(
      (x, y) =>
        x.pluginName.localeCompare(y.pluginName) ||
        x.title.localeCompare(y.title),
    );
}
