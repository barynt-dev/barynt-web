import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { PluginFrame } from "@/features/plugins/components/PluginFrame/PluginFrame";
import { PluginTile } from "@/features/plugins/components/PluginStore/PluginTile";
import { getProjectPluginView } from "@/features/plugins/runtime";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { getSession } from "@/lib/session";
import styles from "./pluginView.module.scss";

export const dynamic = "force-dynamic";

/**
 * A project view a sandboxed plugin contributes (BARY-144) — the plugin's
 * frame filling the page under a header with its name, so it's always
 * clear what comes from a plugin. Where views sit in the project's own
 * navigation is the slots' business (BARY-132).
 */
export default async function ProjectPluginViewPage({
  params,
}: {
  params: Promise<{
    workspace: string;
    projectSlug: string;
    pluginId: string;
    viewId: string;
  }>;
}) {
  const { workspace, projectSlug, pluginId, viewId } = await params;
  setCurrentWorkspaceId(workspace);
  const [session, projects, locale] = await Promise.all([
    getSession(),
    getWorkspaceProjects(),
    getLocale(),
  ]);
  const project = projects.find((p) => p.slug === projectSlug);
  if (!session || !project) notFound();

  const place = { pluginId, workspaceId: workspace, projectId: project.id };
  const view = await getProjectPluginView(session.userId, place, viewId);
  if (!view) notFound();

  return (
    <div className={styles.page}>
      <PageHeader
        leading={<PluginTile id={pluginId} name={view.pluginName} />}
        title={view.title}
        description={view.pluginName}
      />
      <PluginFrame
        pluginId={pluginId}
        name={view.pluginName}
        context={{
          slot: { kind: "projectView", id: viewId },
          workspaceId: workspace,
          projectId: project.id,
          locale,
        }}
      />
    </div>
  );
}
