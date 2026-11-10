"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Switch } from "@/components/ui/atoms/Switch/Switch";
import { useConfirm } from "@/components/ui/layout/ConfirmDialog/ConfirmDialog";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import {
  SettingsBody,
  type SettingsColumn,
  SettingsList,
  type SettingsRow,
} from "@/components/ui/layout/SettingsList/SettingsList";
import {
  activatePlugin,
  deactivatePlugin,
  deletePluginData,
  type PluginResult,
  setPluginGrant,
} from "@/features/plugins/actions";
import type { ScopePlugin } from "@/features/plugins/queries";
import { useModal } from "@/lib/context";
import { PHONE_QUERY, useMediaQuery } from "@/lib/utils/useMediaQuery";
import styles from "../plugins.module.scss";
import {
  CapabilityList,
  ErrorLine,
  PluginBadges,
  PluginDialog,
  usePluginText,
} from "../shared";

interface Props {
  plugins: ScopePlugin[];
  workspaceId: string;
  /** Set on a project's page; the workspace's otherwise. */
  projectId?: string;
}

/**
 * The plugins of a workspace or a project (BARY-143): switch one on after
 * confirming what it may do, confirm again after an update asked for more,
 * switch it off (its data stays) or delete its data. In the workspace also
 * whether its projects may switch it on themselves — a project only sees
 * what was released for it. `plugin.enable` in that scope; the page checks
 * it again.
 */
