"use server";

import { revalidatePath } from "next/cache";
import {
  getAllProjects,
  getAllUsers,
  getAllWorkspaces,
  type PlatformProject,
  type PlatformUser,
  type PlatformWorkspace,
} from "@/features/admin/queries";
import type { ActivityPage } from "@/features/audit/actions";
import { ACTIVITY_PAGE_SIZE } from "@/features/audit/constants";
import { listAudit, recordAudit, recordAuditIn } from "@/lib/audit";
import { db } from "@/lib/db";
import { TABLE_PAGE_SIZE } from "@/lib/pagination";
import {
  assignmentCeiling,
  currentUserId,
  getAccess,
  PLATFORM,
  requirePermission,
} from "@/lib/permissions";
import { PROJECT_ADMIN_ROLE_KEY, systemRoleId } from "@/lib/rbac";
import { emitProjectEvent } from "@/lib/webhooks/resources";

// ─── What platform administration is allowed to do ────────────────────────────
//
// Four kinds of intervention, and three rules run through all of them:
//
//   1. **Nobody touches themselves.** Setting your own role would be
//      self-promotion, deactivating yourself would be a way to accidentally
//      lock out the last platform administrator.
//   2. **Nobody assigns a role above their own rank** — the same rule as
//      in `features/roles/actions.ts`, one level up.
//   3. **Every intervention ends up in the audit log afterward.** For the
//      break-glass access, not as a side effect but in the same transaction:
//      no log entry, no membership.
//
// Break-glass access is the only place in the whole platform area that opens a
// path to actual content. It does so openly: it creates an ordinary
// membership, visible to everyone in the project, requires a written reason,
// and records both. A silent override that shows content without leaving a
// trace does not exist here — for that there's only `tenant.access` in the
// support role, and no administrator holds that role.

type AdminResult = { ok: true } | { error: string };

const NOT_LOGGED_IN = "You must be logged in.";
const NOT_ALLOWED = "You are not allowed to do this.";

/** Shortest reason that counts as an actual reason. */
const MIN_REASON = 10;

async function revalidate() {
  revalidatePath("/", "layout");
}

function displayName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

// ─── Accounts ───────────────────────────────────────────────────────────────

/**
 * Set an account's platform role.
 *
 * This is the answer to "who gave whom administrator rights?" — and exactly
 * for that reason it ends up in the audit log afterward, with the old and
 * new role.
 */
export async function setPlatformRole(
  userId: string,
  roleId: string,
): Promise<AdminResult> {
  const actorId = await currentUserId();
  if (!actorId) return { error: NOT_LOGGED_IN };

  const access = await getAccess(PLATFORM);
  if (!access.has("user.manage")) return { error: NOT_ALLOWED };

  // Rule 1. Anyone able to promote themselves wouldn't need the rank order.
  if (userId === actorId)
    return { error: "You cannot change your own platform role." };

  const [target, role] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        platformRole: { select: { key: true, name: true, rank: true } },
      },
    }),
    db.role.findUnique({
      where: { id: roleId },
      select: { key: true, name: true, rank: true, scope: true },
    }),
  ]);

  if (!target) return { error: "This account no longer exists." };
  if (!role || role.scope !== "PLATFORM")
    return { error: "This is not a platform role." };

  // Rule 2, in both directions: neither assign a higher role, nor touch
  // someone who already ranks above yourself.
  const ceiling = assignmentCeiling(access, "PLATFORM");
  if (role.rank > ceiling)
    return { error: "You cannot assign a role above your own." };
  if ((target.platformRole?.rank ?? -1) > ceiling)
    return { error: "You cannot change a role above your own." };

  await db.user.update({
    where: { id: userId },
    data: { platformRoleId: roleId },
  });

  await recordAudit({
    action: "user.role.platform",
    actorId,
    target: { type: "user", id: userId, label: displayName(target) },
    meta: {
      from: target.platformRole?.key ?? null,
      to: role.key,
    },
  });

  await revalidate();
  return { ok: true };
}

/**
 * Deactivate an account, or reactivate it.
 *
 * Deactivating instead of deleting: a deleted account would either take its
 * issues, comments, and assignments with it or leave them without an author.
 * A deactivated one stays visible wherever it worked, but can no longer sign
 * in (`auth.ts`) and no longer gets permissions anywhere (`lib/permissions.ts`).
 */
