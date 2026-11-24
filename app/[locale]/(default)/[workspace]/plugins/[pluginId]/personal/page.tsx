import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { PluginCredentials } from "@/features/plugins/components/PluginCredentials/PluginCredentials";
import { PluginLevels } from "@/features/plugins/components/PluginLevels/PluginLevels";
import { PluginTile } from "@/features/plugins/components/PluginStore/PluginTile";
import { getPluginLevels } from "@/features/plugins/levels";
import { getUserCredentialsView } from "@/features/plugins/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { pluginPath } from "@/lib/nav";
import styles from "./personal.module.scss";

export const dynamic = "force-dynamic";

/**
 * What a plugin asks you yourself for (BARY-147, in the plugins' area since
 * BARY-238): your credentials — a personal access token for a Git host,
 * say — and whether you kept yours.
 */
export default async function PluginPersonalPage({
  params,
}: {
  params: Promise<{ workspace: string; pluginId: string }>;
}) {
  const { workspace, pluginId: raw } = await params;
  const pluginId = decodeURIComponent(raw);
  setCurrentWorkspaceId(workspace);
  const levels = await getPluginLevels(workspace, pluginId, {
    kind: "personal",
  });
  if (!levels) redirect(pluginPath(workspace, pluginId));
  const view = await getUserCredentialsView(workspace, pluginId);
  if (!view) notFound();
  return (
    <>
      <PageHeader
        leading={<PluginTile id={pluginId} name={view.plugin.name} />}
        title={view.plugin.name}
        divider={false}
      />
      <PluginLevels levels={levels.levels} active="personal" />
      <div className={styles.page}>
        <PluginCredentials
          pluginId={pluginId}
          credentials={view.credentials}
          scope={{ workspaceId: workspace, projectId: null }}
          own
        />
      </div>
    </>
  );
}
