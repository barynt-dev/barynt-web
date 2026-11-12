import { notFound } from "next/navigation";
import { PluginSettings } from "@/features/plugins/components/PluginSettings/PluginSettings";
import { getPluginSettingsView } from "@/features/plugins/queries";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/** A switched-on plugin's settings in a project (BARY-201) —
 *  `plugin.enable` in the project, and a settings form in its manifest. */
export default async function ProjectPluginSettingsPage({
  params,
}: {
  params: Promise<{ workspace: string; projectSlug: string; pluginId: string }>;
}) {
  const { workspace, projectSlug, pluginId } = await params;
  setCurrentWorkspaceId(workspace);
  const project = (await getWorkspaceProjects()).find(
    (p) => p.slug === projectSlug,
  );
  if (!project) notFound();
  const scope = { workspaceId: workspace, projectId: project.id };
  const view = await getPluginSettingsView(scope, pluginId);
  if (!view) notFound();
  return <PluginSettings view={view} scope={scope} />;
}