export async function setUserActive(
  userId: string,
  active: boolean,
  reason?: string,
): Promise<AdminResult> {
  const actorId = await currentUserId();
  if (!actorId) return { error: NOT_LOGGED_IN };

  const access = await getAccess(PLATFORM);
  if (!access.has("user.manage")) return { error: NOT_ALLOWED };

  if (userId === actorId)
    return { error: "You cannot deactivate your own account." };

  const target = await db.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      platformRole: { select: { rank: true } },
    },
  });
  if (!target) return { error: "This account no longer exists." };

  if ((target.platformRole?.rank ?? -1) > assignmentCeiling(access, "PLATFORM"))
    return { error: "You cannot change an account above your own role." };

  await db.user.update({
    where: { id: userId },
    data: { deactivatedAt: active ? null : new Date() },
  });

  await recordAudit({
    action: active ? "user.reactivated" : "user.deactivated",
    actorId,
    target: { type: "user", id: userId, label: displayName(target) },
    reason,
  });

  await revalidate();
  return { ok: true };
}

// ─── Project metadata ───────────────────────────────────────────────────────

/**
 * Reassign an orphaned project.
 *
 * A project becomes an orphan when its creator's account is deleted — it then
 * sits there with nobody responsible. This action sets a new owner and
 * **adds them to the project at the same time**, because an owner without
 * membership would be nothing more than a name in a table: in this system,
 * access arises solely from `ProjectMember`.
 *
 * It is therefore an open path into someone else's project and is treated
 * like break-glass access: inside a transaction, with an audit entry.
 */
export async function reassignProject(
  projectId: string,
  newOwnerId: string,
): Promise<AdminResult> {
  const actorId = await currentUserId();
  if (!actorId) return { error: NOT_LOGGED_IN };

  const access = await getAccess(PLATFORM);
  if (!access.has("project.metadata.manage")) return { error: NOT_ALLOWED };

  const [project, owner] = await Promise.all([
    db.project.findUnique({
      where: { id: projectId },
      select: {
        name: true,
        workspaceId: true,
        createdBy: { select: { id: true } },
      },
    }),
    db.user.findUnique({
      where: { id: newOwnerId },
      select: { firstName: true, lastName: true, deactivatedAt: true },
    }),
  ]);

  if (!project) return { error: "This project no longer exists." };
  if (!owner) return { error: "This account no longer exists." };
  if (owner.deactivatedAt)
    return { error: "A deactivated account cannot own a project." };

  await db.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: { createdById: newOwnerId },
    });

    // Add without overwriting an existing role: whoever is already in keeps
    // what they had.
    await tx.projectMember.createMany({
      data: [
        {
          projectId,
          userId: newOwnerId,
          roleId: systemRoleId("PROJECT", PROJECT_ADMIN_ROLE_KEY),
        },
      ],
      skipDuplicates: true,
    });

    await recordAuditIn(tx, {
      action: "project.owner.changed",
      actorId,
      target: { type: "project", id: projectId, label: project.name },
      workspaceId: project.workspaceId,
      projectId,
      meta: { from: project.createdBy?.id ?? null, to: newOwnerId },
    });
  });

  await revalidate();
  return { ok: true };
}

/** Archive a project, or bring it back into operation. */
export async function setProjectArchived(
  projectId: string,
  archived: boolean,
): Promise<AdminResult> {
  const actorId = await currentUserId();
  if (!actorId) return { error: NOT_LOGGED_IN };

  const access = await getAccess(PLATFORM);
  if (!access.has("project.metadata.manage")) return { error: NOT_ALLOWED };

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { name: true, workspaceId: true },
  });
  if (!project) return { error: "This project no longer exists." };

  await db.project.update({
    where: { id: projectId },
    data: { archivedAt: archived ? new Date() : null },
  });

  await recordAudit({
    action: archived ? "project.archived" : "project.unarchived",
    actorId,
    target: { type: "project", id: projectId, label: project.name },
    workspaceId: project.workspaceId,
    projectId,
  });
  emitProjectEvent(
    archived ? "project.archived" : "project.unarchived",
    projectId,
    { workspaceId: project.workspaceId, actorId },
  );

  await revalidate();
  return { ok: true };
}

