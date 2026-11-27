import "server-only";
import { cache } from "react";
import { pluginFilterField } from "@/features/issues/filter";
import { db } from "@/lib/db";
import {
  type FilterEntry,
  filterOptions,
  type PluginFilterDef,
  type PluginFilterFacet,
} from "@/lib/plugins/filters";
import { validateManifest } from "@/lib/plugins/manifest";

// A plugin's filters in Barynt's filter menu (BARY-238): where they come
// from — the manifests of the plugins switched on here — and what they
// match: the entries those plugins keep on issues (`PluginIssueData`).

/** The manifests of these plugins that are active — translated. */
const manifests = cache(async (pluginIds: string[], locale?: string) => {
  if (pluginIds.length === 0) return [];
  const rows = await db.plugin.findMany({
    where: { pluginId: { in: pluginIds }, status: "active" },
    select: { pluginId: true, manifest: true },
  });
  return rows.flatMap((row) => {
    const parsed = validateManifest(row.manifest, locale);
    return parsed.ok
      ? [{ pluginId: row.pluginId, manifest: parsed.manifest }]
      : [];
  });
});

/** What a plugin keeps of one kind, in a workspace — every place it's on. */
async function entriesOf(
  pluginId: string,
  kind: string,
  workspaceId: string | null,
): Promise<FilterEntry[]> {
  return db.pluginIssueData.findMany({
    where: {
      activation: {
        pluginId,
        enabled: true,
        ...(workspaceId && { workspaceId }),
      },
      value: { path: ["kind"], equals: kind },
    },
    select: { issueId: true, value: true },
  });
}

/**
 * One filter and the entries it matches — for a rule on it
 * (`filterContext`). `null` once the plugin or the filter is gone.
 */
export async function pluginFilterSource(
  pluginId: string,
  filterId: string,
  workspaceId: string | null,
): Promise<{ def: PluginFilterDef; entries: FilterEntry[] } | null> {
  const [found] = await manifests([pluginId]);
  const def = found?.manifest.contributes.filters?.find(
    (f) => f.id === filterId,
  );
  if (!def) return null;
  return { def, entries: await entriesOf(pluginId, def.kind, workspaceId) };
}

/**
 * The plugins' filters for the filter menu: of the plugins switched on in
 * this project — or, across projects, anywhere in the workspace — with
 * their options; a filter of values offers the values found.
 */
export const getPluginFilters = cache(
  async (
    workspaceId: string,
    projectId: string | null,
    locale?: string,
  ): Promise<PluginFilterFacet[]> => {
    const on = await db.pluginActivation.findMany({
      where: {
        workspaceId,
        enabled: true,
        ...(projectId ? { projectId } : { projectId: { not: null } }),
      },
      select: { pluginId: true },
    });
    const plugins = await manifests(
      [...new Set(on.map((a) => a.pluginId))].sort(),
      locale,
    );
    const facets: PluginFilterFacet[] = [];
    for (const { pluginId, manifest } of plugins)
      for (const def of manifest.contributes.filters ?? []) {
        const entries = def.values
          ? await entriesOf(pluginId, def.kind, workspaceId)
          : [];
        const options = filterOptions(def, entries);
        // Nothing to pick — or, made of values alone, one value: no choice
        // (a project with one repository).
        if (options.length === 0 || (!def.options && options.length < 2))
          continue;
        facets.push({
          field: pluginFilterField(pluginId, def.id),
          pluginName: manifest.name,
          title: def.title,
          ...(def.icon && { icon: def.icon }),
          menu: def.menu ?? "advanced",
          options,
        });
      }
    return facets;
  },
);
