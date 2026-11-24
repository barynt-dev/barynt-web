import "server-only";
import { enabledOAuthProviders } from "@/auth.config";
import type { SettingsNavItem } from "@/components/ui/layout/SettingsNav/SettingsNav";
import type { SettingsNavSection } from "@/components/ui/layout/SettingsNav/searchSections";
import { PluginTile } from "@/features/plugins/components/PluginStore/PluginTile";
import {
  getPluginSettingsNav,
  getUserCredentialPluginsNav,
  type PluginNavRow,
} from "@/features/plugins/queries";
import {
  ACCOUNT_SETTINGS_NAV,
  accountPath,
  type NavEntry,
  navEntryAllowed,
  PROJECT_SETTINGS_NAV,
  PROJECT_SETTINGS_PERMISSIONS,
  pluginPath,
  pluginSettingsPath,
  projectSettingsPath,
  SEARCHABLE_SETTINGS,
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
  /** Single settings on the pages of `items`, for the search only. */
  settings: SettingsNavItem[];
  /** Single settings on the pages of `plugins`, for the search only. */
  pluginSettings: SettingsNavItem[];
}

/** The single settings on the pages of `entries`, each leading to its page
 *  with the setting to show there. */
function settingRowsOf(
  t: T,
  scope: Scope,
  entries: NavEntry[],
  href: (section: string) => string,
): SettingsNavItem[] {
  return entries.flatMap((entry) =>
    (SEARCHABLE_SETTINGS[scope][entry.section] ?? []).map((key) => {
      const label = t(key as never);
      return {
        href: href(entry.section),
        label,
        icon: entry.icon,
        focus: label,
        context: t(`nav.${entry.labelKey}` as never),
        start: entry.section === "" || undefined,
      };
    }),
  );
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
      start: entry.section === "" || undefined,
    };
  });
}

const pluginRows = (
  t: T,
  rows: PluginNavRow[],
  href: (pluginId: string) => string,
): SettingsNavItem[] =>
  rows.map((p) => ({
    href: href(p.pluginId),
    label: p.name,
    icon: "lucide:puzzle",
    keywords: ["Plugin", t("nav.plugins" as never)],
    leading: <PluginTile id={p.pluginId} name={p.name} size="sm" />,
  }));

/** The single settings on the plugins' pages — the labels of their forms
 *  and credentials — for the search only, each leading to its plugin's
 *  page with the setting to show there. */
const pluginSettingRows = (
  rows: PluginNavRow[],
  href: (pluginId: string) => string,
): SettingsNavItem[] =>
  rows.flatMap((p) =>
    p.settings.map((label) => ({
      href: href(p.pluginId),
      label,
      icon: "lucide:puzzle",
      focus: label,
      context: p.name,
      keywords: [p.name],
      leading: <PluginTile id={p.pluginId} name={p.name} size="sm" />,
    })),
  );

/** A scope's plugin rows: the nav's group, and their settings for the
 *  search. */
const pluginNav = (
  t: T,
  rows: PluginNavRow[],
  href: (pluginId: string) => string,
) => ({
  plugins: pluginRows(t, rows, href),
  pluginSettings: pluginSettingRows(rows, href),
});

/** Your own settings. "Connections" only with an OAuth provider to list;
 *  the plugins that ask each person for a credential of their own as the
 *  "Plugins" group (BARY-147). */
export async function accountNav(t: T, workspaceId: string): Promise<ScopeNav> {
  const entries = ACCOUNT_SETTINGS_NAV.filter(
    (entry) =>
      entry.section !== "connections" || enabledOAuthProviders.length > 0,
  );
  const href = (s: string) => accountPath(workspaceId, s);
  return {
    items: rowsOf(t, "account", entries, href),
    ...pluginNav(t, await getUserCredentialPluginsNav(workspaceId), (id) =>
      pluginPath(workspaceId, id, { kind: "personal" }),
    ),
    settings: settingRowsOf(t, "account", entries, href),
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
  const href = (s: string) => workspaceSettingsPath(workspaceId, s);
  return {
    items: rowsOf(t, "workspace", entries, href),
    settings: settingRowsOf(t, "workspace", entries, href),
    ...pluginNav(
      t,
      access.has("plugin.enable")
        ? await getPluginSettingsNav({ workspaceId, projectId: null })
        : [],
      (id) => pluginSettingsPath(workspaceId, null, id),
    ),
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
  const href = (s: string) => projectSettingsPath(workspaceId, project.slug, s);
  return {
    items: rowsOf(t, "project", entries, href),
    settings: settingRowsOf(t, "project", entries, href),
    ...pluginNav(
      t,
      access.has("plugin.enable")
        ? await getPluginSettingsNav({ workspaceId, projectId: project.id })
        : [],
      (id) => pluginSettingsPath(workspaceId, project.slug, id),
    ),
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
  const all = (nav: ScopeNav) => [
    ...nav.items,
    ...nav.plugins,
    ...nav.settings,
    ...nav.pluginSettings,
  ];
  const sections: SettingsNavSection[] = [
    {
      title: t("settings.scopeAccount" as never),
      items: all(await accountNav(t, workspaceId)),
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