// ─── Break-glass access ───────────────────────────────────────────────────────

/**
 * Add yourself to someone else's project — the exceptional case.
 *
 * Intended for the day the project lead is in the hospital and something
 * urgently needs to change. Three things make it an exception rather than a
 * convenient shortcut:
 *
 *   - It requires a **reason**, a written one. It ends up in the audit log
 *     afterward, next to the name of whoever wrote it.
 *   - The audit entry is created **in the same transaction** as the
 *     membership. There is no state in which someone is in and the log stays
 *     silent.
 *   - The membership is **visible**. It appears in the project's member list
 *     like any other; anyone working there sees the next morning who joined.
 *
 * Anyone already a member doesn't need it — then it isn't break-glass access,
 * it's the normal path, and the action says so.
 */
export async function breakGlassJoinProject(data: {
  projectId: string;
  reason: string;
}): Promise<AdminResult> {
  const actorId = await currentUserId();
  if (!actorId) return { error: NOT_LOGGED_IN };

  const access = await getAccess(PLATFORM);
  if (!access.has("project.breakglass")) return { error: NOT_ALLOWED };

  const reason = data.reason.trim();
  if (reason.length < MIN_REASON)
    return {
      error: `Please state why this access is needed (at least ${MIN_REASON} characters).`,
    };

  const project = await db.project.findUnique({
    where: { id: data.projectId },
    select: { name: true, workspaceId: true },
  });
  if (!project) return { error: "This project no longer exists." };

  const existing = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId: data.projectId, userId: actorId } },
    select: { userId: true },
  });
  if (existing) return { error: "You are already a member of this project." };

  await db.$transaction(async (tx) => {
    await tx.projectMember.create({
      data: {
        projectId: data.projectId,
        userId: actorId,
        roleId: systemRoleId("PROJECT", PROJECT_ADMIN_ROLE_KEY),
      },
    });

    await recordAuditIn(tx, {
      action: "project.breakglass",
      actorId,
      target: { type: "project", id: data.projectId, label: project.name },
      workspaceId: project.workspaceId,
      projectId: data.projectId,
      reason,
    });
  });

  await revalidate();
  return { ok: true };
}

// ─── Workspaces ───────────────────────────────────────────────────────────────
//
// Two kinds of intervention, and between them lies an intent: **suspending is
// the normal case, deleting the exception.**
//
// Suspending removes access and leaves the data in place. It takes effect
// immediately and for everyone — `lib/permissions.ts` grants nobody any
// permissions in a suspended workspace, not even its own leadership — and it
// can be undone the next day. That's the right response to an outstanding
// invoice, a suspicion of abuse, an expiring contract.
//
// Deleting takes everything: projects, issues, comments, memberships, roles.
// There is no way back. That's why it hangs on a precondition that this
// action doesn't invent itself but requires: **a workspace can only be
// deleted once it's already suspended.** Anyone wanting to delete must
// therefore suspend first — and between the two steps lies a night, a second
// look, the chance that someone speaks up. This ordering is the real
// protection; the typed confirmation in the dialog is only a reminder of it.

/**
 * Suspend a workspace, or lift the suspension.
 *
 * The suspension isn't cosmetic, it's an actual effect: `loadBase` in
 * `lib/permissions.ts` reads `suspended` **before** any role resolution and
 * grants nothing afterward. A suspended tenant is closed to everyone working
 * in it — support still gets in via `tenant.access`, because that's exactly
 * when someone needs to be able to look.
 */
export async function setWorkspaceSuspended(
  workspaceId: string,
  suspended: boolean,
  reason?: string,
): Promise<AdminResult> {
  const actorId = await currentUserId();
  if (!actorId) return { error: NOT_LOGGED_IN };

  const access = await getAccess(PLATFORM);
  if (!access.has("workspace.suspend")) return { error: NOT_ALLOWED };

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, _count: { select: { members: true } } },
  });
  if (!workspace) return { error: "This workspace no longer exists." };

  await db.workspace.update({
    where: { id: workspaceId },
    data: { suspended },
  });

  await recordAudit({
    action: suspended ? "workspace.suspended" : "workspace.unsuspended",
    actorId,
    target: { type: "workspace", id: workspaceId, label: workspace.name },
    workspaceId,
    reason,
    // How many people this affects belongs in the entry: "suspended" reads
    // differently when forty accounts stand behind it.
    meta: { members: workspace._count.members },
  });

  await revalidate();
  return { ok: true };
}

