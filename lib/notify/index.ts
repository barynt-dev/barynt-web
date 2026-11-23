import "server-only";
import type {
  NotificationEvent,
  NotificationKey,
} from "@/features/account/types";
import { appUrl } from "@/lib/app-url";
import { afterResponse } from "@/lib/background";
import { db } from "@/lib/db";
import { isMailConfigured, notificationEmail, sendMail } from "@/lib/mail";
import { getMailTemplateOverride } from "@/lib/mail/overrides";
import type { TemplateOverride } from "@/lib/mail/templates/override";
import { accountPath, projectPath, workspacePath } from "@/lib/nav";

// ─── Notifications: writing ──────────────────────────────────────────────────
//
// Same pattern as `lib/audit`: a narrow write function called from multiple
// feature domains (issues, workspaces, projects), without those needing to
// know about each other. Errors are swallowed and only logged — a
// stumbling notification must never block an assignment, a comment, or a
// role change.

export interface NotifyInput {
  /** Recipient. */
  userId: string;
  type: NotificationEvent;
  /** Who triggered the notification. If missing or equal to `userId`, no
   *  row is created — no one notifies themselves. */
  actorId?: string | null;
  workspaceId: string;
  /** Set = project-related, `null`/missing = workspace-related. */
  projectId?: string | null;
  issueId?: string | null;
  /** Role name, status key, or comment preview, depending on `type`. */
  text?: string;
}

const UNKNOWN_ACTOR = "Unbekannt";

/** As with the audit log: the name is frozen at write time, not resolved
 *  at read time — an account renamed or lost later doesn't retroactively
 *  change a notification that's already been delivered. */
async function actorLabelsFor(
  actorIds: string[],
): Promise<Map<string, string>> {
  if (actorIds.length === 0) return new Map();
  const users = await db.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  return new Map(
    users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]),
  );
}

/** Who set which channel for which event — if the row is missing, the
 *  schema default applies (see `EMAIL_DEFAULT` below for the mail columns;
 *  every `*InApp` column defaults to `true`). Both channels in one query,
 *  because they hang off the same row and are needed together for every
 *  notification anyway. */
async function notificationPrefsFor(
  userIds: string[],
): Promise<Map<string, Partial<Record<NotificationKey, boolean>>>> {
  if (userIds.length === 0) return new Map();
  const rows = await db.userPreferences.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId: true,
      assignedInApp: true,
      assignedEmail: true,
      mentionedInApp: true,
      mentionedEmail: true,
      commentInApp: true,
      commentEmail: true,
      commentReplyInApp: true,
      commentReplyEmail: true,
      statusInApp: true,
      statusEmail: true,
      inviteInApp: true,
      inviteEmail: true,
      roleInApp: true,
      roleEmail: true,
      issueSharedInApp: true,
      issueSharedEmail: true,
    },
  });
  return new Map(rows.map(({ userId, ...settings }) => [userId, settings]));
}

/** Default values of the `*Email` columns from `prisma/schema.prisma` —
 *  experience shows status changes and comments are too frequent for the
 *  inbox, everything else is rare enough that email defaults to on. */
const EMAIL_DEFAULT: Record<NotificationEvent, boolean> = {
  assigned: true,
  mentioned: true,
  comment: false,
  commentReply: true,
  status: false,
  invite: true,
  role: true,
  issueShared: true,
};

interface EmailContext {
  workspaceName: string;
  project: { name: string } | null;
  issue: { identifier: string; title: string } | null;
  url: string;
}

/**
 * Names and target URL for a notification email — cached per
 * workspace/project/issue combination, so a batch (e.g. to the assignee
 * *and* the reporter on a status change) doesn't load the same rows
 * multiple times.
 */
async function emailContextFor(
  cache: Map<string, EmailContext>,
  item: Pick<NotifyInput, "workspaceId" | "projectId" | "issueId">,
): Promise<EmailContext> {
  const cacheKey = `${item.workspaceId}:${item.projectId ?? ""}:${item.issueId ?? ""}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const [workspace, project, issue] = await Promise.all([
    db.workspace.findUnique({
      where: { id: item.workspaceId },
      select: { name: true },
    }),
    item.projectId
      ? db.project.findUnique({
          where: { id: item.projectId },
          select: { name: true, slug: true, prefix: true },
        })
      : Promise.resolve(null),
    item.issueId
      ? db.issue.findUnique({
          where: { id: item.issueId },
          select: { key: true, title: true },
        })
      : Promise.resolve(null),
  ]);

  const identifier = issue && project ? `${project.prefix}-${issue.key}` : null;
  // The same full-page route as `features/issues/issue-links.ts#issuePath`
  // — it can't be imported from there, that file is `"use client"`.
  const url =
    identifier && issue
      ? appUrl(`/${item.workspaceId}/issue/${identifier}`)
      : project
        ? appUrl(projectPath(item.workspaceId, project.slug, "members"))
        : appUrl(workspacePath(item.workspaceId, "members"));

  const context: EmailContext = {
    workspaceName: workspace?.name ?? "",
    project: project ? { name: project.name } : null,
    issue: identifier && issue ? { identifier, title: issue.title } : null,
    url,
  };
  cache.set(cacheKey, context);
  return context;
}