export function ScopePlugins({ plugins, workspaceId, projectId }: Props) {
  const t = useTranslations();
  const text = usePluginText();
  const router = useRouter();
  const confirm = useConfirm();
  const { openModal } = useModal();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const inWorkspace = !projectId;
  const scope = { workspaceId, projectId: projectId ?? null };

  const run = (action: () => Promise<PluginResult>) =>
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setError(text.error(result.error));
      else {
        setError("");
        router.refresh();
      }
    });

  const openActivate = (plugin: ScopePlugin) =>
    openModal(
      ({ close }) => (
        <ActivateDialog
          plugin={plugin}
          scope={scope}
          sheet={isPhone}
          close={close}
          onDone={() => router.refresh()}
        />
      ),
      {
        ...(isPhone ? { placement: "bottom" as const } : {}),
        label: text.t("activateTitle", { name: plugin.name }),
      },
    );

  const toggle = (plugin: ScopePlugin, on: boolean) => {
    if (on) openActivate(plugin);
    else run(() => deactivatePlugin({ pluginId: plugin.pluginId, ...scope }));
  };

  const removeData = async (plugin: ScopePlugin) => {
    const ok = await confirm({
      title: text.t("deleteDataTitle", { name: plugin.name }),
      description: text.t("deleteDataDesc"),
      confirmLabel: t("actions.delete"),
      cancelLabel: t("actions.cancel"),
      danger: true,
    });
    if (ok)
      run(() => deletePluginData({ pluginId: plugin.pluginId, ...scope }));
  };

  const grant = async (plugin: ScopePlugin, granted: boolean) => {
    if (!granted && plugin.projectsOn) {
      const ok = await confirm({
        title: text.t("revokeGrantTitle", { name: plugin.name }),
        description: text.t("revokeGrantDesc", { count: plugin.projectsOn }),
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

  /** A word on where it stands, next to the switch. */
  const stateBadge = (plugin: ScopePlugin) => {
    const state = plugin.activation?.state;
    if (state === "blocked")
      return (
        <Badge size="sm" mono={false}>
          <Icon icon="lucide:shield-ban" width={11} /> {text.t("statusBlocked")}
        </Badge>
      );
    if (state === "notInstalled")
      return (
        <Badge size="sm" mono={false}>
          {text.t("statusNotInstalled")}
        </Badge>
      );
    if (state === "needsConfirmation")
      return (
        <Button
          variant="outline"
          size="sm"
          icon={<Icon icon="lucide:shield-alert" width={14} />}
          disabled={isPending}
          onClick={() => openActivate(plugin)}
        >
          {text.t("confirmAgain")}
        </Button>
      );
    return null;
  };

  const columns: SettingsColumn[] = [
    { id: "state", header: "", width: "max-content" },
    ...(inWorkspace
      ? [{ id: "projects", header: text.t("colProjects"), width: "90px" }]
      : []),
    { id: "enabled", header: text.t("colOn"), width: "60px" },
    { id: "actions", header: "", width: "40px" },
  ];

  const rows: SettingsRow[] = plugins.map((plugin) => {
    const state = plugin.activation?.state;
    const on = state === "active" || state === "needsConfirmation" || false;
    const offersProjects = inWorkspace && plugin.levels.includes("project");
    return {
      id: plugin.pluginId,
      label: plugin.name,
      desc: (
        <span className={styles.rowDesc}>
          <span>{plugin.description}</span>
          <span className={styles.badges}>
            <span className={styles.muted}>
              {plugin.author}
              {plugin.version && <> · v{plugin.version}</>}
            </span>
            <PluginBadges kind={plugin.kind} levels={plugin.levels} />
          </span>
        </span>
      ),
      cells: {
        state: stateBadge(plugin),
        ...(inWorkspace && {
          projects: offersProjects ? (
            <Switch
              id={`plugin-grant-${plugin.pluginId}`}
              label={text.t("grantLabel", { name: plugin.name })}
              labelHidden
              checked={!!plugin.granted}
              disabled={isPending || (!plugin.granted && !plugin.version)}
              onChange={(checked) => grant(plugin, checked)}
            />
          ) : (
            <span className={styles.muted}>—</span>
          ),
        }),
        enabled:
          plugin.offered || on ? (
            <Switch
              id={`plugin-on-${plugin.pluginId}`}
              label={text.t("onLabel", { name: plugin.name })}
              labelHidden
              checked={on}
              disabled={isPending || (!on && !plugin.offered)}
              onChange={(checked) => toggle(plugin, checked)}
            />
          ) : (
            <span className={styles.muted}>—</span>
          ),
        actions: plugin.activation ? (
          <Button
            variant="text"
            size="sm"
            icon={<Icon icon="lucide:trash-2" width={14} />}
            aria-label={text.t("deleteData")}
            title={text.t("deleteData")}
            disabled={isPending}
            onClick={() => removeData(plugin)}
          />
        ) : null,
      },
    };
  });

  return (
    <>
      <PageHeader divider={false} title={text.t("scopeTitle")} />
      <SettingsBody>
        <ErrorLine message={error} />
        {rows.length > 0 ? (
          <SettingsList
            rows={rows}
            columns={columns}
            label={text.t("scopeTitle")}
          />
        ) : (
          <p className={styles.empty}>
            {inWorkspace ? text.t("workspaceEmpty") : text.t("projectEmpty")}
          </p>
        )}
      </SettingsBody>
    </>
  );
}

function ActivateDialog({
  plugin,
  scope,
  sheet,
  close,
  onDone,
}: {
  plugin: ScopePlugin;
  scope: { workspaceId: string; projectId: string | null };
  sheet: boolean;
  close: () => void;
  onDone: () => void;
}) {
  const t = useTranslations();
  const text = usePluginText();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const again = plugin.activation?.state === "needsConfirmation";

  const activate = () =>
    startTransition(async () => {
      const result = await activatePlugin({
        pluginId: plugin.pluginId,
        ...scope,
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
      <p className={styles.description}>{plugin.description}</p>
      <p className={styles.muted}>
        {plugin.author} · v{plugin.version} · {text.kind(plugin.kind)}
      </p>
      {again && <p className={styles.notice}>{text.t("updateAsksMore")}</p>}
      <span className={styles.fieldLabel}>
        {scope.projectId ? text.t("mayInProject") : text.t("mayInWorkspace")}
      </span>
      <CapabilityList
        capabilities={plugin.capabilities}
        network={plugin.network}
        highlight={plugin.activation?.pending ?? []}
      />
      <label className={styles.confirm}>
        <input
          type="checkbox"
          checked={confirmed}
          disabled={isPending}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>
          {scope.projectId
            ? text.t("confirmProject")
            : text.t("confirmWorkspace")}
        </span>
      </label>
      <ErrorLine message={error} />
    </PluginDialog>
  );
}
