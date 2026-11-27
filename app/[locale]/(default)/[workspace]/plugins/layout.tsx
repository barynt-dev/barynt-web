import { Icon } from "@iconify/react";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SettingsHeader } from "@/components/ui/layout/SettingsHeader/SettingsHeader";
import { SettingsBody } from "@/components/ui/layout/SettingsNav/SettingsBody";
import {
  SettingsNav,
  type SettingsNavItem,
  type SettingsNavSubject,
} from "@/components/ui/layout/SettingsNav/SettingsNav";
import {
  SettingsSearchField,
  SettingsSearchProvider,
} from "@/components/ui/layout/SettingsNav/SettingsSearch";
import { PluginTile } from "@/features/plugins/components/PluginStore/PluginTile";
import { canUsePluginStore, getPluginsArea } from "@/features/plugins/queries";
import { settingsSearchIndex } from "@/features/settings/navigation";
import { settingsScope } from "@/features/settings/scope";
import {
  getCurrentWorkspace,
  getMyWorkspaces,
  getWorkspaceProjects,
} from "@/features/workspaces/queries";
import { Link } from "@/i18n/navigation";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import {
  accountPath,
  pluginPath,
  pluginStorePath,
  pluginsPath,
} from "@/lib/nav";
import { getAccess } from "@/lib/permissions";
import styles from "./plugins.module.scss";

export const dynamic = "force-dynamic";

/**
 * The plugins' area (BARY-238): every plugin this person can set somewhere
 * in the workspace, on the left — each page then switches between its
 * levels (personal, a project's, the workspace's). Framed like the
 * settings, between Workspace and Store in the tabs on top. Like there,
 * each page checks access again; a row left out here isn't a lock.
 */
export default async function PluginsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const [t, current, access, projects, myWorkspaces] = await Promise.all([
    getTranslations(),
    getCurrentWorkspace(),
    getAccess({ workspaceId: workspace }),
    getWorkspaceProjects(),
    getMyWorkspaces(),
  ]);
  if (!current) notFound();

  const firstProject = projects[0];
  const projectAccess = firstProject
    ? await getAccess({ projectId: firstProject.id })
    : null;
  const [scope, plugins, store, searchIndex] = await Promise.all([
    settingsScope(t, {
      workspaceId: workspace,
      project: firstProject ?? null,
      workspaceAccess: access,
      projectAccess,
    }),
    getPluginsArea(workspace, projects),
    canUsePluginStore(workspace),
    settingsSearchIndex(t, {
      workspaceId: workspace,
      workspaceAccess: access,
      project: firstProject ?? null,
      projectAccess,
    }),
  ]);

  // The same area in another workspace.
  const siblings: SettingsNavSubject[] = myWorkspaces.map((ws) => ({
    id: ws.id,
    name: ws.name,
    color: ws.color,
    image: ws.avatarUrl ?? undefined,
    href: pluginsPath(ws.id),
  }));

  // Nothing to set here: the area isn't offered (`settingsScope`), and an
  // old link lands on your own settings.
  if (plugins.length === 0) redirect(accountPath(workspace, ""));

  const items: SettingsNavItem[] = plugins.map((p) => ({
    href: pluginPath(workspace, p.pluginId),
    activeHref: `${pluginPath(workspace, p.pluginId)}/*`,
    label: p.name,
    icon: "lucide:puzzle",
    leading: <PluginTile id={p.pluginId} name={p.name} size="sm" />,
  }));

  return (
    <div className={styles.shell}>
      <SettingsSearchProvider
        index={searchIndex}
        label={t("settings.search")}
        noHitsLabel={t("settings.noHits")}
      >
        <SettingsHeader
          items={scope}
          active="plugins"
          label={t("settings.scopeLabel")}
          trailing={<SettingsSearchField />}
        />
        <SettingsBody
          className={styles.body}
          basePath={pluginsPath(workspace)}
          backLabel={t("plugins.area.title")}
        >
          <SettingsNav
            subject={current.name}
            color={current.color}
            image={current.avatarUrl ?? undefined}
            siblings={siblings}
            siblingsLabel={t("settings.scopeWorkspace")}
            title={t("plugins.area.title")}
            untitled
            items={items}
            // Where the next one comes from — a way out, not a page here.
            footer={
              store && (
                <Link
                  href={pluginStorePath(workspace, {})}
                  className={styles.storeLink}
                >
                  <Icon icon="lucide:store" width={15} aria-hidden />
                  {t("plugins.area.moreInStore")}
                  <Icon icon="lucide:arrow-right" width={14} aria-hidden />
                </Link>
              )
            }
          />
          <div className={styles.panel} data-settings-panel>
            {children}
          </div>
        </SettingsBody>
      </SettingsSearchProvider>
    </div>
  );
}
