import "server-only";
import { db } from "@/lib/db";
import { fullName } from "@/lib/utils/string";
import { dispatchEvent, type EventContext, hasEventListeners } from "./emit";
import type { WebhookEvent } from "./events";

// Project, label and member events (BARY-210) — what they carry, read from
// the database alone, so anything may call them (`auth.ts` included)
// without pulling in the REST queries. Issues and comments:
// `features/api-v1/events.ts`.
//
// Like `emitEvent`, every `emit*` here is fire-and-forget: it's called
// after the change is written, returns at once and never throws.

/** Runs an announcement in the background. */
export function background(work: () => Promise<void>): void {
  work().catch(() => {});
}

// ─── Projects ────────────────────────────────────────────────────────────────

export interface EventProject {
  id: string;
  name: string;
  slug: string;
  prefix: string;
  color: string;
  visibility: string;
  archived: boolean;
}

/** `project.*` — read fresh, so it carries what's stored now. A deleted
 *  project passes what it was (`eventProject`, read before) instead. */
export function emitProjectEvent(
  event: Extract<WebhookEvent, `project.${string}`>,
  projectId: string,
  ctx: Omit<EventContext, "projectId">,
  gone?: EventProject | null,
): void {
  background(async () => {
    if (!(await hasEventListeners(ctx.workspaceId))) return;
    const found = gone ?? (await eventProject(projectId));
    if (!found) return;
    const { id, name, slug, prefix, color, visibility, archived } = found;
    await dispatchEvent(
      event,
      {
        id,
        name,
        slug,
        prefix,
        color,
        visibility,
        archived,
      } satisfies EventProject,
      { ...ctx, projectId },
    );
  });
}

/** A project as `project.*` carries it, and its workspace — `null` when
 *  it's gone or can't be read. Read it before a delete: afterwards there's
 *  nothing left to say what went. */
export async function eventProject(
  projectId: string,
): Promise<(EventProject & { workspaceId: string }) | null> {
  try {
    const row = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        slug: true,
        prefix: true,
        color: true,
        visibility: true,
        archivedAt: true,
        workspaceId: true,
      },
    });
    if (!row) return null;
    const { archivedAt, ...rest } = row;
    return { ...rest, archived: archivedAt !== null };
  } catch {
    return null;
  }
}

// ─── Labels ──────────────────────────────────────────────────────────────────

export interface EventLabel {
  id: string;
  name: string;
  slug: string;
  color: string;
  /** `null` for a workspace-wide label. */
  projectId: string | null;
}

/** `label.*` — takes the row as stored and passes on only these fields. */
export function emitLabelEvent(
  event: Extract<WebhookEvent, `label.${string}`>,
  label: EventLabel,
  ctx: Omit<EventContext, "projectId">,
): void {
  const { id, name, slug, color, projectId } = label;
  background(() =>
    dispatchEvent(
      event,
      { id, name, slug, color, projectId } satisfies EventLabel,
      { ...ctx, projectId },
    ),
  );
}

// ─── Members ─────────────────────────────────────────────────────────────────

/** A person in a workspace or project — no email address: a member's
 *  address is nobody else's business, here as in the API's mentions. */
export interface EventMember {
  id: string;
  name: string;
  handle: string;
  /** The role's key (`admin`, `member`, …). */
  role: string;
  /** `null` for the workspace. */
  projectId: string | null;
}

/** `member.*` — for a workspace (`projectId` null) or a project. Reads the
 *  person and the role by id; on a role change pass the one before too. */
export function emitMemberEvent(
  event: Extract<WebhookEvent, `member.${string}`>,
  member: { userId: string; roleId: string; projectId?: string | null },
  ctx: Omit<EventContext, "projectId">,
  extra?: { previousRoleId?: string },
): void {
  background(async () => {
    if (!(await hasEventListeners(ctx.workspaceId))) return;
    const ids = [member.roleId, extra?.previousRoleId].filter(
      (id): id is string => !!id,
    );
    const [user, roles] = await Promise.all([
      db.user.findUnique({
        where: { id: member.userId },
        select: { id: true, firstName: true, lastName: true, handle: true },
      }),
      db.role.findMany({
        where: { id: { in: ids } },
        select: { id: true, key: true },
      }),
    ]);
    if (!user) return;
    const key = (id: string | undefined) =>
      roles.find((r) => r.id === id)?.key ?? null;
    const projectId = member.projectId ?? null;
    const data: EventMember = {
      id: user.id,
      name: fullName(user),
      handle: user.handle,
      role: key(member.roleId) ?? "",
      projectId,
    };
    await dispatchEvent(
      event,
      data,
      { ...ctx, projectId },
      extra?.previousRoleId
        ? {
            changes: {
              role: { from: key(extra.previousRoleId), to: data.role },
            },
          }
        : undefined,
    );
  });
}
