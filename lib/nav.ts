// Single source of truth for the app's navigation routes — one place that
// knows every URL, icon and label, grouped by area. Both the Sidebar
// (NavGroups) and the TabBar (tabMeta) read from these tables instead of
// each hardcoding their own copy, so a route/icon/label only changes here.
//
// `section` is the URL path segment used to both build hrefs (Sidebar) and
// match the current pathname back to an entry (TabBar): a workspace route
// looks like `/<workspaceId>/<section>`, an admin route `/admin/<section>`,
// a project route `/<workspaceId>/project/<projectSlug>/<section>`.
// `labelKey` is the key under the "nav" i18n namespace (messages/*.json).

import type { Permission } from "@/lib/rbac";

export type NavLabelKey =
  | "myIssues"
  | "dashboard"
  | "inbox"
  | "board"
  | "issues"
  | "members"
  | "teams"
  | "settings"
  | "projects"
  | "general"
  | "roles"
  | "labels"
  | "fields"
  | "customFields"
  | "plugins"
  | "workspaces"
  | "account"
  | "navigation"
  | "appearance"
  | "notifications"
  | "security"
  | "apiKeys"
  | "mcp"
  | "webhooks"
  | "connections"
  | "shortcuts"
  | "admin"
  | "overview"
  | "views"
  | "users"
  | "audit"
  | "activity"
  | "mailTemplates"
  | "invitations"
  | "adminSettings";

export interface NavEntry {
  section: string;
  icon: string;
  labelKey: NavLabelKey;
  /**
   * Permission(s) without which the entry doesn't appear. If omitted, it's
   * open to everyone allowed to enter the area at all. Multiple permissions
   * are an OR — the entry appears as soon as one of them applies (e.g.
   * "Settings": visible to whoever can change anything there, no matter
   * what).
   *
   * This is checked via `navEntryAllowed()`. Visibility is still not a
   * safeguard — just courtesy, so no entry leads to a 403 page on click.
   * The actual check lives in the query behind it
   * (`features/admin/queries.ts`, `features/workspaces/queries.ts`, …),
   * freshly on every call.
   */
  permission?: Permission | Permission[];
  /** The heading it sits under in a settings nav (`settings.group.*`).
   *  Neighbors share one; a group holds at least two sections. */
  group?: SettingsGroupKey;
}

/** The headings the settings navs sort their sections under. */
export type SettingsGroupKey =
  | "general"
  | "preferences"
  | "developer"
  | "access"
  | "issues";

/** May a nav entry be offered? No permission required = always yes. */
export function navEntryAllowed(
  has: (permission: Permission) => boolean,
  entry: Pick<NavEntry, "permission">,
): boolean {
  if (!entry.permission) return true;
  const required = Array.isArray(entry.permission)
    ? entry.permission
    : [entry.permission];
  return required.some(has);
}

/**
 * The workspace's home page, in two views — `/<workspaceId>` (empty
 * section) and `/<workspaceId>/dashboard`. Unlike the project
 * (`PROJECT_OVERVIEW_NAV`, which lives under `/overview` because the root
 * there is already the board), the workspace has no root competing for the
 * spot — the overview gets it directly for that reason. Both views are
 * their own nav link in the sidebar: there's no single row meaning both
 * that would have to remember which one was open last.
 */
export const WORKSPACE_OVERVIEW_NAV: NavEntry = {
  section: "",
  icon: "lucide:info",
  labelKey: "overview",
};

export const WORKSPACE_DASHBOARD_NAV: NavEntry = {
  section: "dashboard",
  // The same gauge as the dashboard tab next to Board and List.
  icon: "lucide:gauge",
  labelKey: "dashboard",
};

/** The workspace's board across all projects (V8). */
export const WORKSPACE_BOARD_NAV: NavEntry = {
  section: "issues",
  icon: "lucide:layout-dashboard",
  labelKey: "board",
};

/** "My tasks" — the "Assigned" system view since V8 (`/my` leads there). */
export const MY_ISSUES_NAV: NavEntry = {
  section: "my",
  icon: "lucide:user",
  labelKey: "myIssues",
};

/** Sidebar "Global" group — the workspace's directories: projects and
 *  views (BARY-178). */
