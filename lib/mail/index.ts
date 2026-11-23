import "server-only";
import { appUrl } from "@/lib/app-url";
import { afterResponse } from "@/lib/background";
import { db } from "@/lib/db";
import { getMailTemplateOverride } from "@/lib/mail/overrides";
import { isMailConfigured, sendMail } from "@/lib/mail/send";
import { invitationEmail } from "@/lib/mail/templates/invitation";
import { issueShareEmail } from "@/lib/mail/templates/issueShare";
import { memberRemovedEmail } from "@/lib/mail/templates/memberRemoved";
import { webhookDisabledEmail } from "@/lib/mail/templates/webhookDisabled";
import { workspaceSettingsPath } from "@/lib/nav";

export { isMailConfigured, sendMail } from "@/lib/mail/send";
export type { EmailVerificationInput } from "@/lib/mail/templates/emailVerification";
export { emailVerificationEmail } from "@/lib/mail/templates/emailVerification";
export type { InvitationEmailInput } from "@/lib/mail/templates/invitation";
export { invitationEmail } from "@/lib/mail/templates/invitation";
export type { IssueShareEmailInput } from "@/lib/mail/templates/issueShare";
export { issueShareEmail } from "@/lib/mail/templates/issueShare";
export type {
  IssueUpdateChange,
  IssueUpdateEmailInput,
} from "@/lib/mail/templates/issueUpdate";
export { issueUpdateEmail } from "@/lib/mail/templates/issueUpdate";
export type { MemberRemovedEmailInput } from "@/lib/mail/templates/memberRemoved";
export { memberRemovedEmail } from "@/lib/mail/templates/memberRemoved";
export type { NotificationEmailInput } from "@/lib/mail/templates/notification";
export { notificationEmail } from "@/lib/mail/templates/notification";
export type { PasswordResetEmailInput } from "@/lib/mail/templates/passwordReset";
export { passwordResetEmail } from "@/lib/mail/templates/passwordReset";
export type { MailContent } from "@/lib/mail/templates/types";
export type { WebhookDisabledEmailInput } from "@/lib/mail/templates/webhookDisabled";
export { webhookDisabledEmail } from "@/lib/mail/templates/webhookDisabled";
export type {
  WeeklyDigestEmailInput,
  WeeklyDigestHighlight,
} from "@/lib/mail/templates/weeklyDigest";
export { weeklyDigestEmail } from "@/lib/mail/templates/weeklyDigest";
export type { WelcomeEmailInput } from "@/lib/mail/templates/welcome";
export { welcomeEmail } from "@/lib/mail/templates/welcome";

export interface SendInvitationEmailInput {
  to: string;
  workspaceId: string;
  /** Set = invitation into a specific project. */
  projectId?: string | null;
  /** Who sent the invitation. */
  inviterId: string;
  roleName: string;
  expiresAt: Date;
  inviteUrl: string;
}

/**
 * Sends the invitation email for a newly created account (unknown address
 * in `inviteWorkspaceMember`/`inviteProjectMember`) — the only way for this
 * person to get to their passwordless account.
 *
 * Loads the workspace, project, and inviter names itself, so callers only
 * need to pass through ids. Swallows every error: the membership already
 * exists at this point, a stumbling email must not undo it. Without SMTP
 * configuration, it stays at the copyable link that the actions return
 * anyway.
 */
export function sendInvitationEmail(
  input: SendInvitationEmailInput,
): Promise<void> {
  if (!isMailConfigured()) return Promise.resolve();
  return afterResponse(() => deliverInvitationEmail(input));
}

async function deliverInvitationEmail(
  input: SendInvitationEmailInput,
): Promise<void> {
  try {
    const [workspace, project, inviter, override] = await Promise.all([
      db.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { name: true },
      }),
      input.projectId
        ? db.project.findUnique({
            where: { id: input.projectId },
            select: { name: true },
          })
        : Promise.resolve(null),
      db.user.findUnique({
        where: { id: input.inviterId },
        select: { firstName: true, lastName: true },
      }),
      getMailTemplateOverride("invitation"),
    ]);
    if (!workspace) return;

    const { subject, html, text } = invitationEmail(
      {
        to: input.to,
        workspaceName: workspace.name,
        projectName: project?.name ?? null,
        roleName: input.roleName,
        inviterName: inviter
          ? `${inviter.firstName} ${inviter.lastName}`.trim()
          : "Someone",
        expiresAt: input.expiresAt,
        inviteUrl: input.inviteUrl,
      },
      override,
    );
    await sendMail({ to: input.to, subject, html, text });
  } catch (error) {
    console.error("[mail] Invitation not sent:", error);
  }
}

export interface SendMemberRemovedEmailInput {
  /** Who was removed. */
  userId: string;
  workspaceId: string;
  /** Set = removed only from this project, workspace access remains. */
  projectId?: string | null;
  /** Who removed them. */
  actorId: string;
}

