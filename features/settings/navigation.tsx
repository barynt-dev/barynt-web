import "server-only";
import { enabledOAuthProviders } from "@/auth.config";
import type { SettingsNavItem } from "@/components/ui/layout/SettingsNav/SettingsNav";
import type { SettingsNavSection } from "@/components/ui/layout/SettingsNav/settingsSearch";
import { PluginTile } from "@/features/plugins/components/PluginStore/PluginTile";
import { getPluginSettingsNav } from "@/features/plugins/queries";
import {
  ACCOUNT_SETTINGS_NAV,
  accountPath,
  type NavEntry,
  navEntryAllowed,
  PROJECT_SETTINGS_NAV,
  PROJECT_SETTINGS_PERMISSIONS,
  pluginSettingsPath,
  projectSettingsPath,
  WORKSPACE_SETTINGS_NAV,
  WORKSPACE_SETTINGS_PERMISSIONS,
  workspaceSettingsPath,
} from "@/lib/nav";
import type { getAccess } from "@/lib/permissions";

// The rows of the three settings navs — Personal, Project, Workspace — in
// one place (BARY-201): each layout shows its own, and the search above any
// of them looks through all three (`settingsSearchIndex`).

/** The layout's `t`, untyped here: the keys are built from the nav lists,
 *  and `tests/unit/tabbar/settingsSearch.test.ts` checks they all exist. */
type T = (key: never) => string;
type Access = Awaited<ReturnType<typeof getAccess>>;
type Scope = "account" | "project" | "workspace";

export interface ScopeNav {
  items: SettingsNavItem[];
  /** The plugins with a page here — the nav's "Plugins" group. */
  plugins: SettingsNavItem[];
}

function rowsOf(
  t: T,
  scope: Scope,
  entries: NavEntry[],
  href: (section: string) => string,
): SettingsNavItem[] {
  return entries.map((entry) => {
    const group = entry.group && t(`settings.group.${entry.group}` as never);
    return {
      href: href(entry.section),
      label: t(`nav.${entry.labelKey}` as never),
      icon: entry.icon,
      group,
      keywords: [
        ...t(`settings.keywords.${scope}.${entry.labelKey}` as never).split(
          ", ",
        ),
        ...(group ? [group] : []),
      ],
      // Without a keyboard there's nothing to press shortcuts on.
      needsKeyboard: entry.section === "shortcuts" || undefined,
    };
  });
}

const pluginRows = (
  t: T,
  rows: { pluginId: string; name: string }[],
  href: (pluginId: string) => string,
): SettingsNavItem[] =>
  rows.map((p) => ({
    href: href(p.pluginId),
    label: p.name,
    icon: "lucide:puzzle",
    keywords: ["Plugin", t("nav.plugins" as never)],
    leading: <PluginTile id={p.pluginId} name={p.name} size="sm" />,
  }));

/** Your own settings. "Connections" only with an OAuth provider to list. */
export function accountNav(t: T, workspaceId: string): ScopeNav {
  const entries = ACCOUNT_SETTINGS_NAV.filter(
    (entry) =>
      entry.section !== "connections" || enabledOAuthProviders.length > 0,
  );
  return {
    items: rowsOf(t, "account", entries, (s) => accountPath(workspaceId, s)),
    plugins: [],
  };
}

/** The workspace's settings, as far as `access` reaches. */
export async function workspaceNav(
  t: T,
  workspaceId: string,
  access: Access,
): Promise<ScopeNav> {
  const entries = WORKSPACE_SETTINGS_NAV.filter((entry) =>
    navEntryAllowed(access.has, entry),
  );
  return {
    items: rowsOf(t, "workspace", entries, (s) =>
      workspaceSettingsPath(workspaceId, s),
    ),
    plugins: access.has("plugin.enable")
      ? pluginRows(
          t,
          await getPluginSettingsNav({ workspaceId, projectId: null }),
          (id) => pluginSettingsPath(workspaceId, null, id),
        )
      : [],
  };
}

/** A project's settings, as far as `access` reaches. */
export async function projectNav(
  t: T,
  workspaceId: string,
  project: { id: string; slug: string },
  access: Access,
): Promise<ScopeNav> {
  const entries = PROJECT_SETTINGS_NAV.filter((entry) =>
    navEntryAllowed(access.has, entry),
  );
  return {
    items: rowsOf(t, "project", entries, (s) =>
      projectSettingsPath(workspaceId, project.slug, s),
    ),
    plugins: access.has("plugin.enable")
      ? pluginRows(
          t,
          await getPluginSettingsNav({ workspaceId, projectId: project.id }),
          (id) => pluginSettingsPath(workspaceId, project.slug, id),
        )
      : [],
  };
}

/**
 * What the settings search looks through: one section per scope the person
 * may open — Personal always, the workspace and the project (the one open,
 * else the one the scope switcher leads to) with the same gates as the
 * switcher. Each row keeps its group's heading as a keyword, so "Issues"
 * still finds Labels.
 */
export async function settingsSearchIndex(
  t: T,
  input: {
    workspaceId: string;
    workspaceAccess: Access;
    project: { id: string; slug: string; name: string } | null;
    projectAccess: Access | null;
  },
): Promise<SettingsNavSection[]> {
  const { workspaceId, workspaceAccess, project, projectAccess } = input;
  const all = (nav: ScopeNav) => [...nav.items, ...nav.plugins];
  const sections: SettingsNavSection[] = [
    {
      title: t("settings.scopeAccount" as never),
      items: all(accountNav(t, workspaceId)),
    },
  ];
  if (
    project &&
    projectAccess &&
    PROJECT_SETTINGS_PERMISSIONS.some(projectAccess.has)
  )
    sections.push({
      title: `${t("settings.scopeProject" as never)} · ${project.name}`,
      items: all(await projectNav(t, workspaceId, project, projectAccess)),
    });
  if (WORKSPACE_SETTINGS_PERMISSIONS.some(workspaceAccess.has))
    sections.push({
      title: t("settings.scopeWorkspace" as never),
      items: all(await workspaceNav(t, workspaceId, workspaceAccess)),
    });
  return sections;
}