export const GLOBAL_NAV: NavEntry[] = [
  { section: "projects", icon: "lucide:folders", labelKey: "projects" },
  { section: "views", icon: "lucide:layers", labelKey: "views" },
];

/**
 * Whoever holds one of these permissions can change something in the
 * settings of the respective scope — otherwise they'd just be read-only
 * views. The same rule decides both the tab in the sidebar
 * (`WORKSPACE_NAV`/`PROJECT_NAV`) AND the segment in the switcher
 * (`SettingsHeader`, see the three `settings/layout.tsx`) — one source for
 * both, instead of maintaining the list twice.
 */
export const WORKSPACE_SETTINGS_PERMISSIONS: Permission[] = [
  "role.manage",
  "label.create",
  "customfield.manage",
  "plugin.enable",
  "workspace.update",
];
export const PROJECT_SETTINGS_PERMISSIONS: Permission[] = [
  "role.manage",
  "label.create",
  "customfield.manage",
  "plugin.enable",
  "project.update",
];

/**
 * Sidebar "Workspace" group — workspace administration.
 *
 * Roles no longer live here: that's a setup question and belongs in the
 * settings (`WORKSPACE_SETTINGS_NAV`). Members and teams stay, because
 * people look them up in everyday use — both are also reachable from the
 * settings, the same view in a different frame.
 */
export const WORKSPACE_NAV: NavEntry[] = [
  {
    section: "members",
    icon: "lucide:users",
    labelKey: "members",
    permission: "member.view",
  },
  // Teams get no gate: without team.view.all you see your own instead of
  // all of them (`getWorkspaceTeamsView`) — the tab stays visible, only the
  // content is filtered.
  { section: "teams", icon: "lucide:users-round", labelKey: "teams" },
  {
    section: "settings",
    icon: "lucide:settings",
    labelKey: "settings",
    permission: WORKSPACE_SETTINGS_PERMISSIONS,
  },
];

/** Real route with its own tab metadata, but not (yet) linked from the Sidebar. */
export const INBOX_NAV: NavEntry = {
  section: "inbox",
  icon: "lucide:inbox",
  labelKey: "inbox",
};

/**
 * The roles page still exists under `/<workspaceId>/roles` — it's just no
 * longer in the sidebar. The entry stays so that an open tab or a shared
 * link keeps its name and its icon.
 */
export const ROLES_NAV: NavEntry = {
  section: "roles",
  icon: "lucide:shield-check",
  labelKey: "roles",
};

/**
 * Your own account settings — `/<workspaceId>/account/…`.
 *
 * They live in no sidebar: they're reached via your own menu in the bottom
 * left, where your own name sits. The entry exists anyway, because an open
 * tab and a shared link need a name and an icon — the same role as
 * `ROLES_NAV`.
 *
 * The section hangs under the workspace even though nothing in it belongs
 * to the workspace: outside the workspace shell, the app has no sidebar, no
 * tab bar, and no way back. Which workspace is in the address is
 * meaningless for the content.
 */
export const ACCOUNT_NAV: NavEntry = {
  section: "account",
  icon: "lucide:circle-user",
  labelKey: "account",
};

/** All sections that live directly under `/<workspaceId>/…` — used by the TabBar to resolve any workspace-scoped tab. */
export const WORKSPACE_SECTIONS: NavEntry[] = [
  WORKSPACE_OVERVIEW_NAV,
  WORKSPACE_DASHBOARD_NAV,
  WORKSPACE_BOARD_NAV,
  MY_ISSUES_NAV,
  ...GLOBAL_NAV,
  ...WORKSPACE_NAV,
  INBOX_NAV,
  ROLES_NAV,
  ACCOUNT_NAV,
];

/**
 * The sections of platform administration — `/admin` (empty section =
 * overview) or `/admin/<section>`.
 *
 * The order follows the order of access, inside out: first the state of
 * the platform, then the accounts, then the projects that belong to them,
 * then the roles that govern all of that — and last the log of what was
 * done here.
 *
 * What's in this list is the shell of the system: accounts, master data,
 * permissions, log. Content — issues, comments, attachments — deliberately
 * doesn't live in it and isn't reachable from here either. Whoever needs to
 * look inside goes through the emergency access
 * (`features/admin/actions.ts`).
 */
