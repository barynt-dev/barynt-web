"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import {
  type SettingsNavSubject,
  SettingsSubjectMenu,
} from "@/components/ui/layout/SettingsNav/SettingsSubjectMenu";
import { Tab, Tabs } from "@/components/ui/layout/Tabs/Tabs";
import styles from "./pluginLevels.module.scss";

export type PluginLevelKey = "personal" | "project" | "workspace";

export interface PluginLevelTab {
  key: PluginLevelKey;
  href: string;
}

const ICON: Record<PluginLevelKey, string> = {
  personal: "lucide:circle-user",
  project: "lucide:folders",
  workspace: "lucide:building-2",
};

/**
 * A plugin's levels (BARY-238) under its header: for you, in a project, in
 * the workspace — only those it has here — and, on the right, which
 * project or workspace the open one is. Tabs and picker are links, so each
 * level has its own address.
 */
export function PluginLevels({
  levels,
  active,
  subject,
}: {
  levels: PluginLevelTab[];
  active: PluginLevelKey;
  /** The open project or workspace, and the others to switch to. */
  subject?: {
    name: string;
    color: string;
    image?: string;
    siblings: SettingsNavSubject[];
  };
}) {
  const t = useTranslations("plugins.area");
  return (
    <div className={styles.bar}>
      <Tabs label={t("levels")} className={styles.tabs}>
        {levels.map((level) => (
          <Tab
            key={level.key}
            href={level.href}
            active={level.key === active}
            icon={<Icon icon={ICON[level.key]} width={15} />}
          >
            {t(level.key)}
          </Tab>
        ))}
      </Tabs>
      {subject && subject.siblings.length > 1 && (
        <div className={styles.picker}>
          <SettingsSubjectMenu
            name={subject.name}
            color={subject.color}
            image={subject.image}
            siblings={subject.siblings}
            label={active === "project" ? t("pickProject") : t("pickWorkspace")}
          />
        </div>
      )}
    </div>
  );
}
