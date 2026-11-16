"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Tab, Tabs } from "@/components/ui/layout/Tabs/Tabs";
import styles from "./membersTabs.module.scss";

/**
 * People and apps (BARY-213): a workspace's members, and the bots its
 * plugins act as — apart, since a bot is no member. Links, so each list
 * has its own address (`?tab=apps`).
 */
export function MembersTabs({
  base,
  current,
  apps,
}: {
  /** The members page's path. */
  base: string;
  current: "people" | "apps";
  /** How many apps there are — the tab is left out without any. */
  apps: number;
}) {
  const t = useTranslations("workspaceMembers");
  if (apps === 0 && current === "people") return null;
  return (
    <Tabs label={t("tabsLabel")} className={styles.tabs}>
      <Tab
        href={base}
        active={current === "people"}
        icon={<Icon icon="lucide:users" width={15} />}
      >
        {t("tabPeople")}
      </Tab>
      <Tab
        href={`${base}?tab=apps`}
        active={current === "apps"}
        icon={<Icon icon="lucide:bot" width={15} />}
      >
        {t("tabApps")}
        <span className={styles.count}>{apps}</span>
      </Tab>
    </Tabs>
  );
}
