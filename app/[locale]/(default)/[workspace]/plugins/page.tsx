import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SettingsHeader } from "@/components/ui/layout/SettingsHeader/SettingsHeader";
import {
  ScopeStore,
  type ScopeStoreTab,
} from "@/features/plugins/components/ScopeStore/ScopeStore";
import { getScopeStoreView } from "@/features/plugins/queries";
import {
  getCurrentWorkspace,
  getWorkspaceProjects,
} from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import {
  PROJECT_SETTINGS_PERMISSIONS,
  settingsScopeItems,
  visibleSettingsScope,
  WORKSPACE_SETTINGS_PERMISSIONS,
} from "@/lib/nav";
import { getAccess } from "@/lib/permissions";
import { PLUGIN_CATEGORIES } from "@/lib/plugins/directory";
import styles from "./store.module.scss";

export const dynamic = "force-dynamic";

/**
 * The workspace's plugin store (BARY-201): the plugins the platform has
 * installed, to switch on in the workspace and its projects — next to
 * Personal, Project and Workspace in the settings switcher. For whoever has
 * `plugin.enable` in the workspace or one of its projects; what's open is in
 * the address (`?plugin=`, `?tab=`, `?category=`).
 */
export default async function WorkspacePluginStorePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ plugin?: string; tab?: string; category?: string }>;
}) {
  const { workspace } = await params;
  const query = await searchParams;
  setCurrentWorkspaceId(workspace);

  const [t, current, projects, access] = await Promise.all([
    getTranslations(),
    getCurrentWorkspace(),
    getWorkspaceProjects(),
    getAccess({ workspaceId: workspace }),
  ]);
  if (!current) notFound();
  const view = await getScopeStoreView(workspace, projects);
  if (!view) notFound();

  const firstProject = projects[0];
  const projectAccess = firstProject
    ? await getAccess({ projectId: firstProject.id })
    : null;
  const scope = visibleSettingsScope(
    settingsScopeItems({
      workspaceId: workspace,
      projectSlug: firstProject?.slug,
      labels: {
        workspace: t("settings.scopeWorkspace"),
        project: t("settings.scopeProject"),
        account: t("settings.scopeAccount"),
        store: t("settings.scopeStore"),
      },
    }),
    {
      workspace: WORKSPACE_SETTINGS_PERMISSIONS.some(access.has),
      project: projectAccess
        ? PROJECT_SETTINGS_PERMISSIONS.some(projectAccess.has)
        : false,
      store: true,
    },
  );

  const selected =
    view.plugins.find((p) => p.pluginId === query.plugin) ?? null;
  const tab: ScopeStoreTab =
    query.tab === "capabilities" ? "capabilities" : "overview";
  const category = (PLUGIN_CATEGORIES as readonly string[]).includes(
    query.category ?? "",
  )
    ? (query.category as string)
    : null;

  return (
    <div className={styles.shell}>
      <SettingsHeader
        items={scope}
        active="store"
        label={t("settings.scopeLabel")}
      />
      <ScopeStore
        view={view}
        workspaceName={current.name}
        selected={selected}
        tab={tab}
        category={category}
      />
    </div>
  );
}
