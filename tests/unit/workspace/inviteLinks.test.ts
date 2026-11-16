import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// `@/lib/invite-links` stays unmocked (no tests of its own in this process).
// `@/lib/project-membership`, on the other hand — like `inviteWorkspaceMember.test.ts`,
// `teams.test.ts`, and `removeMember.test.ts` in the same directory — is
// mocked itself: the shared module cache (see CLAUDE.md) lets only one
// version win per process anyway, and this directory has committed to the mock.

const mockRoleFindFirst = mock();
const mockInviteLinkUpdateMany = mock();
const mockInviteLinkCreate = mock();
const mockInviteLinkFindUnique = mock();
const mockInviteLinkUpdate = mock();
const mockTransaction = mock();

// The tx client for `joinViaInviteLink` — `redeemInviteLink` writes to this.
const mockTxProjectMemberFindUnique = mock();
const mockTxProjectMemberCreate = mock();
const mockTxWorkspaceMemberFindUnique = mock();
const mockTxWorkspaceMemberCreate = mock();

const mockTx = {
  projectMember: {
    findUnique: mockTxProjectMemberFindUnique,
    create: mockTxProjectMemberCreate,
  },
  workspaceMember: {
    findUnique: mockTxWorkspaceMemberFindUnique,
    create: mockTxWorkspaceMemberCreate,
  },
};

mock.module("@/lib/db", () => ({
  db: {
    role: { findFirst: mockRoleFindFirst },
    inviteLink: {
      updateMany: mockInviteLinkUpdateMany,
      create: mockInviteLinkCreate,
      findUnique: mockInviteLinkFindUnique,
      update: mockInviteLinkUpdate,
    },
    $transaction: mockTransaction,
  },
}));

const mockEnrollInWorkspaceProjects = mock();
mock.module("@/lib/project-membership", () => ({
  enrollInWorkspaceProjects: mockEnrollInWorkspaceProjects,
}));

const mockCan = mock();
const mockCurrentUserId = mock();
const mockAccessFor = mock();

mock.module("@/lib/permissions", () => ({
  can: mockCan,
  currentUserId: mockCurrentUserId,
  accessFor: mockAccessFor,
  requirePermission: mock(),
  PermissionError: class PermissionError extends Error {},
  assignmentCeiling: (
    access: {
      roleKey: (s: string) => string | null;
      rank: (s: string) => number;
    },
    scope: string,
  ) =>
    access.roleKey(scope) === null
      ? Number.POSITIVE_INFINITY
      : access.rank(scope),
}));

mock.module("@/lib/session", () => ({ getSession: mock() }));
mock.module("next/cache", () => ({ revalidatePath: mock() }));

import {
  createWorkspaceInviteLink,
  joinViaInviteLink,
  revokeInviteLink,
} from "@/features/workspaces/actions";

const WS = "acme";
const ACTOR = "u-actor";
const TOKEN = "tok-123";

function access(rank: number | null) {
  return {
    has: () => true,
    rank: (scope: string) => (scope === "WORKSPACE" ? (rank ?? -1) : -1),
    roleKey: (scope: string) =>
      scope === "WORKSPACE" && rank !== null ? "admin" : null,
    workspaceId: WS,
    projectId: null,
  };
}

