import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SettingsHeader } from "@/components/ui/layout/SettingsHeader/SettingsHeader";
import { SettingsBody } from "@/components/ui/layout/SettingsNav/SettingsBody";
import { SettingsNav } from "@/components/ui/layout/SettingsNav/SettingsNav";
import { getMyProfile } from "@/features/account/queries";
import { canUsePluginStore } from "@/features/plugins/queries";
import {
  accountNav,
  settingsSearchIndex,
} from "@/features/settings/navigation";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import {
  accountPath,
  PROJECT_SETTINGS_PERMISSIONS,
  settingsScopeItems,
  visibleSettingsScope,
  WORKSPACE_SETTINGS_PERMISSIONS,
} from "@/lib/nav";
import { getAccess } from "@/lib/permissions";
import styles from "./account.module.scss";

export const dynamic = "force-dynamic";

/**
 * Frame of your own account settings: sections on the left, the open one on
 * the right.
 *
 * Structured like the frame of the workspace and project settings — it's the
 * same second level, only it doesn't belong to a workspace but to whoever
 * opens it. That's why the header shows your own name rather than the
 * workspace's: the sidebar next to it shows workspaces and projects, and
 * without this line it would stay unclear whose settings these are.
 *
 * Nothing gets filtered here. Permissions decide nothing in this layout —
 * everyone sees exactly their own account, and someone else's is unreachable
 * through any URL (`features/account/queries.ts`).
 */
export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const [t, profile, projects, workspaceAccess] = await Promise.all([
    getTranslations(),
    getMyProfile(),
    // Only for the switcher, see the workspace layout: "Project" opens the
    // first visible one, and without one (or without permission in it) the
    // segment drops out (`visibleSettingsScope`).
    getWorkspaceProjects(),
    getAccess({ workspaceId: workspace }),
  ]);
  if (!profile) notFound();

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
      workspace: WORKSPACE_SETTINGS_PERMISSIONS.some(workspaceAccess.has),
      project: projectAccess
        ? PROJECT_SETTINGS_PERMISSIONS.some(projectAccess.has)
        : false,
      store: await canUsePluginStore(workspace),
    },
  );

  // The search looks through Project and Workspace too, as far as the
  // switcher above leads there (BARY-201).
  const searchIndex = await settingsSearchIndex(t, {
    workspaceId: workspace,
    workspaceAccess,
    project: firstProject ?? null,
    projectAccess,
  });

  return (
    <div className={styles.shell}>
      {/* Only "Personal" remaining means: nothing to switch between. */}
      {scope.length > 1 && (
        <SettingsHeader
          items={scope}
          active="account"
          label={t("settings.scopeLabel")}
        />
      )}
      <SettingsBody
        className={styles.body}
        basePath={accountPath(workspace, "")}
        backLabel={t("nav.settings")}
      >
        <SettingsNav
          subject={t("nav.account")}
          title={t("nav.settings")}
          items={accountNav(t, workspace).items}
          searchIndex={searchIndex}
          searchLabel={t("settings.search")}
          noHitsLabel={t("settings.noHits")}
          basePath={accountPath(workspace, "")}
        />
        <div className={styles.panel}>{children}</div>
      </SettingsBody>
    </div>
  );
}
