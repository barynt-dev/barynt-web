import { PluginSlotPage } from "@/features/plugins/components/PluginSlotPage/PluginSlotPage";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/** A workspace plugin's view or page (BARY-148): `…/plugin/<id>/view/<v>`
 *  or `…/plugin/<id>/page/<p>`. */
export default async function WorkspacePluginSlotPage({
  params,
}: {
  params: Promise<{
    workspace: string;
    pluginId: string;
    slot: string;
    id: string;
  }>;
}) {
  const { workspace, pluginId, slot, id } = await params;
  setCurrentWorkspaceId(workspace);
  return (
    <PluginSlotPage
      pluginId={pluginId}
      slotPath={slot}
      id={id}
      workspaceId={workspace}
      projectId={null}
    />
  );
}
