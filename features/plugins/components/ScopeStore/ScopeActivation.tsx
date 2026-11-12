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
  ScopeStoreProject,
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

// Where in this workspace a plugin runs (BARY-201). The plugin's header has
// "Add" and "Edit"; both open one window that lists the places — the
// workspace and each project the person manages — to tick, and asks to
// confirm what the plugin may do wherever it newly goes. Below the header a
// short line says where it's on now.

const running = (a: Activation | null | undefined) =>
  a?.state === "active" || a?.state === "needsConfirmation";

/** The places this person may switch the plugin on in, by key: `ws` for the
 *  workspace, a project's id for a project. */
function placesOf(plugin: ScopeStorePlugin, view: ScopeStoreView) {
  const out: {
    key: string;
    projectId: string | null;
    project: ScopeStoreProject | null;
    activation: Activation | null;
  }[] = [];
  if (plugin.levels.includes("workspace") && view.canWorkspace)
    out.push({
      key: "ws",
      projectId: null,
      project: null,
      activation: plugin.workspace,
    });
  if (plugin.levels.includes("project"))
    for (const project of view.projects)
      out.push({
        key: project.id,
        projectId: project.id,
        project,
        activation: plugin.projects[project.id] ?? null,
      });
  return out;
}

function usePlacesDialog(
  plugin: ScopeStorePlugin,
  view: ScopeStoreView,
  workspaceName: string,
) {
  const text = usePluginText();
  const router = useRouter();
  const { openModal } = useModal();
  const isPhone = useMediaQuery(PHONE_QUERY);
  return (mode: "add" | "edit") =>
    openModal(
      ({ close }) => (
        <PlacesDialog
          mode={mode}
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
        label: text.t(mode === "add" ? "placesAddTitle" : "placesEditTitle", {
          name: plugin.name,
        }),
      },
    );
}

/** "Add" while it runs nowhere here, "Edit" once it runs somewhere — both
 *  open the same window. For the plugin's header. */
export function PlacesActions({
  plugin,
  view,
  workspaceName,
}: {
  plugin: ScopeStorePlugin;
  view: ScopeStoreView;
  workspaceName: string;
}) {
  const text = usePluginText();
  const open = usePlacesDialog(plugin, view, workspaceName);
  const places = placesOf(plugin, view);
  if (plugin.blocked || places.length === 0) return null;
  const onSomewhere = places.some((p) => running(p.activation));
  return (
    <div className={store.headActions}>
      {onSomewhere ? (
        <Button
          variant="outline"
          icon={<Icon icon="lucide:pencil" width={15} />}
          onClick={() => open("edit")}
        >
          {text.t("placesEdit")}
        </Button>
      ) : (
        <Button
          variant="primary"
          icon={<Icon icon="lucide:plus" width={15} />}
          onClick={() => open("add")}
        >
          {text.t("placesAdd")}
        </Button>
      )}
    </div>
  );
}

/** One line under the header: where it's on, what waits for a
 *  confirmation, and the way to its settings. */
