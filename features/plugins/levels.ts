import "server-only";
import {
  getCurrentWorkspace,
  getMyWorkspaces,
  getWorkspaceProjects,
} from "@/features/workspaces/queries";
import { type PluginLevel, pluginPath } from "@/lib/nav";
import { defaultProject } from "@/lib/plugins/levels";
import type {
  PluginLevelKey,
  PluginLevelTab,
} from "./components/PluginLevels/PluginLevels";
import { getPluginsArea, type PluginsAreaPlugin } from "./queries";

export interface PluginLevelsView {
  plugin: PluginsAreaPlugin;
  levels: PluginLevelTab[];
  /** The open project or workspace, and the others to switch to. */
  subject?: {
    name: string;
    color: string;
    image?: string;
    siblings: {
      id: string;
      name: string;
      color: string;
      image?: string;
      href: string;
    }[];
  };
}

/**
 * A plugin's levels in the plugins' area (BARY-238) as this person may
 * open them, for the page at `active` — `null` where it has none here, or
 * not the one asked for.
 */
export async function getPluginLevels(
  workspaceId: string,
  pluginId: string,
  active: PluginLevel,
): Promise<PluginLevelsView | null> {
  const projects = await getWorkspaceProjects();
  const plugin = (await getPluginsArea(workspaceId, projects)).find(
    (p) => p.pluginId === pluginId,
  );
  if (!plugin) return null;

  const open =
    active.kind === "project"
      ? plugin.projects.find((p) => p.slug === active.slug)
      : null;
  if (active.kind === "project" && !open) return null;
  if (active.kind === "workspace" && !plugin.workspace) return null;
  if (active.kind === "personal" && !plugin.personal) return null;

  const project = open ?? defaultProject(plugin);
  const levels: PluginLevelTab[] = (
    [
      plugin.personal && { kind: "personal" },
      project && { kind: "project", slug: project.slug },
      plugin.workspace && { kind: "workspace" },
    ] as (PluginLevel | false | null)[]
  )
    .filter((l): l is PluginLevel => !!l)
    .map((level) => ({
      key: level.kind as PluginLevelKey,
      href: pluginPath(workspaceId, pluginId, level),
    }));

  if (open)
    return {
      plugin,
      levels,
      subject: {
        name: open.name,
        color: open.color,
        image: open.avatarUrl ?? undefined,
        siblings: plugin.projects.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          image: p.avatarUrl ?? undefined,
          href: pluginPath(workspaceId, pluginId, {
            kind: "project",
            slug: p.slug,
          }),
        })),
      },
    };
  if (active.kind === "workspace") {
    const [current, mine] = await Promise.all([
      getCurrentWorkspace(),
      getMyWorkspaces(),
    ]);
    if (current)
      return {
        plugin,
        levels,
        subject: {
          name: current.name,
          color: current.color,
          image: current.avatarUrl ?? undefined,
          // Another workspace's page for it — or, without one there, where
          // it opens (`[pluginId]/page.tsx`).
          siblings: mine.map((ws) => ({
            id: ws.id,
            name: ws.name,
            color: ws.color,
            image: ws.avatarUrl ?? undefined,
            href: pluginPath(ws.id, pluginId, { kind: "workspace" }),
          })),
        },
      };
  }
  return { plugin, levels };
}
