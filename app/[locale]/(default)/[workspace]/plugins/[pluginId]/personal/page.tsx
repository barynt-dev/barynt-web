import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { GitHubUserLink } from "@/features/github/components/GitHubUserLink/GitHubUserLink";
import { getUserLinkView } from "@/features/github/user-link";
import { PluginCredentials } from "@/features/plugins/components/PluginCredentials/PluginCredentials";
import { PluginLevels } from "@/features/plugins/components/PluginLevels/PluginLevels";
import { PluginTile } from "@/features/plugins/components/PluginStore/PluginTile";
import { getPluginLevels } from "@/features/plugins/levels";
import { getUserCredentialsView } from "@/features/plugins/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { pluginPath } from "@/lib/nav";
import { currentUserId } from "@/lib/permissions";
import styles from "./personal.module.scss";

export const dynamic = "force-dynamic";

/**
 * What a plugin asks you yourself for (BARY-147, in the plugins' area since
 * BARY-238): your credentials — a personal access token for a Git host,
 * say — and whether you kept yours; for one that works with GitHub, your
 * GitHub account first.
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
  const [view, userId] = await Promise.all([
    getUserCredentialsView(workspace, pluginId),
    currentUserId(),
  ]);
  if (!view || !userId) notFound();
  // A plugin that works with GitHub acts as the person's own account.
  const github = view.plugin.connections?.includes("github")
    ? await getUserLinkView(userId)
    : null;
  return (
    <>
      <PageHeader
        leading={<PluginTile id={pluginId} name={view.plugin.name} />}
        title={view.plugin.name}
        divider={false}
      />
      <PluginLevels levels={levels.levels} active="personal" />
      <div className={styles.page}>
        {github && <GitHubUserLink view={github} />}
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
