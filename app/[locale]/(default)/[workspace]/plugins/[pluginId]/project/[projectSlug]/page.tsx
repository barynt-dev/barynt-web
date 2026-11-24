import { notFound, redirect } from "next/navigation";
import { PluginLevels } from "@/features/plugins/components/PluginLevels/PluginLevels";
import { PluginSettings } from "@/features/plugins/components/PluginSettings/PluginSettings";
import { getPluginLevels } from "@/features/plugins/levels";
import { getPluginSettingsView } from "@/features/plugins/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { pluginPath, projectPath } from "@/lib/nav";

export const dynamic = "force-dynamic";

/** A plugin's settings in a project (BARY-201, in the plugins' area since
 *  BARY-238) — `plugin.enable` in the project; it's switched on here. */
export default async function PluginProjectPage({
  params,
}: {
  params: Promise<{ workspace: string; pluginId: string; projectSlug: string }>;
}) {
  const { workspace, pluginId: raw, projectSlug } = await params;
  const pluginId = decodeURIComponent(raw);
  setCurrentWorkspaceId(workspace);
  const levels = await getPluginLevels(workspace, pluginId, {
    kind: "project",
    slug: projectSlug,
  });
  const project = levels?.plugin.projects.find((p) => p.slug === projectSlug);
  if (!levels || !project) redirect(pluginPath(workspace, pluginId));
  const scope = { workspaceId: workspace, projectId: project.id };
  const view = await getPluginSettingsView(scope, pluginId);
  if (!view) notFound();
  return (
    <PluginSettings
      view={view}
      scope={scope}
      viewsHref={projectPath(workspace, projectSlug, `plugin/${pluginId}/view`)}
      subnav={
        <PluginLevels
          levels={levels.levels}
          active="project"
          subject={levels.subject}
        />
      }
    />
  );
}
