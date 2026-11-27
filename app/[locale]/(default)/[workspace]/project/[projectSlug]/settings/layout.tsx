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
import {
  projectNav,
  settingsSearchIndex,
} from "@/features/settings/navigation";
import { settingsScope } from "@/features/settings/scope";
import {
  getMyProjects,
  getWorkspaceProjects,
} from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { projectSettingsPath } from "@/lib/nav";
import { getAccess } from "@/lib/permissions";
import styles from "./settings.module.scss";

export const dynamic = "force-dynamic";

/**
 * Frame of the project settings: sections on the left, the open one on the
 * right.
 *
 * This layout only holds the navigation together. Every subpage loads its
 * own data and checks access again — a layout doesn't protect a Server
 * Action, and a hidden row in the sidebar isn't access control. What's
 * missing here is simply not offered; it's denied on the page itself.
 */
export default async function ProjectSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string; projectSlug: string }>;
}) {
  const { workspace, projectSlug } = await params;
  setCurrentWorkspaceId(workspace);

  const projects = await getWorkspaceProjects();
  const project = projects.find((p) => p.slug === projectSlug);
  if (!project) notFound();

  const [t, access, workspaceAccess] = await Promise.all([
    getTranslations(),
    getAccess({ projectId: project.id }),
    getAccess({ workspaceId: workspace }),
  ]);
  if (!access.has("project.view")) notFound();

  // The project is known here — the switcher leads back to exactly the one
  // you're currently in, not to some arbitrary other one.
  const scope = await settingsScope(t, {
    workspaceId: workspace,
    project,
    workspaceAccess,
    projectAccess: access,
  });

  // The sidebar's header switches the project while staying within
  // settings — across workspace boundaries, because you look up a project by
  // its name, not by which workspace it hangs off of. `getMyProjects` returns
  // exactly the ones with `project.view`, the same gate this layout checks
  // right below: whatever's listed here also opens.
  const siblings: SettingsNavSubject[] = (await getMyProjects()).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    image: p.avatarUrl ?? undefined,
    href: projectSettingsPath(p.workspaceId, p.slug, ""),
    group: p.workspaceName,
  }));

  // Roles is the only section with its own gate: it holds the rules that
  // decide everything else. General and Labels stay visible even without
  // write access — they then show what's in effect, just read-only. The
  // plugins have an area of their own (`/plugins`, BARY-238).
  const [nav, searchIndex] = await Promise.all([
    projectNav(t, workspace, project, access),
    settingsSearchIndex(t, {
      workspaceId: workspace,
      workspaceAccess,
      project,
      projectAccess: access,
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
          active="project"
          label={t("settings.scopeLabel")}
          trailing={<SettingsSearchField />}
        />
        <SettingsBody
          className={styles.body}
          basePath={projectSettingsPath(workspace, projectSlug, "")}
          backLabel={t("nav.settings")}
        >
          <SettingsNav
            subject={project.name}
            color={project.color}
            image={project.avatarUrl ?? undefined}
            siblings={siblings}
            siblingsLabel={t("settings.scopeProject")}
            title={t("nav.settings")}
            items={nav.items}
          />
          <div className={styles.panel} data-settings-panel>
            {children}
          </div>
        </SettingsBody>
      </SettingsSearchProvider>
    </div>
  );
}
