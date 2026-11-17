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
 * The workspace's members, one click away from the sidebar.
 *
 * The same component as under `…/settings/members` — anyone working in the
 * workspace looks here to see who they can reach out to; anyone setting it
 * up finds the same list in settings next to roles and teams.
 */
export default async function MembersPage({
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
      base={`/${workspace}/members`}
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
