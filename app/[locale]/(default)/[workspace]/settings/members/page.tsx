import { notFound } from "next/navigation";
import { getWorkspaceApps } from "@/features/plugins/queries";
import { loadMoreWorkspaceMembers } from "@/features/workspaces/actions";
import { MembersTabs } from "@/features/workspaces/components/MembersTabs/MembersTabs";
import { WorkspaceApps } from "@/features/workspaces/components/WorkspaceApps/WorkspaceApps";
import { WorkspaceMembers } from "@/features/workspaces/components/WorkspaceMembers/WorkspaceMembers";
import { getWorkspaceMembersView } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { projectSettingsPath, workspaceSettingsPath } from "@/lib/nav";

export const dynamic = "force-dynamic";

/**
 * The workspace's members — here within the settings frame.
 *
 * The same view as under `/<workspace>/members`; it's the component that's
 * shared, not the route. That way each URL still brings the frame it belongs
 * in, and the query checks permissions regardless.
 */
export default async function WorkspaceSettingsMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { workspace } = await params;
  const { tab } = await searchParams;
  setCurrentWorkspaceId(workspace);

  const [view, apps] = await Promise.all([
    getWorkspaceMembersView(),
    getWorkspaceApps(workspace),
  ]);
  if (!view) notFound();

  // The bots of its plugins, apart from the people (BARY-213).
  const current = tab === "apps" && apps?.length ? "apps" : "people";
  const tabs = (
    <MembersTabs
      base={`/${workspace}/settings/members`}
      current={current}
      apps={apps?.length ?? 0}
    />
  );
  if (current === "apps" && apps)
    return (
      <WorkspaceApps
        apps={apps.map((app) => ({
          ...app,
          settingsHref: app.project
            ? projectSettingsPath(
                workspace,
                app.project.slug,
                `plugins/${app.pluginId}`,
              )
            : workspaceSettingsPath(workspace, `plugins/${app.pluginId}`),
        }))}
        tabs={tabs}
      />
    );

  return (
    <WorkspaceMembers
      {...view}
      workspaceId={workspace}
      loadMore={loadMoreWorkspaceMembers.bind(null, workspace)}
      tabs={tabs}
    />
  );
}
