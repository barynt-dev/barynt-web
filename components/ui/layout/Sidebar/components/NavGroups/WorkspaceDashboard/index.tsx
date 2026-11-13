import { getTranslations } from "next-intl/server";
import { PluginTile } from "@/features/plugins/components/PluginStore/PluginTile";
import { getPluginNav } from "@/features/plugins/slots";
import { systemViewSlug } from "@/features/views/system";
import { viewPath } from "@/features/views/url";
import {
  getCurrentWorkspace,
  getWorkspaceProjects,
} from "@/features/workspaces/queries";
import {
  MY_ISSUES_NAV,
  WORKSPACE_BOARD_NAV,
  WORKSPACE_DASHBOARD_NAV,
  workspacePath,
} from "@/lib/nav";
import styles from "../../../sidebar.module.scss";
import TabList, { type TabGroup } from "../components/TabList";

/**
 * The workspace at a glance, at the top of the sidebar: its dashboard, its
 * board across all projects and "My tasks" (V8), then the views of plugins
 * switched on in the workspace (BARY-148). The spacing below sets
 * them apart from the directories (projects, views) that follow.
 */
async function NavGroupWorkspaceDashboard({
  bare = false,
}: {
  /** Just the list, without the spacing wrapper — for the phone bottom bar. */
  bare?: boolean;
}) {
  const t = await getTranslations("nav");
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  // "My tasks" is a system view — straight there once it exists (`/my`
  // redirects there and creates it otherwise).
  const mySlug = await systemViewSlug(workspace.id, "my-issues");
  const myHref = mySlug
    ? viewPath(workspace.id, null, mySlug)
    : workspacePath(workspace.id, MY_ISSUES_NAV.section);

  const tabs: TabGroup[] = [
    {
      href: workspacePath(workspace.id, WORKSPACE_DASHBOARD_NAV.section),
      icon: WORKSPACE_DASHBOARD_NAV.icon,
      label: t(WORKSPACE_DASHBOARD_NAV.labelKey),
    },
    {
      href: workspacePath(workspace.id, WORKSPACE_BOARD_NAV.section),
      // Board and list alike.
      activeHref: `${workspacePath(workspace.id, WORKSPACE_BOARD_NAV.section)}/*`,
      icon: WORKSPACE_BOARD_NAV.icon,
      label: t(WORKSPACE_BOARD_NAV.labelKey),
      // A phone has no board — only the list.
      hideOnPhone: true,
    },
    {
      href: myHref,
      activeHref: `${myHref}/*`,
      icon: MY_ISSUES_NAV.icon,
      label: t(MY_ISSUES_NAV.labelKey),
    },
  ];

  if (bare) return <TabList tabs={tabs} />;

  // Views of plugins switched on in the workspace, next to its own
  // (BARY-148) — not in the phone's bottom bar, which has no room.
  const projects = await getWorkspaceProjects();
  const plugins = await getPluginNav(
    workspace.id,
    projects.map((p) => p.id),
  );
  for (const entry of plugins.workspace.filter((e) => e.kind === "projectView"))
    tabs.push({
      href: workspacePath(workspace.id, entry.path),
      label: entry.title,
      leading: (
        <PluginTile id={entry.pluginId} name={entry.pluginName} size="sm" />
      ),
    });

  return (
    <div className={styles.workspaceDashboardGroup}>
      <TabList tabs={tabs} />
    </div>
  );
}

export default NavGroupWorkspaceDashboard;