/**
 * Sends the email for `removeMember`/`removeProjectMember` — loads the
 * recipient, workspace, project, and actor names itself, so callers only
 * need to pass through ids (like `sendInvitationEmail`).
 *
 * Swallows every error: the membership is already gone at this point, a
 * stumbling email must not undo that.
 */
export function sendMemberRemovedEmail(
  input: SendMemberRemovedEmailInput,
): Promise<void> {
  if (!isMailConfigured()) return Promise.resolve();
  return afterResponse(() => deliverMemberRemovedEmail(input));
}

async function deliverMemberRemovedEmail(
  input: SendMemberRemovedEmailInput,
): Promise<void> {
  try {
    const [user, workspace, project, actor, override] = await Promise.all([
      db.user.findUnique({
        where: { id: input.userId },
        select: { email: true },
      }),
      db.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { name: true },
      }),
      input.projectId
        ? db.project.findUnique({
            where: { id: input.projectId },
            select: { name: true },
          })
        : Promise.resolve(null),
      db.user.findUnique({
        where: { id: input.actorId },
        select: { firstName: true, lastName: true },
      }),
      getMailTemplateOverride("memberRemoved"),
    ]);
    // A passkey account with no address on file has nothing to be reached
    // at here — not an error, just nothing to send.
    if (!user?.email || !workspace) return;

    const { subject, html, text } = memberRemovedEmail(
      {
        to: user.email,
        workspaceName: workspace.name,
        projectName: project?.name ?? null,
        actorName: actor
          ? `${actor.firstName} ${actor.lastName}`.trim()
          : "Jemand",
      },
      override,
    );
    await sendMail({ to: user.email, subject, html, text });
  } catch (error) {
    console.error("[mail] Removal notice not sent:", error);
  }
}

export interface SendIssueShareLinkEmailInput {
  to: string;
  actorId: string;
  issueIdentifier: string;
  issueTitle: string;
  text?: string;
  url: string;
}

/**
 * Sends an issue's public read-only link to an arbitrary address — unlike
 * `sendInvitationEmail`/`sendMemberRemovedEmail`, not to an account in the
 * system; `to` comes directly from the person sharing.
 *
 * Swallows every error: the link already exists at this point, a stumbling
 * email must not undo the sharing itself.
 */
export function sendIssueShareLinkEmail(
  input: SendIssueShareLinkEmailInput,
): Promise<void> {
  if (!isMailConfigured()) return Promise.resolve();
  return afterResponse(() => deliverIssueShareLinkEmail(input));
}

async function deliverIssueShareLinkEmail(
  input: SendIssueShareLinkEmailInput,
): Promise<void> {
  try {
    const [actor, override] = await Promise.all([
      db.user.findUnique({
        where: { id: input.actorId },
        select: { firstName: true, lastName: true },
      }),
      getMailTemplateOverride("issueShare"),
    ]);

    const { subject, html, text } = issueShareEmail(
      {
        to: input.to,
        actorName: actor
          ? `${actor.firstName} ${actor.lastName}`.trim()
          : "Jemand",
        issueIdentifier: input.issueIdentifier,
        issueTitle: input.issueTitle,
        text: input.text,
        url: input.url,
      },
      override,
    );
    await sendMail({ to: input.to, subject, html, text });
  } catch (error) {
    console.error("[mail] Shared link not sent:", error);
  }
}

/** Tells whoever created a webhook that Barynt turned it off after a day of
 *  failed deliveries (BARY-211). No preference toggle — like the removal
 *  notice, it's about something they set up, not a notification. */
export async function sendWebhookDisabledEmail(input: {
  userId: string;
  workspaceId: string;
  url: string;
  failingSince: Date;
}): Promise<void> {
  try {
    const [user, workspace, hook, override] = await Promise.all([
      db.user.findUnique({
        where: { id: input.userId },
        select: { email: true },
      }),
      db.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { name: true },
      }),
      db.webhook.findFirst({
        where: { workspaceId: input.workspaceId, url: input.url },
        select: { lastDeliveryStatus: true, lastDeliveryError: true },
      }),
      getMailTemplateOverride("webhookDisabled"),
    ]);
    if (!user?.email || !workspace) return;
    const { subject, html, text } = webhookDisabledEmail(
      {
        to: user.email,
        workspaceName: workspace.name,
        url: input.url,
        failingSince: input.failingSince,
        lastResult: hook?.lastDeliveryStatus
          ? `HTTP ${hook.lastDeliveryStatus}`
          : (hook?.lastDeliveryError ?? "—"),
        settingsUrl: appUrl(
          workspaceSettingsPath(input.workspaceId, "webhooks"),
        ),
      },
      override,
    );
    await sendMail({ to: user.email, subject, html, text });
  } catch (error) {
    console.error("[mail] Webhook notice not sent:", error);
  }
}