export function PlacesSummary({
  plugin,
  view,
  workspaceName,
}: {
  plugin: ScopeStorePlugin;
  view: ScopeStoreView;
  workspaceName: string;
}) {
  const text = usePluginText();
  const open = usePlacesDialog(plugin, view, workspaceName);
  const on: {
    key: string;
    name: string;
    color: string | null;
    activation: Activation;
    settingsHref: string | null;
  }[] = [];
  const settingsOf = (a: Activation, slug: string | null) =>
    a.hasSettings
      ? pluginSettingsPath(view.workspaceId, slug, plugin.pluginId)
      : null;
  if (running(plugin.workspace) && plugin.workspace)
    on.push({
      key: "ws",
      name: workspaceName,
      color: null,
      activation: plugin.workspace,
      settingsHref: view.canWorkspace
        ? settingsOf(plugin.workspace, null)
        : null,
    });
  for (const project of view.projects) {
    const a = plugin.projects[project.id];
    if (running(a) && a)
      on.push({
        key: project.id,
        name: project.name,
        color: project.color,
        activation: a,
        settingsHref: settingsOf(a, project.slug),
      });
  }
  const waiting = on.filter((p) => p.activation.state === "needsConfirmation");

  if (plugin.blocked)
    return (
      <p className={scope.blocked}>
        <Icon icon="lucide:shield-ban" width={16} aria-hidden />
        {text.t("blockedByAdmin")}
      </p>
    );

  return (
    <section className={scope.summary} aria-label={text.t("onIn")}>
      <span className={scope.summaryLabel}>
        <Icon icon="lucide:power" width={14} aria-hidden />
        {on.length > 0 ? text.t("onIn") : text.t("onNowhere")}
      </span>
      {on.length > 0 && (
        <span className={scope.places}>
          {on.map((p) => {
            const content = (
              <>
                {p.color ? (
                  <span
                    className={scope.dot}
                    // The project's own color — the only dynamic value here.
                    style={{ background: p.color }}
                    aria-hidden
                  />
                ) : (
                  <Icon icon="lucide:building-2" width={13} aria-hidden />
                )}
                {p.name}
                {p.settingsHref && (
                  <Icon
                    icon="lucide:sliders-horizontal"
                    width={12}
                    aria-hidden
                  />
                )}
              </>
            );
            return p.settingsHref ? (
              <Link
                key={p.key}
                href={p.settingsHref}
                className={scope.place}
                data-waiting={
                  p.activation.state === "needsConfirmation" || undefined
                }
                title={text.t("pluginSettings")}
              >
                {content}
              </Link>
            ) : (
              <span
                key={p.key}
                className={scope.place}
                data-waiting={
                  p.activation.state === "needsConfirmation" || undefined
                }
              >
                {content}
              </span>
            );
          })}
        </span>
      )}
      {waiting.length > 0 && (
        <span className={scope.waiting}>
          <Icon icon="lucide:sparkles" width={14} aria-hidden />
          {text.t("placesWaiting", { count: waiting.length })}
          <button
            type="button"
            className={scope.waitingButton}
            onClick={() => open("edit")}
          >
            {text.t("confirmAgain")}
          </button>
        </span>
      )}
    </section>
  );
}

/**
 * Where the plugin runs, to tick: the workspace and each project. For a
 * workspace admin, picking a project releases it for projects too. Whatever
 * newly gets it — or waits for a confirmation — confirms what it may do,
 * once, in the same window. Saving switches on and off what changed.
 */
