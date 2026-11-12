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

// Where in a workspace a plugin runs (BARY-201). The workspace is the one
// the store is open for; first it's released there, then switched on in
// single projects. "Released" means what the plugin's levels make of it: a
// workspace plugin runs in the workspace, a project plugin may be switched
// on by the workspace's projects — both, for a plugin with both levels.
// The plugin's header has "Add" (released nowhere yet) or "Edit"; both open
// one window, and a line under the header says where it runs.

const running = (a: Activation | null | undefined) =>
  a?.state === "active" || a?.state === "needsConfirmation";

/** Released in this workspace: on in the workspace where it has that
 *  level, released for projects where it has that one. */
export function isReleased(p: ScopeStorePlugin): boolean {
  const ws = p.levels.includes("workspace");
  const pr = p.levels.includes("project");
  return (!ws || running(p.workspace)) && (!pr || p.granted);
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

/** Whether the person can change anything about it here at all. */
const canChange = (plugin: ScopeStorePlugin, view: ScopeStoreView) =>
  !plugin.blocked &&
  (view.canWorkspace ||
    (plugin.levels.includes("project") && view.projects.length > 0));

/** "Add" while it's released nowhere here, "Edit" once it is — both open
 *  the same window. For the plugin's header. */
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
  if (!canChange(plugin, view)) return null;
  const used =
    isReleased(plugin) ||
    Object.values(plugin.projects).some((a) => running(a));
  return (
    <div className={store.headActions}>
      {used ? (
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
          disabled={!view.canWorkspace}
          title={view.canWorkspace ? undefined : text.t("notGrantedAskAdmin")}
          onClick={() => open("add")}
        >
          {text.t("placesAdd")}
        </Button>
      )}
    </div>
  );
}

