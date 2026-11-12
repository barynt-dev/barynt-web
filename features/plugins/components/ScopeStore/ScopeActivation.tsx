"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { useConfirm } from "@/components/ui/layout/ConfirmDialog/ConfirmDialog";
import {
  activatePlugin,
  deactivatePlugin,
  deletePluginData,
  type PluginResult,
  setPluginGrant,
} from "@/features/plugins/actions";
import type {
  ScopeActivation as Activation,
  ScopeStorePlugin,
  ScopeStoreView,
} from "@/features/plugins/queries";
import { Link } from "@/i18n/navigation";
import { useModal } from "@/lib/context";
import { pluginSettingsPath } from "@/lib/nav";
import { PHONE_QUERY, useMediaQuery } from "@/lib/utils/useMediaQuery";
import { CapabilityCards } from "../PluginStore/capabilities";
import store from "../PluginStore/pluginStore.module.scss";
import styles from "../plugins.module.scss";
import { ErrorLine, PluginDialog, usePluginText } from "../shared";
import scope from "./scopeStore.module.scss";

// Releasing a plugin in a workspace (BARY-201) — the store's one switch, for
// the workspace's managers. "Released" means what the plugin's levels make
// of it: a workspace plugin runs in the workspace, a project plugin shows up
// in every project's settings, where the project switches it on — both, for
// a plugin with both levels. The header has "Release" or "Take back"; a line
// under it says where it's on.

const running = (a: Activation | null | undefined) =>
  a?.state === "active" || a?.state === "needsConfirmation";

/** Released in this workspace: on in the workspace where it has that
 *  level, released for projects where it has that one. */
export function isReleased(p: ScopeStorePlugin): boolean {
  const ws = p.levels.includes("workspace");
  const pr = p.levels.includes("project");
  return (!ws || running(p.workspace)) && (!pr || p.granted);
}

function useReleaseDialog(
  plugin: ScopeStorePlugin,
  view: ScopeStoreView,
  workspaceName: string,
) {
  const text = usePluginText();
  const router = useRouter();
  const { openModal } = useModal();
  const isPhone = useMediaQuery(PHONE_QUERY);
  return () =>
    openModal(
      ({ close }) => (
        <ReleaseDialog
          plugin={plugin}
          view={view}
          workspaceName={workspaceName}
          sheet={isPhone}
          close={close}
          onDone={() => router.refresh()}
        />
      ),
      {
        ...(isPhone ? { placement: "bottom" as const } : {}),
        label: text.t("releaseTitle", { name: plugin.name }),
      },
    );
}

/** "Release" while it isn't, "Take back" once it is. For the header. */
export function ReleaseActions({
  plugin,
  view,
  workspaceName,
}: {
  plugin: ScopeStorePlugin;
  view: ScopeStoreView;
  workspaceName: string;
}) {
  const t = useTranslations();
  const text = usePluginText();
  const router = useRouter();
  const confirm = useConfirm();
  const open = useReleaseDialog(plugin, view, workspaceName);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  if (plugin.blocked) return null;

  const takeBack = async () => {
    const ok = await confirm({
      title: text.t("unreleaseTitle", { name: plugin.name }),
      description: text.t("unreleaseDesc", { name: workspaceName }),
      confirmLabel: text.t("unrelease"),
      cancelLabel: t("actions.cancel"),
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const ids = { pluginId: plugin.pluginId, workspaceId: view.workspaceId };
      const steps: (() => Promise<PluginResult>)[] = [];
      if (plugin.granted)
        steps.push(() => setPluginGrant({ ...ids, granted: false }));
      if (running(plugin.workspace)) steps.push(() => deactivatePlugin(ids));
      for (const step of steps) {
        const result = await step();
        if ("error" in result) {
          setError(text.error(result.error));
          break;
        }
      }
      router.refresh();
    });
  };

  return (
    <div className={store.headActions}>
      {isReleased(plugin) ? (
        <Button
          variant="outline"
          icon={<Icon icon="lucide:circle-off" width={15} />}
          disabled={isPending}
          onClick={takeBack}
        >
          {text.t("unrelease")}
        </Button>
      ) : (
        <Button
          variant="primary"
          icon={<Icon icon="lucide:circle-check" width={15} />}
          onClick={open}
        >
          {text.t("release")}
        </Button>
      )}
      <ErrorLine message={error} />
    </div>
  );
}

/** One line under the header: released or not, its workspace settings, the
 *  projects it's on in (each leading to its page there), and a workspace
 *  activation that waits for a confirmation. */
