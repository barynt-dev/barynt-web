"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useChoose } from "@/components/ui/layout/ChoiceDialog/ChoiceDialog";
import { useForm } from "@/components/ui/layout/FormDialog/FormDialog";
import { parseActionResult } from "@/lib/plugins/plugin-actions";
import { useUI } from "@/lib/ui-store";
import { focusPanelNext } from "../PluginBadges/panelFocus";
import { PluginFrame } from "../PluginFrame/PluginFrame";
import styles from "./pluginActions.module.scss";
import {
  type ActionJob,
  actionJobs,
  finishPluginAction,
  startPluginAction,
} from "./runner";

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
  const choose = useChoose();
  const ask = useForm();
  const { entry } = job;
  // Once per job: a new object would send it again.
  const request = useMemo(
    () => ({
      seq: job.key,
      actionId: entry.actionId,
      issueId: job.issueId,
      ...(job.choice !== undefined && { choice: job.choice }),
      ...(job.values !== undefined && { values: job.values }),
    }),
    [job.key, entry.actionId, job.issueId, job.choice, job.values],
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
        // It asks first (BARY-238): the options, then the action again with
        // the one picked — nothing, when the dialog is dismissed.
        if (result.pick) {
          const pick = result.pick;
          finishPluginAction(job.key);
          void choose({
            title: pick.title,
            choices: pick.options,
            ...(pick.icon && { icon: pick.icon }),
            cancelLabel: t("actionCancel"),
          }).then((choice) => {
            if (choice === null) return;
            const { key: _key, ...rest } = job;
            startPluginAction({ ...rest, choice });
          });
          return;
        }
        // A form first (BARY-238): filled in, the action again with what
        // was filled in — its choice kept.
        if (result.form) {
          const form = result.form;
          finishPluginAction(job.key);
          void ask({
            title: form.title,
            description: form.description,
            fields: form.fields,
            submitLabel: form.submitLabel ?? entry.title,
            cancelLabel: t("actionCancel"),
            danger: form.danger,
          }).then((values) => {
            if (values === null) return;
            const { key: _key, ...rest } = job;
            startPluginAction({ ...rest, values });
          });
          return;
        }
        // Done here, not in its frame: a hidden, sandboxed frame can neither
        // write the clipboard nor open a tab (BARY-230).
        if (result.copy) void navigator.clipboard?.writeText(result.copy);
        if (result.open)
          window.open(result.open, "_blank", "noopener,noreferrer");
        toast(
          result.message ??
            (result.copy
              ? t("actionCopied")
              : t("actionDone", { name: entry.title })),
        );
        if (result.openPanel && job.issueId) {
          focusPanelNext({
            issueId: job.issueId,
            pluginId: entry.pluginId,
            panelId: result.openPanel,
          });
          window.dispatchEvent(new Event("barynt:focus-panel"));
        }
        if (result.refresh) {
          router.refresh();
          // Its panels in the issue draw again too (BARY-238).
          window.dispatchEvent(
            new CustomEvent("barynt:plugin-refresh", {
              detail: { pluginId: entry.pluginId, issueId: job.issueId },
            }),
          );
        }
        finishPluginAction(job.key);
      }}
    />
  );
}