/** One line under the header: released or not, the projects it's on in
 *  (each leading to its settings), and what waits for a confirmation. */
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

  if (plugin.blocked)
    return (
      <p className={scope.blocked}>
        <Icon icon="lucide:shield-ban" width={16} aria-hidden />
        {text.t("blockedByAdmin")}
      </p>
    );

  const released = isReleased(plugin);
  const settings = (a: Activation | null, slug: string | null) =>
    a?.hasSettings && (slug || view.canWorkspace)
      ? pluginSettingsPath(view.workspaceId, slug, plugin.pluginId)
      : null;
  const projects = view.projects.filter((p) => running(plugin.projects[p.id]));
  const waiting = [
    plugin.workspace,
    ...projects.map((p) => plugin.projects[p.id]),
  ].filter((a) => a?.state === "needsConfirmation").length;
  const wsSettings = settings(plugin.workspace, null);

  const chip = (
    key: string,
    content: React.ReactNode,
    href: string | null,
    waits: boolean,
  ) =>
    href ? (
      <Link
        key={key}
        href={href}
        className={scope.place}
        data-waiting={waits || undefined}
        title={text.t("pluginSettings")}
      >
        {content}
        <Icon icon="lucide:sliders-horizontal" width={12} aria-hidden />
      </Link>
    ) : (
      <span key={key} className={scope.place} data-waiting={waits || undefined}>
        {content}
      </span>
    );

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
      {released &&
        wsSettings &&
        chip(
          "ws",
          text.t("pluginSettings"),
          wsSettings,
          plugin.workspace?.state === "needsConfirmation",
        )}
      {plugin.levels.includes("project") && released && (
        <>
          <span className={scope.summaryLabel}>
            {projects.length > 0
              ? text.t("onInProjects")
              : text.t("onInNoProject")}
          </span>
          {projects.length > 0 && (
            <span className={scope.places}>
              {projects.map((p) =>
                chip(
                  p.id,
                  <>
                    <span
                      className={scope.dot}
                      // The project's own color — the only dynamic value here.
                      style={{ background: p.color }}
                      aria-hidden
                    />
                    {p.name}
                  </>,
                  settings(plugin.projects[p.id] ?? null, p.slug),
                  plugin.projects[p.id]?.state === "needsConfirmation",
                ),
              )}
            </span>
          )}
        </>
      )}
      {waiting > 0 && canChange(plugin, view) && (
        <span className={scope.waiting}>
          <Icon icon="lucide:sparkles" width={14} aria-hidden />
          {text.t("placesWaiting", { count: waiting })}
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
 * Releasing the plugin in this workspace, then picking the projects to
 * switch it on in. Projects wait until it's released; taking the release
 * back switches it off everywhere here (the data stays). Whatever newly
 * gets it — or waits for a confirmation — confirms what it may do, once.
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
  const forWorkspace = plugin.levels.includes("workspace");
  const forProjects = plugin.levels.includes("project");
  const wasReleased = isReleased(plugin);
  const [release, setRelease] = useState(
    // "Add" starts with the release ticked: that's what it's for.
    wasReleased || (mode === "add" && view.canWorkspace),
  );
  const [picked, setPicked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      view.projects.map((p) => [p.id, running(plugin.projects[p.id])]),
    ),
  );
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  // What releasing means here, and what it takes.
  const wsWaits = plugin.workspace?.state === "needsConfirmation";
  const wsOn =
    forWorkspace && release && (!running(plugin.workspace) || wsWaits);
  const wsOff = forWorkspace && !release && running(plugin.workspace);
  const grantOn = forProjects && release && !plugin.granted;
  const grantOff = forProjects && !release && plugin.granted;
  // Projects count only once released — or for a project admin, while it is.
  const projectsOpen = release || (!view.canWorkspace && plugin.granted);
  const toOn = forProjects
    ? view.projects.filter(
        (p) =>
          projectsOpen &&
          picked[p.id] &&
          (!running(plugin.projects[p.id]) ||
            plugin.projects[p.id]?.state === "needsConfirmation"),
      )
    : [];
  const toOff = forProjects
    ? view.projects.filter(
        (p) =>
          running(plugin.projects[p.id]) && (!projectsOpen || !picked[p.id]),
      )
    : [];
  const newPlaces = [
    ...(wsOn ? [workspaceName] : []),
    ...toOn.map((p) => p.name),
  ];
  const changed =
    wsOn || wsOff || grantOn || grantOff || toOn.length + toOff.length > 0;

  const save = () =>
    startTransition(async () => {
      const ids = { pluginId: plugin.pluginId, workspaceId: view.workspaceId };
      const steps: (() => Promise<PluginResult>)[] = [];
      if (wsOn)
        steps.push(() =>
          activatePlugin({ ...ids, capabilities: plugin.capabilities }),
        );
      if (grantOn) steps.push(() => setPluginGrant({ ...ids, granted: true }));
      for (const p of toOn)
        steps.push(() =>
          activatePlugin({
            ...ids,
            projectId: p.id,
            capabilities: plugin.capabilities,
          }),
        );
      for (const p of toOff)
        steps.push(() => deactivatePlugin({ ...ids, projectId: p.id }));
      if (grantOff)
        steps.push(() => setPluginGrant({ ...ids, granted: false }));
      if (wsOff) steps.push(() => deactivatePlugin(ids));
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

  const removeData = async (project: ScopeStoreProject | null) => {
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
        projectId: project?.id ?? null,
      });
      if ("error" in result) return setError(text.error(result.error));
      onDone();
      close();
    });
  };

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
            disabled={
              !changed || (newPlaces.length > 0 && !confirmed) || isPending
            }
            onClick={save}
          >
            {text.t("placesSave")}
          </Button>
        </>
      }
    >
      <section className={scope.pickGroup}>
        <h3 className={scope.subhead}>{text.t("step1Release")}</h3>
        <ul className={scope.picks}>
          <li>
            <label
              className={scope.pick}
              data-disabled={!view.canWorkspace || isPending || undefined}
            >
              <input
                type="checkbox"
                checked={release}
                disabled={!view.canWorkspace || isPending}
                onChange={(e) => setRelease(e.target.checked)}
              />
              <Icon icon="lucide:building-2" width={16} aria-hidden />
              <span className={scope.pickText}>
                <span className={scope.pickName}>
                  {text.t("releaseFor", { name: workspaceName })}
                </span>
                <span className={scope.pickHint}>
                  {text.t(
                    forWorkspace && forProjects
                      ? "releaseHintBoth"
                      : forWorkspace
                        ? "releaseHintWorkspace"
                        : "releaseHintProjects",
                  )}
                </span>
              </span>
              {wsWaits && (
                <span className={scope.rowState} data-state="needsConfirmation">
                  {text.t("scopeState.needsConfirmation")}
                </span>
              )}
            </label>
            {forWorkspace &&
              view.canWorkspace &&
              plugin.workspace?.state === "disabled" && (
                <Button
                  variant="text"
                  size="sm"
                  className={store.dangerIcon}
                  icon={<Icon icon="lucide:trash-2" width={14} />}
                  aria-label={text.t("deleteData")}
                  title={text.t("deleteData")}
                  disabled={isPending}
                  onClick={() => removeData(null)}
                />
              )}
          </li>
        </ul>
        {!view.canWorkspace && (
          <p className={store.muted}>
            {plugin.granted
              ? text.t("releasedByAdmin")
              : text.t("notGrantedAskAdmin")}
          </p>
        )}
      </section>

      {forProjects && (
        <section className={scope.pickGroup}>
          <h3 className={scope.subhead}>{text.t("step2Projects")}</h3>
          {view.projects.length === 0 ? (
            <p className={store.muted}>{text.t("noProjectsToManage")}</p>
          ) : (
            <ul className={scope.picks}>
              {view.projects.map((p) => {
                const a = plugin.projects[p.id] ?? null;
                const disabled = !projectsOpen || isPending;
                return (
                  <li key={p.id}>
                    <label
                      className={scope.pick}
                      data-disabled={disabled || undefined}
                    >
                      <input
                        type="checkbox"
                        checked={projectsOpen && !!picked[p.id]}
                        disabled={disabled}
                        onChange={(e) =>
                          setPicked((v) => ({ ...v, [p.id]: e.target.checked }))
                        }
                      />
                      <span
                        className={scope.dot}
                        // The project's own color — the only dynamic value.
                        style={{ background: p.color }}
                        aria-hidden
                      />
                      <span className={scope.pickName}>{p.name}</span>
                      {a && a.state !== "active" && (
                        <span className={scope.rowState} data-state={a.state}>
                          {text.t(`scopeState.${a.state}` as "scopeState.off")}
                        </span>
                      )}
                    </label>
                    {a?.state === "disabled" && (
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
              })}
            </ul>
          )}
          {!projectsOpen && view.projects.length > 0 && (
            <p className={store.muted}>{text.t("releaseFirst")}</p>
          )}
        </section>
      )}

      {newPlaces.length > 0 && (
        <>
          <header className={store.capHead}>
            <h3>
              {text.t("placesMayThere", { places: newPlaces.join(", ") })}
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
      {(wsOff || grantOff || toOff.length > 0) && (
        <p className={scope.offNote}>
          <Icon icon="lucide:power-off" width={14} aria-hidden />
          {wsOff || grantOff
            ? text.t("releaseOffNote", { name: workspaceName })
            : text.t("placesOffNote", {
                places: toOff.map((p) => p.name).join(", "),
              })}
        </p>
      )}
      <ErrorLine message={error} />
    </PluginDialog>
  );
}
