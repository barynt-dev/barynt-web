import { redirect } from "next/navigation";
import { getPluginsArea } from "@/features/plugins/queries";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { pluginPath, pluginsPath } from "@/lib/nav";
import { defaultLevel } from "@/lib/plugins/levels";

export const dynamic = "force-dynamic";

/**
 * A plugin in the plugins' area (BARY-238) opens on a level: a project
 * it's on in, else the workspace, else what's yours. Without any here —
 * another workspace's link, say — the area's start page.
 */
export default async function PluginPage({
  params,
}: {
  params: Promise<{ workspace: string; pluginId: string }>;
}) {
  const { workspace, pluginId } = await params;
  setCurrentWorkspaceId(workspace);
  const plugin = (
    await getPluginsArea(workspace, await getWorkspaceProjects())
  ).find((p) => p.pluginId === decodeURIComponent(pluginId));
  const level = plugin && defaultLevel(plugin);
  redirect(
    level
      ? pluginPath(workspace, plugin.pluginId, level)
      : pluginsPath(workspace),
  );
}
