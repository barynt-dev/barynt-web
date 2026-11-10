"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useNav } from "@/components/ui/layout/AppShell/ShellFrame";
import { ShortcutsHelpModal } from "@/features/account/components/AccountShortcuts/ShortcutsHelpModal";
import { logout } from "@/features/auth/actions";
import { CreateIssueModal } from "@/features/issues/components/CreateIssueModal/CreateIssueModal";
import type { IssueComposerData } from "@/features/issues/types";
import { useOpenCreateProject } from "@/features/projects/useOpenCreateProject";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useHasOpenModal, useModal } from "@/lib/context";
import type { NavLabelKey } from "@/lib/nav";
import { useShortcut } from "@/lib/shortcuts/useShortcut";
import { CommandPalette } from "./CommandPalette";

/** New tasks land in the backlog, provided the workspace has that status —
 *  same default `NewIssueButton.tsx` uses. */
const DEFAULT_STATUS = "backlog";

interface CommandPaletteTriggerClientProps {
  data: IssueComposerData;
  /** The workspace sections this person may open (`navEntryAllowed`). */
  allowedNav: NavLabelKey[];
  canCreateProject: boolean;
  canCreateWorkspace: boolean;
}

/**
 * Owns the palette's open state: "mod+k" opens it (disabled while typing —
 * `useShortcut`'s default — and while a real modal already has focus), and
 * `SearchButton.tsx`'s click does the same via `window.__openPalette` —
 * that bridge already existed, waiting for something to set it; a mouse
 * click can't fake a held Cmd/Ctrl the way `dispatchShortcut` fakes a bare
 * key, so this is the direct call it actually needed.
 *
 * `onNewIssue` mirrors `NewIssueButton.tsx`'s own project-preselection
 * (current project from the URL, else the first creatable one) — same
 * modal, same defaults, just one more way to reach it. Missing entirely
 * without a creatable project, same as that button not rendering there.
 * "New project" and "New workspace" follow the same rule: no permission,
 * no row (the server resolves both, see `CommandPaletteTrigger`).
 */
export function CommandPaletteTriggerClient({
  data,
  allowedNav,
  canCreateProject,
  canCreateWorkspace,
}: CommandPaletteTriggerClientProps) {
  const t = useTranslations();
  // Open, and whether straight in "go to view" (key V).
  const [open, setOpen] = useState<false | "all" | "views">(false);
  const hasOpenModal = useHasOpenModal();
  const { openModal } = useModal();
  const pathname = usePathname();
  const router = useRouter();
  const openCreateProject = useOpenCreateProject();
  const { toggleNav } = useNav();

  useShortcut("mod+k", () => setOpen("all"), { enabled: !hasOpenModal });
  useShortcut("v", () => setOpen("views"), { enabled: !hasOpenModal });

  useEffect(() => {
    const w = window as { __openPalette?: () => void };
    w.__openPalette = () => setOpen("all");
    return () => {
      w.__openPalette = undefined;
    };
  }, []);

  const creatable = data.projects.filter((p) =>
    data.creatableProjectIds.includes(p.id),
  );
  const activeSlug = pathname.match(/\/project\/([^/]+)/)?.[1];
  const project = creatable.find((p) => p.slug === activeSlug) ?? creatable[0];
  const initialStatus =
    data.statuses.find((s) => s.id === DEFAULT_STATUS)?.id ??
    data.statuses[0]?.id;

  const onNewIssue =
    project && initialStatus
      ? () =>
          openModal(({ close }) => (
            <CreateIssueModal
              projectId={project.id}
              initialStatus={initialStatus}
              data={data}
              close={close}
            />
          ))
      : undefined;

  const onShowShortcuts = () =>
    openModal(({ close }) => <ShortcutsHelpModal close={close} />, {
      label: t("nav.shortcuts"),
    });

  return (
    <CommandPalette
      open={open !== false}
      startInViews={open === "views"}
      onClose={() => setOpen(false)}
      workspaceId={data.workspaceId}
      projects={data.projects}
      statuses={data.statuses}
      searchIssues={data.searchIssues}
      allowedNav={allowedNav}
      onNewIssue={onNewIssue}
      onNewProject={
        canCreateProject ? () => openCreateProject(data.workspaceId) : undefined
      }
      onNewWorkspace={
        canCreateWorkspace ? () => router.push("/create-workspace") : undefined
      }
      onToggleSidebar={toggleNav}
      onShowShortcuts={onShowShortcuts}
      onSignOut={() => logout()}
    />
  );
}
