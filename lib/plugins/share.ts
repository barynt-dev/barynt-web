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
 * A plain link for a website: the plugin's name, opening `url` in a new
 * tab. No styling — the site's own look applies — and nothing to load.
 * Everything that comes from a manifest is escaped.
 */
export function embedHtml({ url, name }: { url: string; name: string }) {
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)}</a>`;
}
