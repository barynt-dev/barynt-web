import { escapeHtml, formatDate } from "@/lib/mail/templates/html";
import { renderDetailTable, renderLayout } from "@/lib/mail/templates/layout";
import {
  resolveText,
  type TemplateOverride,
} from "@/lib/mail/templates/override";
import type { MailContent } from "@/lib/mail/templates/types";

export interface WebhookDisabledEmailInput {
  to: string;
  workspaceName: string;
  /** The webhook's address. */
  url: string;
  /** Since when every delivery failed. */
  failingSince: Date;
  /** The last thing the receiver answered: a status or an error. */
  lastResult: string;
  /** The workspace's webhook settings. */
  settingsUrl: string;
}

/** For a webhook Barynt turned off after a day of failed deliveries
 *  (BARY-211) — to whoever created it. */
export function webhookDisabledEmail(
  input: WebhookDisabledEmailInput,
  override?: TemplateOverride,
): MailContent {
  const placeholders = {
    workspaceName: input.workspaceName,
    url: input.url,
  };
  const subject = resolveText(
    `A webhook in ${input.workspaceName} was turned off`,
    override?.subject,
    placeholders,
  );
  const heading = resolveText(
    "Webhook turned off",
    override?.heading,
    placeholders,
  );
  const introText = resolveText(
    `Every delivery to ${input.url} has failed for a day, so Barynt stopped sending to it. Fix the receiver, then turn the webhook on again in the settings. Events from the time it was off are not sent.`,
    override?.bodyText,
    placeholders,
  );
  const rows = [
    { label: "Workspace", value: input.workspaceName },
    { label: "Address", value: input.url },
    { label: "Failing since", value: formatDate(input.failingSince) },
    { label: "Last result", value: input.lastResult },
  ];
  const html = renderLayout({
    preheader: introText,
    heading: escapeHtml(heading),
    bodyHtml: `<p style="margin: 0;">${escapeHtml(introText)}</p>${renderDetailTable(
      rows.map((r) => ({ label: r.label, value: escapeHtml(r.value) })),
    )}`,
    ctaLabel: "Open webhooks",
    ctaUrl: input.settingsUrl,
    recipientEmail: input.to,
  });
  const text = [
    heading,
    "",
    introText,
    "",
    ...rows.map((r) => `${r.label}: ${r.value}`),
    "",
    input.settingsUrl,
  ].join("\n");
  return { subject, html, text };
}
