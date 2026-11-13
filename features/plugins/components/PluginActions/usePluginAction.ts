"use client";

import { useTranslations } from "next-intl";
import { useConfirm } from "@/components/ui/layout/ConfirmDialog/ConfirmDialog";
import type { PluginActionEntry } from "@/lib/plugins/plugin-actions";
import { startPluginAction } from "./runner";

/** Starts a plugin's action for an issue — asking first where the plugin
 *  says so (BARY-152). */
export function usePluginAction() {
  const t = useTranslations();
  const confirm = useConfirm();
  return async (
    entry: PluginActionEntry,
    target: { issueId: string | null; workspaceId: string; projectId: string },
  ) => {
    if (entry.confirm) {
      const ok = await confirm({
        title: entry.title,
        description: entry.confirm,
        confirmLabel: entry.title,
        cancelLabel: t("actions.cancel"),
        danger: entry.danger,
        always: true,
      });
      if (!ok) return;
    }
    startPluginAction({ entry, ...target });
  };
}
