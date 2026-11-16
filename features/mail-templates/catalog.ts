// ─── Mail template catalog ──────────────────────────────────────────────────
//
// Pure data definition — no DB access, no `server-only`. States which keys
// exist, what they're called in the UI, and which `{{placeholders}}` are
// valid per template. `lib/mail/templates/*.ts` builds its `placeholders`
// objects from the same field names — a placeholder listed here that
// doesn't arrive there would stay literal in the admin text (see
// `applyPlaceholders`).

export const MAIL_TEMPLATE_KEYS = [
  "invitation",
  "memberRemoved",
  "welcome",
  "emailVerification",
  "passwordReset",
  "notification.assigned",
  "notification.mentioned",
  "notification.comment",
  "notification.commentReply",
  "notification.status",
  "notification.invite",
  "notification.role",
  "notification.issueShared",
  "weeklyDigest",
  "issueUpdate",
  "issueShare",
  "webhookDisabled",
] as const;

export type MailTemplateKey = (typeof MAIL_TEMPLATE_KEYS)[number];

export interface PlaceholderDef {
  key: string;
  description: string;
}

export interface MailTemplateMeta {
  key: MailTemplateKey;
  label: string;
  group: string;
  /** Whether there's a send point for this today — shown the same way in
   *  the admin editor, so nobody expects an edited text that's currently
   *  sent nowhere. */
  wired: boolean;
  placeholders: PlaceholderDef[];
}

const ACTOR: PlaceholderDef = {
  key: "actorLabel",
  description: "Who took the action",
};
const WORKSPACE: PlaceholderDef = {
  key: "workspaceName",
  description: "Name of the workspace",
};
const PROJECT: PlaceholderDef = {
  key: "projectName",
  description: "Project name — empty if workspace-wide",
};
const ISSUE_ID: PlaceholderDef = {
  key: "issueIdentifier",
  description: "Issue code, e.g. ACME-42",
};
const ISSUE_TITLE: PlaceholderDef = {
  key: "issueTitle",
  description: "Title of the issue",
};

export const MAIL_TEMPLATE_CATALOG: Record<MailTemplateKey, MailTemplateMeta> =
  {
    invitation: {
      key: "invitation",
      label: "Invitation",
      group: "Account & access",
      wired: true,
      placeholders: [
        { key: "inviterName", description: "Name of the inviting person" },
        WORKSPACE,
        PROJECT,
        { key: "roleName", description: "Role granted" },
        {
          key: "target",
          description: '"Project (Workspace)" or just the workspace name',
        },
      ],
    },
    memberRemoved: {
      key: "memberRemoved",
      label: "Removed from workspace/project",
      group: "Account & access",
      wired: true,
      placeholders: [
        { key: "actorName", description: "Who removed them" },
        WORKSPACE,
        PROJECT,
        {
          key: "target",
          description: '"Project (Workspace)" or just the workspace name',
        },
      ],
    },
    welcome: {
      key: "welcome",
      label: "Registration",
      group: "Account & access",
      wired: false,
      placeholders: [{ key: "firstName", description: "First name" }],
    },
    emailVerification: {
      key: "emailVerification",
      label: "Confirm email",
      group: "Account & access",
      wired: false,
      placeholders: [{ key: "firstName", description: "First name" }],
    },
    passwordReset: {
      key: "passwordReset",
      label: "Reset password",
      group: "Account & access",
      wired: false,
      placeholders: [
        { key: "email", description: "Email address of the account" },
      ],
    },
    "notification.assigned": {
      key: "notification.assigned",
      label: "Issue assigned",
      group: "Notifications",
      wired: true,
      placeholders: [ACTOR, ISSUE_ID, ISSUE_TITLE],
    },
    "notification.mentioned": {
      key: "notification.mentioned",
      label: "Mention",
      group: "Notifications",
      wired: true,
      placeholders: [
        ACTOR,
        ISSUE_ID,
        ISSUE_TITLE,
        { key: "text", description: "Preview of the mention" },
      ],
    },
    "notification.comment": {
      key: "notification.comment",
      label: "New comment",
      group: "Notifications",
      wired: true,
      placeholders: [
        ACTOR,
        ISSUE_ID,
        ISSUE_TITLE,
        { key: "text", description: "Comment preview" },
      ],
    },
    "notification.commentReply": {
      key: "notification.commentReply",
      label: "Reply to your comment",
      group: "Notifications",
      wired: true,
      placeholders: [
        ACTOR,
        ISSUE_ID,
        ISSUE_TITLE,
        { key: "text", description: "Preview of the reply" },
      ],
    },
    "notification.status": {
      key: "notification.status",
      label: "Status change",
      group: "Notifications",
      wired: true,
      placeholders: [
        ACTOR,
        ISSUE_ID,
        ISSUE_TITLE,
        { key: "text", description: "New status (raw key)" },
      ],
    },
    "notification.invite": {
      key: "notification.invite",
      label: "Membership (existing account)",
      group: "Notifications",
      wired: true,
      placeholders: [
        ACTOR,
        WORKSPACE,
        PROJECT,
        { key: "text", description: "Role granted" },
      ],
    },
    "notification.role": {
      key: "notification.role",
      label: "Role change",
      group: "Notifications",
      wired: true,
      placeholders: [
        ACTOR,
        WORKSPACE,
        PROJECT,
        { key: "text", description: "New role" },
      ],
    },
    "notification.issueShared": {
      key: "notification.issueShared",
      label: "Issue shared",
      group: "Notifications",
      wired: true,
      placeholders: [
        ACTOR,
        ISSUE_ID,
        ISSUE_TITLE,
        { key: "text", description: "Personal message (optional)" },
      ],
    },
    weeklyDigest: {
      key: "weeklyDigest",
      label: "Weekly summary",
      group: "Summaries",
      wired: false,
      placeholders: [
        { key: "firstName", description: "First name" },
        WORKSPACE,
        { key: "periodLabel", description: 'Time period, e.g. "Jan 13–19"' },
        { key: "completedCount", description: "Number completed" },
        { key: "assignedOpenCount", description: "Number open and assigned" },
        { key: "createdCount", description: "Number newly created" },
      ],
    },
    issueUpdate: {
      key: "issueUpdate",
      label: "Issue batch update",
      group: "Notifications",
      wired: false,
      placeholders: [ACTOR, ISSUE_ID, ISSUE_TITLE],
    },
    issueShare: {
      key: "issueShare",
      label: "Public link via email",
      group: "Notifications",
      wired: true,
      placeholders: [
        ACTOR,
        ISSUE_ID,
        ISSUE_TITLE,
        { key: "text", description: "Personal message (optional)" },
      ],
    },
    webhookDisabled: {
      key: "webhookDisabled",
      label: "Webhook turned off",
      group: "Account & access",
      wired: true,
      placeholders: [
        WORKSPACE,
        { key: "url", description: "The webhook's address" },
      ],
    },
  };

export function mailTemplateMeta(key: MailTemplateKey): MailTemplateMeta {
  return MAIL_TEMPLATE_CATALOG[key];
}
