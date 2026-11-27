import { redirect } from "next/navigation";
import { getPluginsArea } from "@/features/plugins/queries";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { type PluginLevel, pluginPath, pluginsPath } from "@/lib/nav";
import { defaultLevel } from "@/lib/plugins/levels";

export const dynamic = "force-dynamic";

/**
 * A plugin in the plugins' area (BARY-238) opens on a level: a project
 * it's on in, else the workspace, else what's yours. Without any here —
 * another workspace's link, say — the area's start page. A plugin's
 * `openSettings` asks for a level with `?level=` (and `&project=<id>`),
 * and maybe a part of it with `&focus=`.
 */
export default async function PluginPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; pluginId: string }>;
  searchParams: Promise<{ level?: string; project?: string; focus?: string }>;
}) {
  const { workspace, pluginId } = await params;
  const asked = await searchParams;
  setCurrentWorkspaceId(workspace);
  const projects = await getWorkspaceProjects();
  const plugin = (await getPluginsArea(workspace, projects)).find(
    (p) => p.pluginId === decodeURIComponent(pluginId),
  );
  // A plugin asking for a level of its own page (`openSettings`) — a
  // project by its id; one that isn't here leaves the plugin's default.
  const project = projects.find((p) => p.id === asked.project);
  const wanted: PluginLevel | null =
    asked.level === "personal" || asked.level === "workspace"
      ? { kind: asked.level }
      : asked.level === "project" && project
        ? { kind: "project", slug: project.slug }
        : null;
  const level = plugin && (wanted ?? defaultLevel(plugin));
  // A part of the page it asked for: passed on (`context.focus`).
  const focus =
    asked.focus && /^[a-z0-9-]{1,40}$/.test(asked.focus)
      ? `?focus=${asked.focus}`
      : "";
  redirect(
    level
      ? `${pluginPath(workspace, plugin.pluginId, level)}${focus}`
      : pluginsPath(workspace),
  );
}
