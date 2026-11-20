"use client";

import { Icon } from "@iconify/react";
import { RichText } from "@/components/ui/atoms/RichText/RichText";
import type { PluginLink, PluginLinkKind } from "@/lib/plugins/manifest";
import type { PMDoc } from "@/lib/richtext/types";
import { usePluginText } from "../shared";
import styles from "./pluginStore.module.scss";

/**
 * "About …" on a plugin's page (BARY-237): its page text when it has one —
 * Markdown, already stripped of links and images (`lib/plugins/about`) —
 * else its short description.
 */
export function PluginAbout({
  name,
  description,
  about,
}: {
  name: string;
  description: string;
  about: PMDoc | null;
}) {
  const text = usePluginText();
  return (
    <section className={styles.about}>
      <h3>{text.t("aboutPlugin", { name })}</h3>
      {about ? (
        <div className={styles.aboutText}>
          <RichText value={about} />
        </div>
      ) : (
        <p>{description}</p>
      )}
    </section>
  );
}

const ICONS: Record<PluginLinkKind, string> = {
  homepage: "lucide:house",
  docs: "lucide:book-open",
  changelog: "lucide:history",
  issues: "lucide:bug",
  support: "lucide:life-buoy",
  privacy: "lucide:shield-check",
  terms: "lucide:scroll-text",
  github: "mdi:github",
  gitlab: "mdi:gitlab",
  discord: "mdi:discord",
  slack: "mdi:slack",
  matrix: "mdi:matrix",
  mastodon: "mdi:mastodon",
  bluesky: "logos:bluesky",
  x: "logos:x",
  youtube: "mdi:youtube",
  linkedin: "mdi:linkedin",
};

/** The brands' own names, the same in every language. */
const BRANDS: Partial<Record<PluginLinkKind, string>> = {
  github: "GitHub",
  gitlab: "GitLab",
  discord: "Discord",
  slack: "Slack",
  matrix: "Matrix",
  mastodon: "Mastodon",
  bluesky: "Bluesky",
  x: "X",
  youtube: "YouTube",
  linkedin: "LinkedIn",
};

const host = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/**
 * Where the plugin points to (BARY-237): its homepage, docs and the like as
 * a list; its community and code as centered icon buttons below — or, one
 * or two of them, in the list as well. Nothing without links.
 */
export function PluginLinks({ links }: { links: PluginLink[] }) {
  const text = usePluginText();
  if (links.length === 0) return null;
  // Brands are a row of icon buttons — from three on. One or two are links
  // in the list like the rest, with their name.
  const brandCount = links.filter((l) => l.kind in BRANDS).length;
  const asIcon = (l: PluginLink) => brandCount > 2 && l.kind in BRANDS;
  const labelled = links.filter((l) => !asIcon(l));
  const brands = links.filter(asIcon);
  const label = (l: PluginLink) =>
    l.title ?? BRANDS[l.kind] ?? text.t(`link.${l.kind}` as "link.homepage");

  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>
        <Icon icon="lucide:link" width={14} aria-hidden />
        {text.t("links")}
      </h3>
      {labelled.length > 0 && (
        <ul className={styles.linkList}>
          {labelled.map((l) => (
            <li key={l.url}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                <Icon icon={ICONS[l.kind]} width={16} aria-hidden />
                <span className={styles.linkText}>
                  <span>{label(l)}</span>
                  <span className={styles.linkHost}>{host(l.url)}</span>
                </span>
                <Icon
                  icon="lucide:arrow-up-right"
                  width={14}
                  className={styles.linkOut}
                  aria-hidden
                />
              </a>
            </li>
          ))}
        </ul>
      )}
      {brands.length > 0 && (
        <ul className={styles.brandLinks}>
          {brands.map((l) => (
            <li key={l.url}>
              <a
                className={styles.brandLink}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                aria-label={label(l)}
                title={`${label(l)} · ${host(l.url)}`}
              >
                <Icon icon={ICONS[l.kind]} width={18} aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