export function ReleaseSummary({
  plugin,
  view,
  workspaceName,
}: {
  plugin: ScopeStorePlugin;
  view: ScopeStoreView;
  workspaceName: string;
}) {
  const t = useTranslations();
  const text = usePluginText();
  const router = useRouter();
  const confirm = useConfirm();
  const open = useReleaseDialog(plugin, view, workspaceName);
  const [isPending, startTransition] = useTransition();

  if (plugin.blocked)
    return (
      <p className={scope.blocked}>
        <Icon icon="lucide:shield-ban" width={16} aria-hidden />
        {text.t("blockedByAdmin")}
      </p>
    );

  const released = isReleased(plugin);
  const forProjects = plugin.levels.includes("project");
  const projects = view.projects.filter((p) => running(plugin.projects[p.id]));
  const wsWaits = plugin.workspace?.state === "needsConfirmation";
  // Switched off in the workspace with its settings and data kept.
  const wsKept = !released && plugin.workspace?.state === "disabled";

  const removeData = async () => {
    const ok = await confirm({
      title: text.t("deleteDataTitle", { name: plugin.name }),
      description: text.t("deleteDataDesc"),
      confirmLabel: t("actions.delete"),
      cancelLabel: t("actions.cancel"),
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      await deletePluginData({
        pluginId: plugin.pluginId,
        workspaceId: view.workspaceId,
      });
      router.refresh();
    });
  };

  return (
    <section className={scope.summary} aria-label={text.t("releaseState")}>
      <span className={scope.released} data-on={released || undefined}>
        <Icon
          icon={released ? "lucide:circle-check" : "lucide:circle-dashed"}
          width={15}
          aria-hidden
        />
        {released
          ? text.t("releasedIn", { name: workspaceName })
          : text.t("notReleasedIn", { name: workspaceName })}
      </span>
      {released && plugin.workspace?.hasSettings && (
        <Link
          href={pluginSettingsPath(view.workspaceId, null, plugin.pluginId)}
          className={scope.place}
          data-waiting={wsWaits || undefined}
        >
          {text.t("pluginSettings")}
          <Icon icon="lucide:sliders-horizontal" width={12} aria-hidden />
        </Link>
      )}
      {released && forProjects && (
        <>
          <span className={scope.summaryLabel}>
            {projects.length > 0
              ? text.t("onInProjects")
              : text.t("onInNoProject")}
          </span>
          {projects.length > 0 && (
            <span className={scope.places}>
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={pluginSettingsPath(
                    view.workspaceId,
                    p.slug,
                    plugin.pluginId,
                  )}
                  className={scope.place}
                  data-waiting={
                    plugin.projects[p.id]?.state === "needsConfirmation" ||
                    undefined
                  }
                >
                  <span
                    className={scope.dot}
                    // The project's own color — the only dynamic value here.
                    style={{ background: p.color }}
                    aria-hidden
                  />
                  {p.name}
                </Link>
              ))}
            </span>
          )}
        </>
      )}
      {wsWaits && (
        <span className={scope.waiting}>
          <Icon icon="lucide:sparkles" width={14} aria-hidden />
          {text.t("workspaceWaits")}
          <button type="button" className={scope.waitingButton} onClick={open}>
            {text.t("confirmAgain")}
          </button>
        </span>
      )}
      {wsKept && (
        <span className={scope.summaryLabel}>
          {text.t("dataKept")}
          <button
            type="button"
            className={scope.waitingButton}
            disabled={isPending}
            onClick={removeData}
          >
            {text.t("deleteData")}
          </button>
        </span>
      )}
    </section>
  );
}

/**
 * Releasing the plugin in this workspace — or confirming it again in the
 * workspace after an update asked for more. Either way, what it may do is
 * confirmed once here; each project confirms again when it switches it on.
 */
function ReleaseDialog({
  plugin,
  view,
  workspaceName,
  sheet,
  close,
  onDone,
}: {
  plugin: ScopeStorePlugin;
  view: ScopeStoreView;
  workspaceName: string;
  sheet: boolean;
  close: () => void;
  onDone: () => void;
}) {
  const t = useTranslations();
  const text = usePluginText();
  const forWorkspace = plugin.levels.includes("workspace");
  const forProjects = plugin.levels.includes("project");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const wsOn =
    forWorkspace &&
    (!running(plugin.workspace) ||
      plugin.workspace?.state === "needsConfirmation");
  const grantOn = forProjects && !plugin.granted;

  const save = () =>
    startTransition(async () => {
      const ids = { pluginId: plugin.pluginId, workspaceId: view.workspaceId };
      const steps: (() => Promise<PluginResult>)[] = [];
      if (wsOn)
        steps.push(() =>
          activatePlugin({ ...ids, capabilities: plugin.capabilities }),
        );
      if (grantOn) steps.push(() => setPluginGrant({ ...ids, granted: true }));
      for (const step of steps) {
        const result = await step();
        if ("error" in result) {
          onDone();
          return setError(text.error(result.error));
        }
      }
      onDone();
      close();
    });

  return (
    <PluginDialog
      title={text.t("releaseTitle", { name: plugin.name })}
      sheet={sheet}
      close={close}
      footer={
        <>
          {!sheet && (
            <Button variant="ghost" onClick={close} disabled={isPending}>
              {t("actions.cancel")}
            </Button>
          )}
          <Button
            variant="primary"
            disabled={!confirmed || isPending}
            onClick={save}
          >
            {isReleased(plugin) ? text.t("confirmAgain") : text.t("release")}
          </Button>
        </>
      }
    >
      <p className={scope.releaseHint}>
        <Icon icon="lucide:building-2" width={16} aria-hidden />
        {text.t(
          forWorkspace && forProjects
            ? "releaseHintBoth"
            : forWorkspace
              ? "releaseHintWorkspace"
              : "releaseHintProjects",
          { name: workspaceName },
        )}
      </p>
      <header className={store.capHead}>
        <h3>{text.t("releaseMay")}</h3>
      </header>
      <CapabilityCards
        capabilities={plugin.capabilities}
        network={plugin.network}
      />
      <label className={styles.confirm}>
        <input
          type="checkbox"
          checked={confirmed}
          disabled={isPending}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>{text.t("releaseConfirm", { name: workspaceName })}</span>
      </label>
      <ErrorLine message={error} />
    </PluginDialog>
  );
}
