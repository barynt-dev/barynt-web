// ─── Preview ─────────────────────────────────────────────────────────────────
//
// Renders a template with sample data — for the admin editor, live on every
// keystroke. Deliberately imports only from `lib/mail/templates/*`, never
// from `lib/mail/index.ts` or `lib/mail/send.ts`: the former are pure
// functions with no `server-only`, the latter need the database. This file
// has to be able to run from a client component.

import type { MailTemplateKey } from "@/features/mail-templates/catalog";
import { emailVerificationEmail } from "@/lib/mail/templates/emailVerification";
import { invitationEmail } from "@/lib/mail/templates/invitation";
import { issueShareEmail } from "@/lib/mail/templates/issueShare";
import { issueUpdateEmail } from "@/lib/mail/templates/issueUpdate";
import { memberRemovedEmail } from "@/lib/mail/templates/memberRemoved";
import { notificationEmail } from "@/lib/mail/templates/notification";
import type { TemplateOverride } from "@/lib/mail/templates/override";
import { passwordResetEmail } from "@/lib/mail/templates/passwordReset";
import type { MailContent } from "@/lib/mail/templates/types";
import { webhookDisabledEmail } from "@/lib/mail/templates/webhookDisabled";
import { weeklyDigestEmail } from "@/lib/mail/templates/weeklyDigest";
import { welcomeEmail } from "@/lib/mail/templates/welcome";

const SAMPLE_TO = "mara@example.com";
const SAMPLE_URL = "https://issues.example.com/acme/issue/ACME-42";
const SAMPLE_MANAGE_URL =
  "https://issues.example.com/acme/account/notifications";

