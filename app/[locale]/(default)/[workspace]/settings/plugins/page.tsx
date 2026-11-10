import { notFound } from "next/navigation";
import { ScopePlugins } from "@/features/plugins/components/ScopePlugins/ScopePlugins";
import { getWorkspacePluginsView } from "@/features/plugins/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/** The workspace's plugins, and which its projects may switch on —
 *  `plugin.enable` in the workspace. */
export default async function WorkspacePluginsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const view = await getWorkspacePluginsView(workspace);
  if (!view) notFound();

  return <ScopePlugins plugins={view.plugins} workspaceId={workspace} />;
}
