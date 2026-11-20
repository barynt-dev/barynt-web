import { escapeHtml } from "@/lib/mail/templates/html";

// Sharing a plugin's page (BARY-237): the addresses of the networks' share
// pages and the HTML to put it on a website. Pure — no browser, no Barynt.

/** The networks a company shares on, in the order they're shown. Instagram
 *  and TikTok have no web address to share to. */
export const SHARE_NETWORKS = [
  "linkedin",
  "x",
  "facebook",
  "whatsapp",
  "telegram",
  "reddit",
  "xing",
  "bluesky",
] as const;
export type ShareNetwork = (typeof SHARE_NETWORKS)[number];

/** Their own names, the same in every language. */
export const SHARE_NAMES: Record<ShareNetwork, string> = {
  linkedin: "LinkedIn",
  x: "X",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  reddit: "Reddit",
  xing: "XING",
  bluesky: "Bluesky",
};

/** What goes along with the address, where a network takes text: short
 *  enough for X (280 characters, the address counting 23) and Bluesky
 *  (300, the address counting in full). */
export function shareText(name: string, description: string, max = 160) {
  const full = `${name} – ${description}`.replace(/\s+/g, " ").trim();
  return full.length <= max ? full : `${full.slice(0, max - 1).trimEnd()}…`;
}

/** The page of `network` that shares `url` — opened in a new tab. */
export function shareUrl(
  network: ShareNetwork,
  { url, text, title }: { url: string; text: string; title: string },
): string {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  switch (network) {
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case "x":
      return `https://x.com/intent/post?url=${u}&text=${t}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
    case "telegram":
      return `https://t.me/share/url?url=${u}&text=${t}`;
    case "reddit":
      return `https://www.reddit.com/submit?url=${u}&title=${encodeURIComponent(title)}`;
    case "xing":
      return `https://www.xing.com/spi/shares/new?url=${u}`;
    case "bluesky":
      return `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text} ${url}`)}`;
  }
}

/**
 * A link card for a website: the plugin's name and description in a box
 * that opens `url`. Plain HTML with inline styles, nothing to load — no
 * script, no frame, no picture from Barynt (which only signed-in people
 * can reach). Everything that comes from a manifest is escaped.
 */
export function embedHtml({
  url,
  name,
  description,
  cta,
}: {
  url: string;
  name: string;
  description: string;
  /** The line at the foot of the card: "View plugin". */
  cta: string;
}): string {
  const font = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
  return [
    `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="display:block;max-width:420px;padding:16px 18px;border:1px solid #d0d5dd;border-radius:12px;background:#ffffff;color:#101828;font-family:${font};text-decoration:none">`,
    `  <strong style="display:block;margin-bottom:4px;font-size:16px">${escapeHtml(name)}</strong>`,
    `  <span style="display:block;font-size:14px;line-height:1.5;color:#475467">${escapeHtml(description)}</span>`,
    `  <span style="display:block;margin-top:10px;font-size:13px;font-weight:600;color:#6941c6">${escapeHtml(cta)} →</span>`,
    "</a>",
  ].join("\n");
}
