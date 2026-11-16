// ─── Shareable invite links ──────────────────────────────────────────────────
//
// Unlike `lib/invitations.ts` (one token → one pre-created account), a link
// here is generic: an unlimited number of people can redeem it, until it's
// revoked or expires. There's no identity known in advance — the person
// only decides when opening the link whether they register or join with an
// existing session (`redeemInviteLink` covers both cases with the same
// code).
//
// A scope (workspace, optionally also a project, plus a role) carries at
// most one active link — `createInviteLink` revokes a previous one for the
// same scope before the new one is created.

import { randomBytes } from "node:crypto";
import { appUrl } from "@/lib/app-url";
import type { Prisma } from "@/lib/generated/prisma/client";
import { enrollInWorkspaceProjects } from "@/lib/project-membership";
import { PROJECT_GUEST_ROLE_KEY } from "@/lib/rbac";

/** Fits both the Prisma client and a transaction client. */
type Db = Prisma.TransactionClient;

/** 32 bytes from the OS's random number generator, base64url encoded —
 *  same as `newInvitationToken` in `lib/invitations.ts`. */
export function newInviteLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The path where an invite link is redeemed. Without a locale prefix. */
export function inviteLinkPath(token: string): string {
  return `/join/${token}`;
}

export function inviteLinkUrl(token: string): string {
  return appUrl(inviteLinkPath(token));
}

export interface CreatedInviteLink {
  token: string;
  expiresAt: Date | null;
}

export async function createInviteLink(
  db: Db,
  data: {
    workspaceId: string;
    projectId?: string | null;
    roleId: string;
    createdById: string;
    expiresAt?: Date | null;
  },
  now: Date,
): Promise<CreatedInviteLink> {
  await db.inviteLink.updateMany({
    where: {
      workspaceId: data.workspaceId,
      projectId: data.projectId ?? null,
      roleId: data.roleId,
      revokedAt: null,
    },
    data: { revokedAt: now },
  });

  const token = newInviteLinkToken();
  await db.inviteLink.create({
    data: {
      token,
      workspaceId: data.workspaceId,
      projectId: data.projectId ?? null,
      roleId: data.roleId,
      createdById: data.createdById,
      expiresAt: data.expiresAt ?? null,
    },
  });

  return { token, expiresAt: data.expiresAt ?? null };
}

export interface ResolvedInviteLink {
  token: string;
  workspaceId: string;
  workspaceName: string;
  projectId: string | null;
  projectName: string | null;
  roleId: string;
  roleKey: string;
  roleName: string;
}

/**
 * Loads a link that can still be redeemed.
 *
 * `null` always means the same thing: unknown, revoked, expired, or
 * workspace suspended — the same reticence as `openInvitation`, so the page
 * doesn't become an oracle for valid tokens.
 */
export async function resolveInviteLink(
  db: Db,
  token: string,
  now: Date,
): Promise<ResolvedInviteLink | null> {
  if (!token) return null;

  const link = await db.inviteLink.findUnique({
    where: { token },
    select: {
      token: true,
      workspaceId: true,
      projectId: true,
      roleId: true,
      expiresAt: true,
      revokedAt: true,
      workspace: { select: { name: true, suspended: true } },
      project: { select: { name: true } },
      role: { select: { key: true, name: true } },
    },
  });
  if (!link) return null;
  if (link.revokedAt) return null;
  if (link.expiresAt && link.expiresAt <= now) return null;
  if (link.workspace.suspended) return null;

  return {
    token: link.token,
    workspaceId: link.workspaceId,
    workspaceName: link.workspace.name,
    projectId: link.projectId,
    projectName: link.project?.name ?? null,
    roleId: link.roleId,
    roleKey: link.role.key,
    roleName: link.role.name,
  };
}

/**
 * Redeems a link for an already logged-in person.
 *
 * Idempotent: already a member → no-op instead of an error, the same
 * address can open the link multiple times (reload, second device) without
 * anything ending up different afterward. No `pending` — unlike
 * `Invitation`, there's no shadow account with an unset password; the
 * account already exists and is logged in.
 */
export async function redeemInviteLink(
  db: Db,
  link: ResolvedInviteLink,
  userId: string,
  defaultWorkspaceRoleId: string,
): Promise<InviteLinkJoins> {
  const joins: InviteLinkJoins = [];
  const joinWorkspace = async (roleId: string) => {
    const existing = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: link.workspaceId, userId } },
      select: { userId: true },
    });
    if (existing) return;
    await db.workspaceMember.create({
      data: { workspaceId: link.workspaceId, userId, roleId, pending: false },
    });
    await enrollInWorkspaceProjects(db, {
      workspaceId: link.workspaceId,
      userId,
    });
    joins.push({ userId, roleId, projectId: null });
  };

  if (link.projectId) {
    const already = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId: link.projectId, userId } },
      select: { userId: true },
    });
    if (!already) {
      await db.projectMember.create({
        data: {
          projectId: link.projectId,
          userId,
          roleId: link.roleId,
          origin: "manual",
        },
      });
      joins.push({ userId, roleId: link.roleId, projectId: link.projectId });
    }

    // As with the email invite: a guest stays excluded, any other role
    // comes with full workspace membership (and thus access to the public
    // projects, not just this one).
    if (link.roleKey !== PROJECT_GUEST_ROLE_KEY)
      await joinWorkspace(defaultWorkspaceRoleId);
    return joins;
  }

  await joinWorkspace(link.roleId);
  return joins;
}

/** The memberships a redeemed link created — for the caller to announce
 *  (`member.added`) once its transaction is through. */
export type InviteLinkJoins = {
  userId: string;
  roleId: string;
  /** `null` for the workspace. */
  projectId: string | null;
}[];