function PlacesDialog({
  mode,
  plugin,
  view,
  workspaceName,
  sheet,
  close,
  onDone,
}: {
  mode: "add" | "edit";
  plugin: ScopeStorePlugin;
  view: ScopeStoreView;
  workspaceName: string;
  sheet: boolean;
  close: () => void;
  onDone: () => void;
}) {
  const t = useTranslations();
  const text = usePluginText();
  const confirmDelete = useConfirm();
  const places = placesOf(plugin, view);
  const [picked, setPicked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(places.map((p) => [p.key, running(p.activation)])),
  );
  const [granted, setGranted] = useState(plugin.granted);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const forProjects = plugin.levels.includes("project");

  const projectBlocked = (p: (typeof places)[number]) =>
    p.projectId !== null && !granted && !view.canWorkspace;
  const toOn = places.filter(
    (p) =>
      picked[p.key] &&
      (!running(p.activation) || p.activation?.state === "needsConfirmation"),
  );
  const toOff = places.filter((p) => !picked[p.key] && running(p.activation));
  // A workspace admin picking a project releases it for projects as well.
  const grantNow =
    view.canWorkspace &&
    forProjects &&
    (granted || toOn.some((p) => p.projectId !== null));
  const grantChanged =
    view.canWorkspace && forProjects && grantNow !== plugin.granted;
  const changed = toOn.length + toOff.length > 0 || grantChanged;
  const needsConfirm = toOn.length > 0;

  const nameOf = (p: (typeof places)[number]) =>
    p.project ? p.project.name : workspaceName;

  const save = () =>
    startTransition(async () => {
      const steps: (() => Promise<PluginResult>)[] = [];
      if (grantChanged && grantNow)
        steps.push(() =>
          setPluginGrant({
            pluginId: plugin.pluginId,
            workspaceId: view.workspaceId,
            granted: true,
          }),
        );
      for (const p of toOn)
        steps.push(() =>
          activatePlugin({
            pluginId: plugin.pluginId,
            workspaceId: view.workspaceId,
            projectId: p.projectId,
            capabilities: plugin.capabilities,
          }),
        );
      for (const p of toOff)
        steps.push(() =>
          deactivatePlugin({
            pluginId: plugin.pluginId,
            workspaceId: view.workspaceId,
            projectId: p.projectId,
          }),
        );
      if (grantChanged && !grantNow)
        steps.push(() =>
          setPluginGrant({
            pluginId: plugin.pluginId,
            workspaceId: view.workspaceId,
            granted: false,
          }),
        );
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

  const removeData = async (p: (typeof places)[number]) => {
    const ok = await confirmDelete({
      title: text.t("deleteDataTitle", { name: plugin.name }),
      description: text.t("deleteDataDesc"),
      confirmLabel: t("actions.delete"),
      cancelLabel: t("actions.cancel"),
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deletePluginData({
        pluginId: plugin.pluginId,
        workspaceId: view.workspaceId,
        projectId: p.projectId,
      });
      if ("error" in result) return setError(text.error(result.error));
      onDone();
      close();
    });
  };

  const row = (p: (typeof places)[number]) => {
    const disabled = isPending || projectBlocked(p);
    const state = p.activation?.state ?? "off";
    return (
      <li key={p.key}>
        <label className={scope.pick} data-disabled={disabled || undefined}>
          <input
            type="checkbox"
            checked={!!picked[p.key]}
            disabled={disabled}
            onChange={(e) =>
              setPicked((v) => ({ ...v, [p.key]: e.target.checked }))
            }
          />
          {p.project ? (
            <span
              className={scope.dot}
              // The project's own color — the only dynamic value here.
              style={{ background: p.project.color }}
              aria-hidden
            />
          ) : (
            <Icon icon="lucide:building-2" width={16} aria-hidden />
          )}
          <span className={scope.pickName}>{nameOf(p)}</span>
          {state !== "off" && state !== "active" && (
            <span className={scope.rowState} data-state={state}>
              {text.t(`scopeState.${state}` as "scopeState.off")}
            </span>
          )}
        </label>
        {state === "disabled" && (
          <Button
            variant="text"
            size="sm"
            className={store.dangerIcon}
            icon={<Icon icon="lucide:trash-2" width={14} />}
            aria-label={text.t("deleteData")}
            title={text.t("deleteData")}
            disabled={isPending}
            onClick={() => removeData(p)}
          />
        )}
      </li>
    );
  };

  const workspacePlace = places.find((p) => p.projectId === null);
  const projectPlaces = places.filter((p) => p.projectId !== null);

  return (
    <PluginDialog
      title={text.t(mode === "add" ? "placesAddTitle" : "placesEditTitle", {
        name: plugin.name,
      })}
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
            disabled={!changed || (needsConfirm && !confirmed) || isPending}
            onClick={save}
          >
            {text.t("placesSave")}
          </Button>
        </>
      }
    >
      <p className={styles.description}>{text.t("placesPickIntro")}</p>

      {workspacePlace && (
        <section className={scope.pickGroup}>
          <h3 className={scope.subhead}>{text.t("placesWorkspace")}</h3>
          <ul className={scope.picks}>{row(workspacePlace)}</ul>
        </section>
      )}

      {forProjects && (
        <section className={scope.pickGroup}>
          <h3 className={scope.subhead}>{text.t("projectsHeading")}</h3>
          {view.canWorkspace ? (
            <label className={scope.pick}>
              <input
                type="checkbox"
                checked={grantNow}
                disabled={isPending}
                onChange={(e) => {
                  setGranted(e.target.checked);
                  // Taking the release back switches the projects off.
                  if (!e.target.checked)
                    setPicked((v) =>
                      Object.fromEntries(
                        Object.entries(v).map(([k, on]) => [
                          k,
                          k === "ws" ? on : false,
                        ]),
                      ),
                    );
                }}
              />
              <span className={scope.pickName}>
                {text.t("grantLabel", { name: plugin.name })}
              </span>
            </label>
          ) : (
            !granted && (
              <p className={store.muted}>{text.t("notGrantedAskAdmin")}</p>
            )
          )}
          {projectPlaces.length > 0 ? (
            <ul className={scope.picks}>{projectPlaces.map(row)}</ul>
          ) : (
            <p className={store.muted}>{text.t("noProjectsToManage")}</p>
          )}
        </section>
      )}

      {needsConfirm && (
        <>
          <header className={store.capHead}>
            <h3>
              {text.t("placesMayThere", {
                places: toOn.map(nameOf).join(", "),
              })}
            </h3>
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
            <span>{text.t("placesConfirm")}</span>
          </label>
        </>
      )}
      {toOff.length > 0 && (
        <p className={scope.offNote}>
          <Icon icon="lucide:power-off" width={14} aria-hidden />
          {text.t("placesOffNote", { places: toOff.map(nameOf).join(", ") })}
        </p>
      )}
      <ErrorLine message={error} />
    </PluginDialog>
  );
}