/** The admin override for an event, cached per `type` — a batch of the
 *  same kind (e.g. assignee *and* reporter on a status change) would
 *  otherwise query `MailTemplate` multiple times for the same row. */
async function overrideFor(
  cache: Map<NotificationEvent, TemplateOverride | undefined>,
  type: NotificationEvent,
): Promise<TemplateOverride | undefined> {
  if (cache.has(type)) return cache.get(type);
  const override = await getMailTemplateOverride(`notification.${type}`);
  cache.set(type, override);
  return override;
}

/** Whoever wants an email for their event gets one — regardless of whether
 *  the in-app row was written above: both channels are deliberately
 *  separate columns in the schema. */
async function sendNotificationEmails(
  items: NotifyInput[],
  prefs: Map<string, Partial<Record<NotificationKey, boolean>>>,
  actorLabels: Map<string, string>,
): Promise<void> {
  const emailKey = (type: NotificationEvent) =>
    `${type}Email` as NotificationKey;
  const recipients = items.filter(
    (i) =>
      (prefs.get(i.userId)?.[emailKey(i.type)] ?? EMAIL_DEFAULT[i.type]) ===
      true,
  );
  if (recipients.length === 0) return;

  const users = await db.user.findMany({
    where: { id: { in: [...new Set(recipients.map((i) => i.userId))] } },
    select: { id: true, email: true },
  });
  const emailFor = new Map(users.map((u) => [u.id, u.email]));

  const contextCache = new Map<string, EmailContext>();
  const overrideCache = new Map<
    NotificationEvent,
    TemplateOverride | undefined
  >();
  for (const item of recipients) {
    const to = emailFor.get(item.userId);
    if (!to) continue;

    const [context, override] = await Promise.all([
      emailContextFor(contextCache, item),
      overrideFor(overrideCache, item.type),
    ]);
    const { subject, html, text } = notificationEmail(
      {
        to,
        type: item.type,
        actorLabel: item.actorId
          ? (actorLabels.get(item.actorId) ?? UNKNOWN_ACTOR)
          : UNKNOWN_ACTOR,
        text: item.text ?? "",
        workspaceName: context.workspaceName,
        project: context.project,
        issue: context.issue,
        url: context.url,
        manageUrl: appUrl(accountPath(item.workspaceId, "notifications")),
      },
      override,
    );
    await sendMail({ to, subject, html, text });
  }
}

/**
 * Creates one or more notifications and, for whoever has their channel set
 * that way, sends the same message by email too.
 *
 * Self-notifications are filtered out before either happens. In-app and
 * email channels are independent columns (see `notificationPrefsFor`) —
 * whoever has turned both off consistently gets nothing; without SMTP
 * configuration, it stays at the in-app path as before. Both happen after
 * the response (`afterResponse`); outside a request, right away.
 */
export function notify(input: NotifyInput | NotifyInput[]): Promise<void> {
  const items = (Array.isArray(input) ? input : [input]).filter(
    (i) => i.userId !== i.actorId,
  );
  if (items.length === 0) return Promise.resolve();

  // After the response: the change that triggered this (an assignment, a
  // role) doesn't wait for the inbox rows or the emails.
  return afterResponse(() => deliver(items));
}

async function deliver(items: NotifyInput[]): Promise<void> {
  try {
    const [prefs, actorLabels] = await Promise.all([
      notificationPrefsFor([...new Set(items.map((i) => i.userId))]),
      actorLabelsFor([
        ...new Set(
          items.map((i) => i.actorId).filter((id): id is string => !!id),
        ),
      ]),
    ]);

    const key = (type: NotificationEvent) => `${type}InApp` as NotificationKey;
    const rows = items
      .filter((i) => (prefs.get(i.userId)?.[key(i.type)] ?? true) === true)
      .map((i) => ({
        userId: i.userId,
        type: i.type,
        workspaceId: i.workspaceId,
        projectId: i.projectId ?? null,
        issueId: i.issueId ?? null,
        actorId: i.actorId ?? null,
        actorLabel: i.actorId
          ? (actorLabels.get(i.actorId) ?? UNKNOWN_ACTOR)
          : UNKNOWN_ACTOR,
        text: i.text ?? "",
      }));

    if (rows.length > 0) {
      await db.notification.createMany({ data: rows });
    }

    if (isMailConfigured()) {
      await sendNotificationEmails(items, prefs, actorLabels);
    }
  } catch (error) {
    console.error("[notify] Benachrichtigung nicht geschrieben:", error);
  }
}
