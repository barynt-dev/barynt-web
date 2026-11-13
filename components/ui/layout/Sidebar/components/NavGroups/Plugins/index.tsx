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
 * clear what comes from one; on a phone their views too. Nothing at all
 * without one; a project's plugin pages sit under the project instead.
 */
export default async function NavGroupPlugins() {
  const t = await getTranslations("nav");
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;
  const projects = await getWorkspaceProjects();
  const entries = (
    await getPluginNav(
      workspace.id,
      projects.map((p) => p.id),
    )
  ).workspace;
  const row = (entry: (typeof entries)[number]): TabGroup => ({
    href: workspacePath(workspace.id, entry.path),
    label: entry.title,
    leading: (
      <PluginTile id={entry.pluginId} name={entry.pluginName} size="sm" />
    ),
  });
  const pages = entries.filter((e) => e.kind === "page").map(row);
  // A phone moves the main group to the bottom bar, which has no room for
  // a plugin's views — they're listed here instead, on a phone only.
  const views = entries.filter((e) => e.kind === "projectView").map(row);
  if (!pages.length && !views.length) return null;

  return (
    <div
      className={styles.pluginsGroup}
      data-phone-only={pages.length ? undefined : true}
    >
      <div className={styles.titleWrapper}>
        <span>{t("plugins")}</span>
      </div>
      <div className={styles.favoritesWrapper}>
        {views.length > 0 && (
          <div className={styles.phoneOnly}>
            <TabList tabs={views} />
          </div>
        )}
        <TabList tabs={pages} />
      </div>
    </div>
  );
}
