import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { PluginCredentials } from "@/features/plugins/components/PluginCredentials/PluginCredentials";
import { PluginTile } from "@/features/plugins/components/PluginStore/PluginTile";
import { getUserCredentialsView } from "@/features/plugins/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import styles from "./userPlugin.module.scss";

export const dynamic = "force-dynamic";

/**
 * A plugin's page in the personal settings (BARY-147): the credentials it
 * asks each person for — a personal access token for a Git host, say —
 * and whether this person kept theirs. Only plugins that run somewhere in
 * this workspace and declare a credential at the `user` level.
 */
export default async function UserPluginPage({
  params,
}: {
  params: Promise<{ workspace: string; pluginId: string }>;
}) {
  const { workspace, pluginId } = await params;
  setCurrentWorkspaceId(workspace);
  const view = await getUserCredentialsView(workspace, pluginId);
  if (!view) notFound();
  return (
    <>
      <PageHeader
        leading={<PluginTile id={pluginId} name={view.plugin.name} />}
        title={view.plugin.name}
      />
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