function reset() {
  for (const m of [
    mockRoleFindFirst,
    mockInviteLinkUpdateMany,
    mockInviteLinkCreate,
    mockInviteLinkFindUnique,
    mockInviteLinkUpdate,
    mockTransaction,
    mockTxProjectMemberFindUnique,
    mockTxProjectMemberCreate,
    mockTxWorkspaceMemberFindUnique,
    mockTxWorkspaceMemberCreate,
    mockEnrollInWorkspaceProjects,
    mockCan,
    mockCurrentUserId,
    mockAccessFor,
  ]) {
    m.mockReset();
  }

  mockCurrentUserId.mockResolvedValue(ACTOR);
  mockCan.mockResolvedValue(true);
  mockAccessFor.mockResolvedValue(access(5));
  mockRoleFindFirst.mockResolvedValue({ id: "sys:WORKSPACE:member", rank: 2 });
  mockInviteLinkUpdateMany.mockResolvedValue({ count: 0 });
  mockInviteLinkCreate.mockResolvedValue({});
  mockInviteLinkUpdate.mockResolvedValue({});
  mockTxWorkspaceMemberFindUnique.mockResolvedValue(null);
  mockTxWorkspaceMemberCreate.mockResolvedValue({});
  mockEnrollInWorkspaceProjects.mockResolvedValue(undefined);
  mockTransaction.mockImplementation(
    async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
  );
}

describe("createWorkspaceInviteLink()", () => {
  beforeEach(reset);

  it("rejects when nobody is logged in", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    expect(await createWorkspaceInviteLink(WS, "member")).toEqual({
      error: "You must be logged in.",
    });
  });

  it("requires member.invite in the workspace", async () => {
    mockCan.mockResolvedValue(false);
    expect(await createWorkspaceInviteLink(WS, "member")).toEqual({
      error: "You are not allowed to invite people to this workspace.",
    });
  });

  it("does not hand out the owner role", async () => {
    expect(await createWorkspaceInviteLink(WS, "owner")).toEqual({
      error: "The owner role cannot be handed out.",
    });
  });

  it("does not assign a role above one's own rank", async () => {
    mockAccessFor.mockResolvedValue(access(2));
    mockRoleFindFirst.mockResolvedValue({ id: "sys:WORKSPACE:admin", rank: 5 });
    expect(await createWorkspaceInviteLink(WS, "admin")).toEqual({
      error: "You cannot assign a role above your own.",
    });
  });

  it("creates a link and revokes a previous one for the same scope", async () => {
    const result = await createWorkspaceInviteLink(WS, "member");

    expect(result).toMatchObject({ ok: true });
    expect("url" in result && result.url).toContain("/join/");
    expect(mockInviteLinkUpdateMany).toHaveBeenCalledWith({
      where: {
        workspaceId: WS,
        projectId: null,
        roleId: "sys:WORKSPACE:member",
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mockInviteLinkCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: WS,
        projectId: null,
        roleId: "sys:WORKSPACE:member",
        createdById: ACTOR,
        expiresAt: null,
      }),
    });
  });

  it("sets an expiry date when one is passed", async () => {
    const expiresAt = new Date("2030-01-01");
    const result = await createWorkspaceInviteLink(WS, "member", expiresAt);
    expect(result).toMatchObject({ ok: true, expiresAt });
  });
});

