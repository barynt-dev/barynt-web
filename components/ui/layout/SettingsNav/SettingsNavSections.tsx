"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/atoms/Input/Input";
import { NavLink } from "@/components/ui/layout/NavLink/NavLink";
import { KeyboardOnly } from "./KeyboardOnly";
import type { SettingsNavItem } from "./SettingsNav";
import styles from "./settingsNav.module.scss";
import { type SettingsNavSection, searchSections } from "./settingsSearch";
import { OPEN_PARAM } from "./settingsView";

/**
 * The settings nav's sections with a search above them (BARY-201): typing
 * narrows the rows to the ones whose name — or what's on their page
 * (`keywords`) — matches, Enter opens the first. Each heading folds its list
 * away (a native `<details>`); while searching, every hit is shown open.
 */
export function SettingsNavSections({
  sections,
  basePath,
  searchLabel,
  emptyLabel,
}: {
  sections: SettingsNavSection[];
  basePath: string;
  searchLabel: string;
  emptyLabel: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const searching = query.trim() !== "";
  const shown = searchSections(sections, query);
  const hrefOf = (item: SettingsNavItem) =>
    item.href === basePath ? `${item.href}?${OPEN_PARAM}=1` : item.href;

  return (
    <>
      <Input
        variant="search"
        className={styles.search}
        placeholder={searchLabel}
        aria-label={searchLabel}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setQuery("");
          const first = shown[0]?.items[0];
          if (e.key === "Enter" && first) {
            e.preventDefault();
            router.push(hrefOf(first));
          }
        }}
      />
      {searching && shown.length === 0 && (
        <p className={styles.noHits}>{emptyLabel}</p>
      )}
      {shown.map((section, i) => (
        <details
          // A fresh element per search state: a search shows every hit
          // open, even in a section folded away before.
          key={`${section.title}${searching ? ":search" : ""}`}
          className={`${styles.section}${i > 0 ? ` ${styles.group}` : ""}`}
          open
        >
          <summary className={styles.title}>
            {section.title}
            <Icon
              icon="lucide:chevron-down"
              width={14}
              className={styles.fold}
              aria-hidden
            />
          </summary>
          <ul className={styles.list}>
            {section.items.map((item) => {
              const row = (
                <li key={item.href}>
                  <NavLink
                    href={hrefOf(item)}
                    activeHref={item.href}
                    icon={item.icon}
                    leading={item.leading}
                    label={item.label}
                  />
                </li>
              );
              return item.needsKeyboard ? (
                <KeyboardOnly key={item.href}>{row}</KeyboardOnly>
              ) : (
                row
              );
            })}
          </ul>
        </details>
      ))}
    </>
  );
}
