import { getIssueComposerData } from "@/features/issues/editor-data";
import { navEntryAllowed, WORKSPACE_SECTIONS } from "@/lib/nav";
import { getAccess } from "@/lib/permissions";
import { canCreateWorkspace, getSystemSettings } from "@/lib/system-settings";
import { CommandPaletteTriggerClient } from "./CommandPaletteTriggerClient";

// Server Component: resolves the same composer bundle `NewIssueButton`
// uses (`getIssueComposerData`, `cache()`-wrapped — free to call again
// within the same request), hands it to the client logic. Admin routes
// have no workspace, so there's nothing to search; without composer data
// elsewhere (no workspace, or nothing creatable — `getIssueComposerData`
// returns `null` either way), the palette stays silent rather than
// opening broken.
//
// The permissions are resolved here too, with the same rules as the
// sidebar: a nav entry (`navEntryAllowed`), "New project"
// (`project.create`) and "New workspace" (`canCreateWorkspace`) only show
// up where the sidebar offers them as well.
export async function CommandPaletteTrigger({
  isAdminRoute = false,
}: {
  isAdminRoute?: boolean;
}) {
  if (isAdminRoute) return null;

  const data = await getIssueComposerData();
  if (!data) return null;

  const [access, settings] = await Promise.all([
    getAccess({ workspaceId: data.workspaceId }),
    getSystemSettings(),
  ]);

  return (
    <CommandPaletteTriggerClient
      data={data}
      allowedNav={WORKSPACE_SECTIONS.filter((entry) =>
        navEntryAllowed(access.has, entry),
      ).map((entry) => entry.labelKey)}
      canCreateProject={access.has("project.create")}
      canCreateWorkspace={canCreateWorkspace(settings)}
    />
  );
}