/**
 * Delete a workspace and everything in it — from the platform side.
 *
 * This action exists **in addition to** `deleteWorkspace` in
 * `features/workspaces/actions.ts`, and the difference isn't duplication, it's
 * the context of the permission check. `workspace.delete` can appear in both
 * scopes and means different things in each:
 *
 *   in a workspace role  → "I may delete **this** workspace" (owner)
 *   in a platform role   → "I may delete tenants" (operator)
 *
 * Going through the workspace context doesn't work for a platform admin: they
 * aren't a member there, and resolution only gathers from the workspace role.
 * That's why this action checks in the platform context.
 *
 * The precondition — suspend first, then delete — deliberately lives on the
 * server and not only in the dialog: a confirmation in the browser is a
 * request, not a rule.
 */
export async function deleteWorkspaceAsPlatform(
  workspaceId: string,
  confirmation: string,
): Promise<AdminResult> {
  const actorId = await currentUserId();
  if (!actorId) return { error: NOT_LOGGED_IN };

  const access = await getAccess(PLATFORM);
  if (!access.has("workspace.delete")) return { error: NOT_ALLOWED };

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      name: true,
      suspended: true,
      _count: { select: { members: true, projects: true } },
    },
  });
  if (!workspace) return { error: "This workspace no longer exists." };

  if (!workspace.suspended) {
    return {
      error: "Suspend this workspace before deleting it.",
    };
  }

  // The typed name. Not as an obstacle, but so the row you happen to be on
  // isn't the row you delete.
  if (confirmation.trim() !== workspace.name) {
    return { error: "The name does not match." };
  }

  const issues = await db.issue.count({ where: { project: { workspaceId } } });

  await db.$transaction(async (tx) => {
    // Issues first: their foreign key to the project is set to `Restrict`,
    // otherwise the projects couldn't be deleted at all. Everything else
    // cascades from the workspace.
    await tx.issue.deleteMany({ where: { project: { workspaceId } } });
    await tx.workspace.delete({ where: { id: workspaceId } });
  });

  await recordAudit({
    action: "workspace.deleted",
    actorId,
    target: { type: "workspace", id: workspaceId, label: workspace.name },
    workspaceId,
    meta: {
      members: workspace._count.members,
      projects: workspace._count.projects,
      issues,
      from: "platform",
    },
  });

  await revalidate();
  return { ok: true };
}

/** Mirror image of `loadMoreWorkspaceActivity`/`loadMoreProjectActivity`
 * (`features/audit/actions.ts`), for the platform audit log. */
export async function loadMorePlatformActivity(
  cursor: string,
): Promise<ActivityPage> {
  await requirePermission("audit.view", PLATFORM);
  const entries = await listAudit({ cursor, limit: ACTIVITY_PAGE_SIZE });
  return {
    entries,
    nextCursor:
      entries.length === ACTIVITY_PAGE_SIZE
        ? entries[entries.length - 1].id
        : null,
  };
}

/** One more page for infinite scroll in `PlatformUsers`. */
export async function loadMoreUsers(
  cursor: string,
): Promise<{ items: PlatformUser[]; nextCursor: string | null }> {
  const { rows, nextCursor } = await getAllUsers(cursor, TABLE_PAGE_SIZE);
  return { items: rows, nextCursor };
}

/** One more page for infinite scroll in `PlatformProjects`. */
export async function loadMoreProjects(
  cursor: string,
): Promise<{ items: PlatformProject[]; nextCursor: string | null }> {
  const { rows, nextCursor } = await getAllProjects(cursor);
  return { items: rows, nextCursor };
}

/** One more page for infinite scroll in `PlatformWorkspaces`. */
export async function loadMoreWorkspaces(
  cursor: string,
): Promise<{ items: PlatformWorkspace[]; nextCursor: string | null }> {
  const { rows, nextCursor } = await getAllWorkspaces(cursor);
  return { items: rows, nextCursor };
}
