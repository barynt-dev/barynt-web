import { notFound } from "next/navigation";
import { ScopePlugins } from "@/features/plugins/components/ScopePlugins/ScopePlugins";
import { getProjectPluginsView } from "@/features/plugins/queries";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/** A project's plugins — the ones its workspace released for projects.
 *  `plugin.enable` in the project. */
export default async function ProjectPluginsPage({
  params,
}: {
  params: Promise<{ workspace: string; projectSlug: string }>;
}) {
  const { workspace, projectSlug } = await params;
  setCurrentWorkspaceId(workspace);

  const projects = await getWorkspaceProjects();
  const project = projects.find((p) => p.slug === projectSlug);
  if (!project) notFound();

  const view = await getProjectPluginsView(project.id);
  if (!view) notFound();

  return (
    <ScopePlugins
      plugins={view.plugins}
      workspaceId={view.workspaceId}
      projectId={project.id}
    />
  );
}
