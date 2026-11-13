import { notFound } from "next/navigation";
import { PluginSlotPage } from "@/features/plugins/components/PluginSlotPage/PluginSlotPage";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/** A project plugin's view or page (BARY-148):
 *  `…/project/<slug>/plugin/<id>/view/<v>` or `…/page/<p>`. */
export default async function ProjectPluginSlotPage({
  params,
}: {
  params: Promise<{
    workspace: string;
    projectSlug: string;
    pluginId: string;
    slot: string;
    id: string;
  }>;
}) {
  const { workspace, projectSlug, pluginId, slot, id } = await params;
  setCurrentWorkspaceId(workspace);
  const project = (await getWorkspaceProjects()).find(
    (p) => p.slug === projectSlug,
  );
  if (!project) notFound();
  return (
    <PluginSlotPage
      pluginId={pluginId}
      slotPath={slot}
      id={id}
      workspaceId={workspace}
      projectId={project.id}
    />
  );
}
