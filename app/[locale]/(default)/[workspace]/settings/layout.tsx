import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SettingsHeader } from "@/components/ui/layout/SettingsHeader/SettingsHeader";
import { SettingsBody } from "@/components/ui/layout/SettingsNav/SettingsBody";
import {
  SettingsNav,
  type SettingsNavSubject,
} from "@/components/ui/layout/SettingsNav/SettingsNav";
import {
  SettingsSearchField,
  SettingsSearchProvider,
} from "@/components/ui/layout/SettingsNav/SettingsSearch";
import { canUsePluginStore } from "@/features/plugins/queries";
import {
  settingsSearchIndex,
  workspaceNav,
} from "@/features/settings/navigation";
import {
  getCurrentWorkspace,
  getMyWorkspaces,
  getWorkspaceProjects,
} from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import {
  PROJECT_SETTINGS_PERMISSIONS,
  settingsScopeItems,
  visibleSettingsScope,
  WORKSPACE_SETTINGS_PERMISSIONS,
  workspaceSettingsPath,
} from "@/lib/nav";
import { getAccess } from "@/lib/permissions";
import styles from "./settings.module.scss";

export const dynamic = "force-dynamic";

/**
 * Frame of the workspace settings: sections on the left, the open one on the
 * right.
 *
 * Structured like the frame of the project settings and for the same
 * reasons. This layout only holds the navigation together. Every subpage
 * loads its own data and checks access again — a layout doesn't protect a
 * Server Action, and a hidden row in the sidebar isn't access control.
 * What's missing here is simply not offered; it's denied on the page itself.
 */
export default async function WorkspaceSettingsLayout({
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
    // Only for the switcher: from here no project context carries forward, so
    // "Project" opens the first visible one (the list is sorted by name). If
    // there is none, or none with its own gate passed, the segment drops out
    // (`visibleSettingsScope`).
    getWorkspaceProjects(),
    // For the switcher in the header of the sidebar — the same list also
    // shown by the sidebar's own switcher.
    getMyWorkspaces(),
  ]);
  if (!current) notFound();

  // The header switches the workspace while staying within settings. Anyone
  // without an access right there won't see the page — that's checked in
  // `getWorkspaceSettingsView` per subpage, not at this line.
  const siblings: SettingsNavSubject[] = myWorkspaces.map((ws) => ({
    id: ws.id,
    name: ws.name,
    color: ws.color,
    image: ws.avatarUrl ?? undefined,
    href: workspaceSettingsPath(ws.id, ""),
  }));

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
      store: await canUsePluginStore(workspace),
    },
  );

  // Roles and members are the only sections with their own gate (`role.manage`
  // and `member.view` respectively) — the rest stay visible even without
  // write access; they then show what's in effect, just read-only.
  const [nav, searchIndex] = await Promise.all([
    workspaceNav(t, workspace, access),
    settingsSearchIndex(t, {
      workspaceId: workspace,
      workspaceAccess: access,
      project: firstProject ?? null,
      projectAccess,
    }),
  ]);

  return (
    <div className={styles.shell}>
      <SettingsSearchProvider
        index={searchIndex}
        label={t("settings.search")}
        noHitsLabel={t("settings.noHits")}
      >
        <SettingsHeader
          // Only "Personal" remaining means nothing to switch between: no
          // tabs then, just the search.
          items={scope.length > 1 ? scope : []}
          active="workspace"
          label={t("settings.scopeLabel")}
          trailing={<SettingsSearchField />}
        />
        <SettingsBody
          className={styles.body}
          basePath={workspaceSettingsPath(workspace, "")}
          backLabel={t("nav.settings")}
        >
          <SettingsNav
            subject={current.name}
            color={current.color}
            image={current.avatarUrl ?? undefined}
            siblings={siblings}
            siblingsLabel={t("settings.scopeWorkspace")}
            title={t("nav.settings")}
            items={nav.items}
            groups={
              nav.plugins.length > 0
                ? [{ title: t("nav.plugins"), items: nav.plugins }]
                : undefined
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