export function renderMailPreview(
  key: MailTemplateKey,
  override?: TemplateOverride,
): MailContent {
  switch (key) {
    case "webhookDisabled":
      return webhookDisabledEmail(
        {
          to: SAMPLE_TO,
          workspaceName: "Acme",
          url: "https://hooks.example.com/barynt",
          failingSince: new Date(Date.now() - 26 * 60 * 60 * 1000),
          lastResult: "HTTP 503",
          settingsUrl: "https://issues.example.com/acme/settings/webhooks",
        },
        override,
      );
    case "invitation":
      return invitationEmail(
        {
          to: SAMPLE_TO,
          workspaceName: "Acme",
          projectName: "Apollo Redesign",
          roleName: "Member",
          inviterName: "Jonas Reuter",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          inviteUrl: "https://issues.example.com/invite/abc123",
        },
        override,
      );
    case "memberRemoved":
      return memberRemovedEmail(
        {
          to: SAMPLE_TO,
          workspaceName: "Acme",
          projectName: "Apollo Redesign",
          actorName: "Jonas Reuter",
        },
        override,
      );
    case "welcome":
      return welcomeEmail(
        {
          to: SAMPLE_TO,
          firstName: "Mara",
          loginUrl: "https://issues.example.com/login",
        },
        override,
      );
    case "emailVerification":
      return emailVerificationEmail(
        {
          to: SAMPLE_TO,
          firstName: "Mara",
          verifyUrl: "https://issues.example.com/verify/abc123",
          expiresInHours: 24,
        },
        override,
      );
    case "passwordReset":
      return passwordResetEmail(
        {
          to: SAMPLE_TO,
          requestedAt: new Date(),
          device: "Chrome on macOS",
          location: "Hamburg, DE",
          expiresInMinutes: 60,
          resetUrl: "https://issues.example.com/reset/abc123",
          securityUrl: "https://issues.example.com/acme/account/security",
        },
        override,
      );
    case "notification.assigned":
      return notificationEmail(
        {
          to: SAMPLE_TO,
          type: "assigned",
          actorLabel: "Jonas Reuter",
          text: "",
          workspaceName: "Acme",
          project: { name: "Apollo Redesign" },
          issue: { identifier: "ACME-42", title: "Fix login error" },
          url: SAMPLE_URL,
          manageUrl: SAMPLE_MANAGE_URL,
        },
        override,
      );
    case "notification.mentioned":
      return notificationEmail(
        {
          to: SAMPLE_TO,
          type: "mentioned",
          actorLabel: "Jonas Reuter",
          text: "@mara can you check this?",
          workspaceName: "Acme",
          project: { name: "Apollo Redesign" },
          issue: { identifier: "ACME-42", title: "Fix login error" },
          url: SAMPLE_URL,
          manageUrl: SAMPLE_MANAGE_URL,
        },
        override,
      );
    case "notification.comment":
      return notificationEmail(
        {
          to: SAMPLE_TO,
          type: "comment",
          actorLabel: "Jonas Reuter",
          text: "The screen reader announces the order incorrectly — please fix before release.",
          workspaceName: "Acme",
          project: { name: "Apollo Redesign" },
          issue: { identifier: "ACME-42", title: "Fix login error" },
          url: SAMPLE_URL,
          manageUrl: SAMPLE_MANAGE_URL,
        },
        override,
      );
    case "notification.commentReply":
      return notificationEmail(
        {
          to: SAMPLE_TO,
          type: "commentReply",
          actorLabel: "Jonas Reuter",
          text: "Good point — I'll adjust that before release.",
          workspaceName: "Acme",
          project: { name: "Apollo Redesign" },
          issue: { identifier: "ACME-42", title: "Fix login error" },
          url: SAMPLE_URL,
          manageUrl: SAMPLE_MANAGE_URL,
        },
        override,
      );
    case "notification.status":
      return notificationEmail(
        {
          to: SAMPLE_TO,
          type: "status",
          actorLabel: "Jonas Reuter",
          text: "in_progress",
          workspaceName: "Acme",
          project: { name: "Apollo Redesign" },
          issue: { identifier: "ACME-42", title: "Fix login error" },
          url: SAMPLE_URL,
          manageUrl: SAMPLE_MANAGE_URL,
        },
        override,
      );
    case "notification.invite":
      return notificationEmail(
        {
          to: SAMPLE_TO,
          type: "invite",
          actorLabel: "Jonas Reuter",
          text: "Member",
          workspaceName: "Acme",
          project: null,
          issue: null,
          url: SAMPLE_MANAGE_URL,
          manageUrl: SAMPLE_MANAGE_URL,
        },
        override,
      );
    case "notification.role":
      return notificationEmail(
        {
          to: SAMPLE_TO,
          type: "role",
          actorLabel: "Jonas Reuter",
          text: "Admin",
          workspaceName: "Acme",
          project: null,
          issue: null,
          url: SAMPLE_MANAGE_URL,
          manageUrl: SAMPLE_MANAGE_URL,
        },
        override,
      );
    case "notification.issueShared":
      return notificationEmail(
        {
          to: SAMPLE_TO,
          type: "issueShared",
          actorLabel: "Jonas Reuter",
          text: "Can you take a look at this?",
          workspaceName: "Acme",
          project: { name: "Apollo Redesign" },
          issue: { identifier: "ACME-42", title: "Fix login error" },
          url: SAMPLE_URL,
          manageUrl: SAMPLE_MANAGE_URL,
        },
        override,
      );
    case "weeklyDigest":
      return weeklyDigestEmail(
        {
          to: SAMPLE_TO,
          firstName: "Mara",
          workspaceName: "Acme",
          periodLabel: "Aug 7–14",
          assignedOpenCount: 3,
          completedCount: 5,
          createdCount: 2,
          highlights: [
            {
              identifier: "ACME-42",
              title: "Fix login error",
              statusLabel: "Done",
            },
          ],
          url: "https://issues.example.com/acme/my",
        },
        override,
      );
    case "issueUpdate":
      return issueUpdateEmail(
        {
          to: SAMPLE_TO,
          actorLabel: "Jonas Reuter",
          issue: { identifier: "ACME-42", title: "Fix login error" },
          changes: [
            { field: "Priority", from: "Medium", to: "High" },
            { field: "Title", to: "Urgently fix login error" },
          ],
          url: SAMPLE_URL,
        },
        override,
      );
    case "issueShare":
      return issueShareEmail(
        {
          to: SAMPLE_TO,
          actorName: "Jonas Reuter",
          issueIdentifier: "ACME-42",
          issueTitle: "Fix login error",
          text: "Can you take a look at this?",
          url: "https://issues.example.com/share/abc123",
        },
        override,
      );
  }
}