export const ADMIN_NAV: NavEntry[] = [
  { section: "", icon: "lucide:layout-dashboard", labelKey: "overview" },
  {
    section: "users",
    icon: "lucide:users",
    labelKey: "users",
    permission: "user.manage",
  },
  {
    // No dedicated read permission: the tenant list shows nothing the
    // dashboard doesn't already show. What you're allowed to *do* with a
    // workspace is decided by `workspace.suspend` and `workspace.delete` in
    // the view.
    section: "workspaces",
    icon: "lucide:building-2",
    labelKey: "workspaces",
  },
  {
    section: "projects",
    icon: "lucide:folders",
    labelKey: "projects",
    permission: "project.metadata.view",
  },
  {
    section: "roles",
    icon: "lucide:shield-check",
    labelKey: "roles",
    permission: "role.manage",
  },
  {
    section: "audit",
    icon: "lucide:scroll-text",
    labelKey: "audit",
    permission: "audit.view",
  },
  {
    section: "mail-templates",
    icon: "lucide:mail",
    labelKey: "mailTemplates",
    permission: "mail.template.manage",
  },
  {
    section: "plugins",
    icon: "lucide:puzzle",
    labelKey: "plugins",
    permission: "plugin.manage",
  },
  {
    section: "settings",
    icon: "lucide:settings",
    labelKey: "adminSettings",
    permission: "system.settings.manage",
  },
];

/**
 * A project's dashboard — `…/project/<slug>/overview`.
 *
 * It is the first sidebar entry of its own (Dashboard, Board, Issues, …), and the
 * project's row can lead there too — which of the three a click on the name
 * opens is each person's choice (`projectLanding`). The section name stays
 * `overview`: it is in shared links and open tabs already.
 */
export const PROJECT_OVERVIEW_NAV: NavEntry = {
  section: "overview",
  icon: "lucide:layout-dashboard",
  labelKey: "dashboard",
};

/**
 * Per-project sub-nav — `/<workspaceId>/project/<slug>` (empty section = board)
 * or `/<workspaceId>/project/<slug>/<section>`.
 *
 * Members live here and not in the settings: whoever works in the project
 * looks them up there to see who they can reach — that's a matter of
 * everyday use, not a setting. Roles and labels are, which is why they hang
 * under `settings` (`PROJECT_SETTINGS_NAV`).
 */
export const PROJECT_NAV: NavEntry[] = [
  PROJECT_OVERVIEW_NAV,
  { section: "", icon: "lucide:square-kanban", labelKey: "board" },
  { section: "list", icon: "lucide:list", labelKey: "issues" },
  { section: "members", icon: "lucide:users", labelKey: "members" },
  {
    section: "settings",
    icon: "lucide:settings",
    labelKey: "settings",
    permission: PROJECT_SETTINGS_PERMISSIONS,
  },
];

/**
 * All sections under `…/project/<slug>/…` — the list the tab bar resolves
 * the name and icon of any project address from. The counterpart to
 * `WORKSPACE_SECTIONS` one level down.
 */
export const PROJECT_SECTIONS: NavEntry[] = PROJECT_NAV;

/**
 * The sections of the project settings — `…/project/<slug>/settings/<section>`,
 * empty section = general.
 *
 * The bar is rendered by `ProjectSettingsNav`; the layout decides the
 * visibility of individual entries based on permissions.
 */
export const PROJECT_SETTINGS_NAV: NavEntry[] = [
  // The project itself, and what happened in it.
  {
    section: "",
    icon: "lucide:settings",
    labelKey: "general",
    group: "general",
  },
  {
    section: "activity",
    icon: "lucide:scroll-text",
    labelKey: "activity",
    permission: "audit.view",
    group: "general",
  },
  // The same page as under `…/project/<slug>/members`: whoever's looking
  // for members sometimes looks under the project and sometimes under its
  // settings — both lead there. First the people, then their permissions.
  {
    section: "members",
    icon: "lucide:users",
    labelKey: "members",
    group: "access",
  },
  {
    section: "invitations",
    icon: "lucide:mail",
    labelKey: "invitations",
    permission: "member.invite",
    group: "access",
  },
  {
    section: "roles",
    icon: "lucide:shield-check",
    labelKey: "roles",
    permission: "role.manage",
    group: "access",
  },
  // What an issue carries.
  {
    section: "labels",
    icon: "lucide:tag",
    labelKey: "labels",
    group: "issues",
  },
  {
    section: "fields",
    icon: "lucide:layout-list",
    labelKey: "fields",
    group: "issues",
  },
  {
    section: "custom-fields",
    icon: "lucide:text-cursor-input",
    labelKey: "customFields",
    permission: "customfield.manage",
    group: "issues",
  },
];

