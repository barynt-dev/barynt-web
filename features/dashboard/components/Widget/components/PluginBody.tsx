"use client";

import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import type { WidgetData } from "@/features/dashboard/types";
import { PluginFrame } from "@/features/plugins/components/PluginFrame/PluginFrame";
import styles from "../widget.module.scss";

/**
 * A plugin's widget (BARY-149): its own frame, filling the widget — the
 * sandbox, bridge and checks of every plugin (`PluginFrame`). While the
 * plugin doesn't run here anymore, a note instead of an empty box.
 */
export function PluginBody({
  data,
}: {
  data: Extract<WidgetData, { type: "plugin" }>;
}) {
  const t = useTranslations("widgets");
  const locale = useLocale();
  if (!data.plugin)
    return (
      <div className={styles.pluginOff}>
        <Icon icon="lucide:puzzle" width={18} aria-hidden />
        <strong>{t("pluginOff", { name: data.pluginId })}</strong>
        <span>{t("pluginOffHint")}</span>
      </div>
    );
  return (
    <div className={styles.pluginBody}>
      <PluginFrame
        pluginId={data.pluginId}
        name={data.plugin.name}
        context={{
          slot: { kind: "widget", id: data.widgetId },
          workspaceId: data.workspaceId,
          projectId: data.projectId,
          locale,
        }}
      />
    </div>
  );
}
