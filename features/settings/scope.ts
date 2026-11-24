import "server-only";
import { canUsePluginStore } from "@/features/plugins/queries";
import {
  PROJECT_SETTINGS_PERMISSIONS,
  settingsScopeItems,
  type VisibleSettingsScopeEntry,
  visibleSettingsScope,
  WORKSPACE_SETTINGS_PERMISSIONS,
} from "@/lib/nav";
import type { getAccess } from "@/lib/permissions";

type T = (key: never) => string;
type Access = Awaited<ReturnType<typeof getAccess>>;

/**
 * The settings' top row (Personal, Project, Workspace, Plugins, Store) as
 * this person may open it — one place for every area's layout, so the
 * tabs read alike wherever you are. `project` is the one "Project" leads
 * to: the open one, else the first. Plugins is always there: what isn't
 * set up yet, it says where to find.
 */
export async function settingsScope(
  t: T,
  input: {
    workspaceId: string;
    project: { slug: string } | null;
    workspaceAccess: Access;
    projectAccess: Access | null;
  },
): Promise<VisibleSettingsScopeEntry[]> {
  const { workspaceId, project, workspaceAccess, projectAccess } = input;
  return visibleSettingsScope(
    settingsScopeItems({
      workspaceId,
      projectSlug: project?.slug,
      labels: {
        workspace: t("settings.scopeWorkspace" as never),
        project: t("settings.scopeProject" as never),
        account: t("settings.scopeAccount" as never),
        plugins: t("settings.scopePlugins" as never),
        store: t("settings.scopeStore" as never),
      },
    }),
    {
      workspace: WORKSPACE_SETTINGS_PERMISSIONS.some(workspaceAccess.has),
      project: projectAccess
        ? PROJECT_SETTINGS_PERMISSIONS.some(projectAccess.has)
        : false,
      plugins: true,
      store: await canUsePluginStore(workspaceId),
    },
  );
}