describe("revokeInviteLink()", () => {
  beforeEach(reset);

  it("rejects when nobody is logged in", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    expect(await revokeInviteLink(TOKEN)).toEqual({
      error: "You must be logged in.",
    });
  });

  it("reports an unknown link", async () => {
    mockInviteLinkFindUnique.mockResolvedValue(null);
    expect(await revokeInviteLink(TOKEN)).toEqual({
      error: "This link no longer exists.",
    });
  });

  it("requires member.invite in the workspace for a workspace link", async () => {
    mockInviteLinkFindUnique.mockResolvedValue({
      workspaceId: WS,
      projectId: null,
    });
    mockCan.mockResolvedValue(false);
    expect(await revokeInviteLink(TOKEN)).toEqual({
      error: "You are not allowed to manage this link.",
    });
    expect(mockInviteLinkUpdate).not.toHaveBeenCalled();
  });

  it("requires member.invite in the project for a project link", async () => {
    mockInviteLinkFindUnique.mockResolvedValue({
      workspaceId: WS,
      projectId: "p-1",
    });
    await revokeInviteLink(TOKEN);
    expect(mockCan).toHaveBeenCalledWith(ACTOR, "member.invite", {
      projectId: "p-1",
    });
  });

  it("sets revokedAt", async () => {
    mockInviteLinkFindUnique.mockResolvedValue({
      workspaceId: WS,
      projectId: null,
    });
    expect(await revokeInviteLink(TOKEN)).toEqual({ ok: true });
    expect(mockInviteLinkUpdate).toHaveBeenCalledWith({
      where: { token: TOKEN },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe("joinViaInviteLink()", () => {
  beforeEach(reset);

  const validLink = {
    token: TOKEN,
    workspaceId: WS,
    projectId: null,
    roleId: "r-member",
    expiresAt: null,
    revokedAt: null,
    workspace: { name: "Acme", suspended: false },
    project: null,
    role: { key: "member", name: "Member" },
  };

  it("rejects when nobody is logged in", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    expect(await joinViaInviteLink(TOKEN)).toEqual({
      error: "You must be logged in.",
    });
  });

  it("reports an invalid link", async () => {
    mockInviteLinkFindUnique.mockResolvedValue(null);
    expect(await joinViaInviteLink(TOKEN)).toEqual({
      error: "This invite link is no longer valid. Ask for a new one.",
    });
  });

  it("reports a revoked link", async () => {
    mockInviteLinkFindUnique.mockResolvedValue({
      ...validLink,
      revokedAt: new Date(),
    });
    expect(await joinViaInviteLink(TOKEN)).toEqual({
      error: "This invite link is no longer valid. Ask for a new one.",
    });
  });

  it("reports an expired link", async () => {
    mockInviteLinkFindUnique.mockResolvedValue({
      ...validLink,
      expiresAt: new Date("2000-01-01"),
    });
    expect(await joinViaInviteLink(TOKEN)).toEqual({
      error: "This invite link is no longer valid. Ask for a new one.",
    });
  });

  it("joins as a new member and is enrolled in public projects", async () => {
    mockInviteLinkFindUnique.mockResolvedValue(validLink);

    const result = await joinViaInviteLink(TOKEN);

    expect(result).toEqual({ ok: true, workspaceId: WS });
    expect(mockTxWorkspaceMemberCreate).toHaveBeenCalledWith({
      data: {
        workspaceId: WS,
        userId: ACTOR,
        roleId: "r-member",
        pending: false,
      },
    });
    expect(mockEnrollInWorkspaceProjects).toHaveBeenCalledWith(mockTx, {
      workspaceId: WS,
      userId: ACTOR,
    });
  });

  it("is idempotent — an existing member stays untouched", async () => {
    mockInviteLinkFindUnique.mockResolvedValue(validLink);
    mockTxWorkspaceMemberFindUnique.mockResolvedValue({ userId: ACTOR });

    const result = await joinViaInviteLink(TOKEN);

    expect(result).toEqual({ ok: true, workspaceId: WS });
    expect(mockTxWorkspaceMemberCreate).not.toHaveBeenCalled();
  });

  it("joins a project link's project once, with the link's role", async () => {
    mockInviteLinkFindUnique.mockResolvedValue({
      ...validLink,
      projectId: "p-1",
      roleId: "r-dev",
      project: { name: "Web" },
      role: { key: "developer", name: "Developer" },
    });
    mockTxWorkspaceMemberFindUnique.mockResolvedValue({ userId: ACTOR });

    await joinViaInviteLink(TOKEN);
    expect(mockTxProjectMemberCreate).toHaveBeenCalledWith({
      data: {
        projectId: "p-1",
        userId: ACTOR,
        roleId: "r-dev",
        origin: "manual",
      },
    });

    // Already in the project: nothing is written a second time.
    mockTxProjectMemberCreate.mockReset();
    mockTxProjectMemberFindUnique.mockResolvedValue({ userId: ACTOR });
    await joinViaInviteLink(TOKEN);
    expect(mockTxProjectMemberCreate).not.toHaveBeenCalled();
  });
});
