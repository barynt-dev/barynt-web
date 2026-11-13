import { getTranslations } from "next-intl/server";
import { PluginTile } from "@/features/plugins/components/PluginStore/PluginTile";
import { getPluginNav } from "@/features/plugins/slots";
import {
  getCurrentWorkspace,
  getWorkspaceProjects,
} from "@/features/workspaces/queries";
import { workspacePath } from "@/lib/nav";
import styles from "../../../sidebar.module.scss";
import TabList, { type TabGroup } from "../components/TabList";

/**
 * Pages of plugins switched on in the workspace (`navItems`, BARY-148),
 * below the projects and views — each with its plugin's mark, so it's
 * clear what comes from one. Nothing at all without one; a project's
 * plugin pages sit under the project instead.
 */
export default async function NavGroupPlugins() {
  const t = await getTranslations("nav");
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;
  const projects = await getWorkspaceProjects();
  const pages = (
    await getPluginNav(
      workspace.id,
      projects.map((p) => p.id),
    )
  ).workspace.filter((e) => e.kind === "page");
  if (!pages.length) return null;

  const tabs: TabGroup[] = pages.map((entry) => ({
    href: workspacePath(workspace.id, entry.path),
    label: entry.title,
    leading: (
      <PluginTile id={entry.pluginId} name={entry.pluginName} size="sm" />
    ),
  }));

  return (
    <>
      <div className={styles.titleWrapper}>
        <span>{t("plugins")}</span>
      </div>
      <div className={styles.favoritesWrapper}>
        <TabList tabs={tabs} />
      </div>
    </>
  );
}