/**
 * The sections of the workspace settings — `/<workspaceId>/settings/<section>`,
 * empty section = general.
 *
 * The same second level as the project (`PROJECT_SETTINGS_NAV`), one step
 * up: this is what applies to the whole workspace. Members and teams are
 * additionally reachable directly under `/<workspaceId>/…` — whoever works
 * in the workspace looks them up there, whoever sets it up finds them here
 * next to roles and labels. The component is shared, not the route.
 */
export const WORKSPACE_SETTINGS_NAV: NavEntry[] = [
  // The workspace itself: its name, its projects, what talks to it from
  // outside, and what happened in it.
  {
    section: "",
    icon: "lucide:settings",
    labelKey: "general",
    group: "general",
  },
  {
    section: "projects",
    icon: "lucide:folders",
    labelKey: "projects",
    group: "general",
  },
  {
    section: "webhooks",
    icon: "lucide:webhook",
    labelKey: "webhooks",
    permission: "webhook.manage",
    group: "general",
  },
  {
    section: "activity",
    icon: "lucide:scroll-text",
    labelKey: "activity",
    permission: "audit.view",
    group: "general",
  },
  // Who's in it, and what they may do.
  {
    section: "members",
    icon: "lucide:users",
    labelKey: "members",
    permission: "member.view",
    group: "access",
  },
  {
    section: "invitations",
    icon: "lucide:mail",
    labelKey: "invitations",
    permission: "member.invite",
    group: "access",
  },
  {
    section: "teams",
    icon: "lucide:users-round",
    labelKey: "teams",
    group: "access",
  },
  {
    section: "roles",
    icon: "lucide:shield-check",
    labelKey: "roles",
    permission: "role.manage",
    group: "access",
  },
  // What an issue carries, everywhere in the workspace.
  {
    section: "labels",
    icon: "lucide:tag",
    labelKey: "labels",
    group: "issues",
  },
  {
    section: "custom-fields",
    icon: "lucide:text-cursor-input",
    labelKey: "customFields",
    permission: "customfield.manage",
    group: "issues",
  },
];

/**
 * The sections of your own account settings — `/<workspaceId>/account/<section>`,
 * empty section = general.
 *
 * The same second level as the workspace and the project, only it belongs
 * to nobody but whoever opens it. Three groups: who you are and how you
 * sign in, how the app behaves for you, and reaching it from code. Permissions play no role here: everyone sees exactly
 * their own settings.
 *
 * One exception: "connections" disappears when `auth.config.ts` hasn't
 * enabled a single OAuth provider (`account/layout.tsx` filters that out) —
 * a tab to a list that would always be empty helps nobody.
 */
export const ACCOUNT_SETTINGS_NAV: NavEntry[] = [
  // Who you are and how you sign in.
  { section: "", icon: "lucide:user", labelKey: "general", group: "general" },
  {
    section: "security",
    icon: "lucide:shield-check",
    labelKey: "security",
    group: "general",
  },
  {
    section: "connections",
    icon: "lucide:link",
    labelKey: "connections",
    group: "general",
  },
  // How the app behaves for you.
  {
    section: "navigation",
    icon: "lucide:compass",
    labelKey: "navigation",
    group: "preferences",
  },
  {
    section: "appearance",
    icon: "lucide:palette",
    labelKey: "appearance",
    group: "preferences",
  },
  {
    section: "notifications",
    icon: "lucide:bell",
    labelKey: "notifications",
    group: "preferences",
  },
  {
    section: "shortcuts",
    icon: "lucide:keyboard",
    labelKey: "shortcuts",
    group: "preferences",
  },
  // Reaching Barynt from code and from an AI assistant.
  {
    section: "api-keys",
    icon: "lucide:key-round",
    labelKey: "apiKeys",
    group: "developer",
  },
  {
    section: "mcp",
    icon: "lucide:plug-zap",
    labelKey: "mcp",
    group: "developer",
  },
];

