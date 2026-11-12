import { notFound } from "next/navigation";
import { PluginSettings } from "@/features/plugins/components/PluginSettings/PluginSettings";
import { getPluginSettingsView } from "@/features/plugins/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/** A switched-on plugin's settings in the workspace (BARY-201) —
 *  `plugin.enable` here, and a settings form in its manifest. */
export default async function WorkspacePluginSettingsPage({
  params,
}: {
  params: Promise<{ workspace: string; pluginId: string }>;
}) {
  const { workspace, pluginId } = await params;
  setCurrentWorkspaceId(workspace);
  const scope = { workspaceId: workspace, projectId: null };
  const view = await getPluginSettingsView(scope, pluginId);
  if (!view) notFound();
  return <PluginSettings view={view} scope={scope} />;
}
