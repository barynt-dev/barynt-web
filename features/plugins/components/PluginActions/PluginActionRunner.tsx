"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { parseActionResult } from "@/lib/plugins/plugin-actions";
import { useUI } from "@/lib/ui-store";
import { focusPanelNext } from "../PluginBadges/panelFocus";
import { PluginFrame } from "../PluginFrame/PluginFrame";
import styles from "./pluginActions.module.scss";
import { type ActionJob, actionJobs, finishPluginAction } from "./runner";

/** How long an action may take before Barynt gives up on it. */
const ACTION_TIMEOUT_MS = 20_000;

/**
 * Runs the plugins' actions (BARY-152): a hidden frame per running action
 * — the plugin's code, its bridge, its checks — that's gone again once it
 * answered. The answer becomes a toast; `refresh` loads the page's data
 * again, `openPanel` brings the plugin's panel into view. Mounted once, in
 * the app shell.
 */
export function PluginActionRunner() {
  const jobs = useSyncExternalStore(
    actionJobs.subscribe,
    actionJobs.get,
    actionJobs.server,
  );
  return (
    <div className={styles.runner} aria-hidden>
      {jobs.map((job) => (
        <ActionFrame key={job.key} job={job} />
      ))}
    </div>
  );
}

function ActionFrame({ job }: { job: ActionJob }) {
  const t = useTranslations("plugins");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useUI();
  const { entry } = job;
  // Once per job: a new object would send it again.
  const request = useMemo(
    () => ({ seq: job.key, actionId: entry.actionId, issueId: job.issueId }),
    [job.key, entry.actionId, job.issueId],
  );

  const fail = useCallback(
    (detail: string) => {
      toast(t("actionFailed", { name: entry.pluginName, detail }));
      finishPluginAction(job.key);
    },
    [entry.pluginName, job.key, t, toast],
  );

  useEffect(() => {
    const timer = window.setTimeout(
      () => fail(t("actionTimeout")),
      ACTION_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [fail, t]);

  return (
    <PluginFrame
      pluginId={entry.pluginId}
      name={entry.pluginName}
      headless
      context={{
        slot: { kind: "actions", id: "actions" },
        workspaceId: job.workspaceId,
        projectId: job.projectId,
        ...(job.issueId && { issueId: job.issueId }),
        locale,
      }}
      actionRequest={request}
      onError={fail}
      onActionDone={(seq, ok, raw) => {
        if (seq !== job.key) return;
        if (!ok) return fail(String(raw));
        const result = parseActionResult(raw);
        toast(result.message ?? t("actionDone", { name: entry.title }));
        if (result.openPanel && job.issueId) {
          focusPanelNext({
            issueId: job.issueId,
            pluginId: entry.pluginId,
            panelId: result.openPanel,
          });
          window.dispatchEvent(new Event("barynt:focus-panel"));
        }
        if (result.refresh) router.refresh();
        finishPluginAction(job.key);
      }}
    />
  );
}