/**
 * The single settings the search finds, by scope and section: the message
 * keys of their labels, exactly as the page shows them — the page is
 * searched for that text on arrival (`SettingsFocus`, BARY-201). A label renamed on
 * its page is renamed here with it, through the shared key.
 */
export const SEARCHABLE_SETTINGS: Record<
  "account" | "project" | "workspace",
  Record<string, string[]>
> = {
  account: {
    "": [
      "account.firstName",
      "account.lastName",
      "account.handle",
      "fields.color",
      "fields.email",
    ],
    security: ["account.passkeys", "account.addPasskey", "account.signIn"],
    navigation: [
      "behavior.projectLanding",
      "behavior.startPage",
      "behavior.projectOrder",
      "behavior.sidebarCollapsed",
      "behavior.issueOpenMode",
      "behavior.issuePageOpenMode",
      "behavior.defaultGrouping",
      "behavior.defaultSort",
      "behavior.defaultShowSubIssues",
    ],
    appearance: [
      "settings.theme",
      "settings.language",
      "behavior.dateFormat",
      "behavior.weekStart",
      "behavior.timeZone",
      "behavior.fieldLabelMode",
      "behavior.fieldDateFormat",
      "behavior.fieldTimeFormat",
    ],
    "api-keys": ["apiKeys.baseUrlLabel", "apiKeys.authHeaderLabel"],
    mcp: ["mcp.serverUrlLabel", "mcp.authLabel", "mcp.transportLabel"],
  },
  project: {
    "": [
      "fields.name",
      "fields.description",
      "projects.identifier",
      "fields.color",
      "projectSettings.url",
      "projectSettings.visibility",
      "projectSettings.deleteTitle",
    ],
  },
  workspace: {
    "": [
      "fields.name",
      "fields.description",
      "fields.color",
      "workspaceSettings.url",
      "workspaceSettings.links",
      "workspaceSettings.domains",
      "workspaceSettings.deleteTitle",
    ],
  },
};

export function workspacePath(workspaceId: string, section: string): string {
  return section ? `/${workspaceId}/${section}` : `/${workspaceId}`;
}

/** A section of the workspace settings. Empty section = general. */
export function workspaceSettingsPath(
  workspaceId: string,
  section: string,
): string {
  const base = workspacePath(workspaceId, "settings");
  return section ? `${base}/${section}` : base;
}

/** A section of your own account settings. Empty section = general. */
export function accountPath(workspaceId: string, section: string): string {
  const base = workspacePath(workspaceId, "account");
  return section ? `${base}/${section}` : base;
}

/**
 * The three areas settings are split into: what applies to everyone in the
 * workspace, what applies to a project, and what only concerns you
 * yourself.
 */
export type SettingsScopeKey = "workspace" | "project" | "account" | "store";

export interface SettingsScopeEntry {
  key: SettingsScopeKey;
  label: string;
  icon: string;
  /**
   * Where the area leads. If the address is missing — no project in
   * context — the entry drops out of `visibleSettingsScope()` entirely,
   * instead of showing it dead.
   */
  href?: string;
}

/** Like `SettingsScopeEntry`, only after filtering: the address is set. */
export type VisibleSettingsScopeEntry = SettingsScopeEntry & { href: string };

/**
 * The targets of the scope switcher — each the general page of its area.
 *
 * Deliberately here and not in the three layouts: the addresses are the
 * same no matter which area you switch from, and three copies of this
 * would be three places where a route can go stale. Labels come in from
 * outside so this file can do without i18n.
 */
export function settingsScopeItems({
  workspaceId,
  projectSlug,
  labels,
}: {
  workspaceId: string;
  /** The project the middle area opens. Without one it stays inert. */
  projectSlug?: string;
  labels: Record<SettingsScopeKey, string>;
}): SettingsScopeEntry[] {
  // Inside out: first what only concerns yourself, then the project, and
  // last the whole workspace. That's also the order in which they're
  // needed — everyone fiddles with their own settings, few with the
  // workspace's.
  //
  // The icons are the same ones the sidebar already uses for these things
  // (`GLOBAL_NAV`, `ACCOUNT_NAV`) — an area shouldn't depend on which door
  // you enter it through.
  return [
    {
      key: "account",
      label: labels.account,
      icon: "lucide:circle-user",
      href: accountPath(workspaceId, ""),
    },
    {
      key: "project",
      label: labels.project,
      icon: "lucide:folders",
      href: projectSlug
        ? projectSettingsPath(workspaceId, projectSlug, "")
        : undefined,
    },
    {
      key: "workspace",
      label: labels.workspace,
      icon: "lucide:building-2",
      href: workspaceSettingsPath(workspaceId, ""),
    },
    // The plugins a workspace or its projects can switch on (BARY-201) —
    // not a level of settings but what's on offer for all of them.
    {
      key: "store",
      label: labels.store,
      icon: "lucide:store",
      href: pluginStorePath(workspaceId, {}),
    },
  ];
}

