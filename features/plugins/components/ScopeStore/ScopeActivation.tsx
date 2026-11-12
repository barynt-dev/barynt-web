"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Switch } from "@/components/ui/atoms/Switch/Switch";
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
  ScopeStoreProject,
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

// Where a plugin is on in this workspace, and the switches to change it
// (BARY-201): the workspace itself, the release for its projects, and each
// project the person may manage.

type Target =
  | { kind: "workspace"; name: string }
  | { kind: "project"; project: ScopeStoreProject };

export function ScopeActivation({
  plugin,
  workspaceId,
  workspaceName,
  canWorkspace,
  projects,
}: {
  plugin: ScopeStorePlugin;
  workspaceId: string;
  workspaceName: string;
  canWorkspace: boolean;
  projects: ScopeStoreProject[];
}) {
  const t = useTranslations();
  const text = usePluginText();
  const router = useRouter();
  const confirm = useConfirm();
  const { openModal } = useModal();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const forWorkspace = plugin.levels.includes("workspace");
  const forProjects = plugin.levels.includes("project");

  const run = (action: () => Promise<PluginResult>) =>
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setError(text.error(result.error));
      else {
        setError("");
        router.refresh();
      }
    });

  const projectIdOf = (target: Target) =>
    target.kind === "project" ? target.project.id : null;

  const switchOn = (target: Target, again: boolean) =>
    openModal(
      ({ close }) => (
        <ActivateDialog
          plugin={plugin}
          target={target}
          again={again}
          pending={
            (target.kind === "workspace"
              ? plugin.workspace
              : plugin.projects[target.project.id]
            )?.pending ?? []
          }
          sheet={isPhone}
          close={close}
          onDone={() => router.refresh()}
          workspaceId={workspaceId}
        />
      ),
      {
        ...(isPhone ? { placement: "bottom" as const } : {}),
        label: text.t("activateTitle", { name: plugin.name }),
      },
    );

  const switchOff = (target: Target) =>
    run(() =>
      deactivatePlugin({
        pluginId: plugin.pluginId,
        workspaceId,
        projectId: projectIdOf(target),
      }),
    );

  const removeData = async (target: Target) => {
    const ok = await confirm({
      title: text.t("deleteDataTitle", { name: plugin.name }),
      description: text.t("deleteDataDesc"),
      confirmLabel: t("actions.delete"),
      cancelLabel: t("actions.cancel"),
      danger: true,
    });
    if (ok)
      run(() =>
        deletePluginData({
          pluginId: plugin.pluginId,
          workspaceId,
          projectId: projectIdOf(target),
        }),
      );
  };

  const projectsOn = Object.values(plugin.projects).filter(
    (a) => a.state === "active" || a.state === "needsConfirmation",
  ).length;
  const grant = async (granted: boolean) => {
    if (!granted && projectsOn > 0) {
      const ok = await confirm({
        title: text.t("revokeGrantTitle", { name: plugin.name }),
        description: text.t("revokeGrantDesc", { count: projectsOn }),
        confirmLabel: text.t("revokeGrant"),
        cancelLabel: t("actions.cancel"),
        danger: true,
      });
      if (!ok) return;
    }
    run(() =>
      setPluginGrant({ pluginId: plugin.pluginId, workspaceId, granted }),
    );
  };

  const row = (
    target: Target,
    activation: Activation | null,
    allowed: boolean,
    hint: string | null,
  ) => {
    const key = target.kind === "workspace" ? "workspace" : target.project.id;
    const name =
      target.kind === "workspace" ? target.name : target.project.name;
    const settingsHref =
      activation?.hasSettings && activation.state !== "notInstalled"
        ? pluginSettingsPath(
            workspaceId,
            target.kind === "project" ? target.project.slug : null,
            plugin.pluginId,
          )
        : null;
    const state = activation?.state ?? "off";
    return (
      <li key={key} className={scope.row}>
        <span className={scope.rowName}>
          {target.kind === "workspace" ? (
            <Icon icon="lucide:building-2" width={16} aria-hidden />
          ) : (
            <span
              className={scope.dot}
              // The project's own color — the only dynamic value here.
              style={{ background: target.project.color }}
              aria-hidden
            />
          )}
          <span>{name}</span>
        </span>
        <span className={scope.rowState} data-state={state}>
          {text.t(`scopeState.${state}` as "scopeState.off")}
        </span>
        <span className={scope.rowActions}>
          {hint ? (
            <span className={store.muted}>{hint}</span>
          ) : !allowed ? null : plugin.blocked ? (
            activation && (
              <Button
                variant="text"
                size="sm"
                icon={<Icon icon="lucide:trash-2" width={14} />}
                disabled={isPending}
                onClick={() => removeData(target)}
              >
                {text.t("deleteData")}
              </Button>
            )
          ) : (
            <>
              {settingsHref && (
                <Link href={settingsHref} className={scope.settingsLink}>
                  <Icon
                    icon="lucide:sliders-horizontal"
                    width={14}
                    aria-hidden
                  />
                  {text.t("pluginSettings")}
                </Link>
              )}
              {state === "needsConfirmation" && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isPending}
                  onClick={() => switchOn(target, true)}
                >
                  {text.t("confirmAgain")}
                </Button>
              )}
              {state === "active" || state === "needsConfirmation" ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => switchOff(target)}
                >
                  {text.t("switchOff")}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Icon icon="lucide:power" width={14} />}
                  disabled={isPending}
                  onClick={() => switchOn(target, false)}
                >
                  {state === "disabled"
                    ? text.t("switchOnAgain")
                    : text.t("activate")}
                </Button>
              )}
              {state === "disabled" && (
                <Button
                  variant="text"
                  size="sm"
                  className={store.dangerIcon}
                  icon={<Icon icon="lucide:trash-2" width={14} />}
                  aria-label={text.t("deleteData")}
                  title={text.t("deleteData")}
                  disabled={isPending}
                  onClick={() => removeData(target)}
                />
              )}
            </>
          )}
        </span>
      </li>
    );
  };

  return (
    <section className={scope.card} aria-labelledby="scope-activation">
      <h3 id="scope-activation" className={store.cardTitle}>
        <Icon icon="lucide:power" width={14} aria-hidden />
        {text.t("switchOnHere")}
      </h3>
      {plugin.blocked && (
        <p className={scope.blocked}>
          <Icon icon="lucide:shield-ban" width={16} aria-hidden />
          {text.t("blockedByAdmin")}
        </p>
      )}
      <ErrorLine message={error} />

      {forWorkspace && (
        <ul className={scope.rows}>
          {row(
            { kind: "workspace", name: workspaceName },
            plugin.workspace,
            canWorkspace,
            canWorkspace ? null : text.t("onlyWorkspaceAdmins"),
          )}
        </ul>
      )}

      {forProjects && (
        <>
          {canWorkspace && (
            <div className={scope.grant}>
              <Switch
                id={`grant-${plugin.pluginId}`}
                label={text.t("grantLabel", { name: plugin.name })}
                checked={plugin.granted}
                disabled={isPending || plugin.blocked}
                onChange={grant}
              />
              <span className={store.muted}>{text.t("grantHint")}</span>
            </div>
          )}
          {projects.length > 0 && (
            <>
              <p className={scope.subhead}>{text.t("projectsHeading")}</p>
              <ul className={scope.rows}>
                {projects.map((project) =>
                  row(
                    { kind: "project", project },
                    plugin.projects[project.id] ?? null,
                    true,
                    plugin.granted || plugin.projects[project.id]
                      ? null
                      : text.t("notGrantedYet"),
                  ),
                )}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}

/** Switching it on — or confirming again after an update asked for more:
 *  what it may do there, and a box to tick. */
function ActivateDialog({
  plugin,
  target,
  again,
  pending,
  workspaceId,
  sheet,
  close,
  onDone,
}: {
  plugin: ScopeStorePlugin;
  target: Target;
  again: boolean;
  pending: string[];
  workspaceId: string;
  sheet: boolean;
  close: () => void;
  onDone: () => void;
}) {
  const t = useTranslations();
  const text = usePluginText();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const inProject = target.kind === "project";

  const activate = () =>
    startTransition(async () => {
      const result = await activatePlugin({
        pluginId: plugin.pluginId,
        workspaceId,
        projectId: inProject ? target.project.id : null,
        capabilities: plugin.capabilities,
      });
      if ("error" in result) return setError(text.error(result.error));
      onDone();
      close();
    });

  return (
    <PluginDialog
      title={
        again
          ? text.t("reconfirmTitle", { name: plugin.name })
          : text.t("activateTitle", { name: plugin.name })
      }
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
            onClick={activate}
          >
            {again ? text.t("confirmAgain") : text.t("activate")}
          </Button>
        </>
      }
    >
      <p className={scope.where}>
        <Icon
          icon={inProject ? "lucide:folder" : "lucide:building-2"}
          width={16}
          aria-hidden
        />
        {inProject
          ? text.t("inProject", { name: target.project.name })
          : text.t("inWorkspace", { name: target.name })}
      </p>
      {again && (
        <p className={styles.notice}>
          {text.t("updateAsksMore")}
          {pending.length > 0 && (
            <>
              {" "}
              <strong>{pending.map(text.capability).join(", ")}</strong>
            </>
          )}
        </p>
      )}
      <header className={store.capHead}>
        <h3>{inProject ? text.t("mayInProject") : text.t("mayInWorkspace")}</h3>
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
        <span>
          {inProject ? text.t("confirmProject") : text.t("confirmWorkspace")}
        </span>
      </label>
      <ErrorLine message={error} />
    </PluginDialog>
  );
}