/** The workspace's plugin store — `/<workspaceId>/plugins`, with the open
 *  plugin and tab in the address. */
export function pluginStorePath(
  workspaceId: string,
  to: { plugin?: string; tab?: string; category?: string },
): string {
  const params = new URLSearchParams();
  if (to.plugin) params.set("plugin", to.plugin);
  if (to.tab && to.tab !== "overview") params.set("tab", to.tab);
  if (to.category) params.set("category", to.category);
  const query = params.toString();
  return `/${workspaceId}/plugins${query ? `?${query}` : ""}`;
}

/** A switched-on plugin's settings in a workspace or project. */
export function pluginSettingsPath(
  workspaceId: string,
  projectSlug: string | null,
  pluginId: string,
): string {
  return projectSlug
    ? projectSettingsPath(workspaceId, projectSlug, `plugins/${pluginId}`)
    : workspaceSettingsPath(workspaceId, `plugins/${pluginId}`);
}

/**
 * Narrows the candidates from `settingsScopeItems()` down to what's really
 * up for choosing: "Personal" always, "Project"/"Workspace" only with an
 * address AND a permission (`WORKSPACE_SETTINGS_PERMISSIONS`/
 * `PROJECT_SETTINGS_PERMISSIONS`, each resolved by the layout — this
 * function itself knows no permissions).
 *
 * If only "Personal" is left in the end, the switcher has nothing left to
 * switch between — the layouts then leave `SettingsHeader` out entirely.
 */
export function visibleSettingsScope(
  items: SettingsScopeEntry[],
  allowed: { workspace: boolean; project: boolean; store: boolean },
): VisibleSettingsScopeEntry[] {
  return items.filter((item): item is VisibleSettingsScopeEntry => {
    if (!item.href) return false;
    if (item.key === "account") return true;
    return allowed[item.key];
  });
}

export function adminPath(section: string): string {
  return section ? `/admin/${section}` : "/admin";
}

export function projectPath(
  workspaceId: string,
  slug: string,
  section: string,
): string {
  const base = `/${workspaceId}/project/${slug}`;
  return section ? `${base}/${section}` : base;
}

/** An issue's full page — `/<workspaceId>/issue/<ref>`, lowercased like
 *  everywhere else a short code sits in the address. */
export function issuePath(workspaceId: string, ref: string): string {
  return `/${workspaceId}/issue/${ref.toLowerCase()}`;
}

/** A section of the project settings. Empty section = general. */
export function projectSettingsPath(
  workspaceId: string,
  slug: string,
  section: string,
): string {
  const base = projectPath(workspaceId, slug, "settings");
  return section ? `${base}/${section}` : base;
}

/**
 * Is `pathname` the entry `pattern` refers to?
 *
 * Normally exact — an entry is active when you're standing on it. If the
 * pattern ends in `/*`, everything beneath it counts too: "Settings" stays
 * marked while you browse its sections, and the sidebar doesn't collapse
 * the branch out from under you.
 *
 * Lives here instead of in the sidebar, because `NavLink` (marking) and
 * `TabList` (expanding) need the same answer — two interpretations of the
 * same pattern would be exactly the kind of bug you only notice late.
 */
export function isNavActive(
  pathname: string,
  href: string,
  activeHref?: string,
): boolean {
  const pattern = activeHref ?? href;
  if (!pattern.endsWith("/*")) return pathname === pattern;

  const base = pattern.slice(0, -2);
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function findBySection(
  entries: NavEntry[],
  section: string,
): NavEntry | undefined {
  return entries.find((e) => e.section === section);
}
