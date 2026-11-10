"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
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
  addPluginSource,
  browseSource,
  type DirectoryPlugin,
  installPlugin,
  type PluginResult,
  previewRelease,
  type ReleasePreview,
  removePluginSource,
  rollbackPlugin,
  setPluginBlocked,
  uninstallPlugin,
  updatePluginSource,
} from "@/features/plugins/actions";
import type {
  AdminPluginsView,
  PluginSourceRow,
} from "@/features/plugins/queries";
import { useModal } from "@/lib/context";
import { compareSemver } from "@/lib/plugins/semver";
import { PHONE_QUERY, useMediaQuery } from "@/lib/utils/useMediaQuery";
import styles from "../plugins.module.scss";
import {
  CapabilityList,
  ErrorLine,
  PluginBadges,
  PluginDialog,
  usePluginText,
} from "../shared";

/**
 * The platform's plugins (BARY-143): the directories it reads, what's
 * installed, and every step of a plugin's life — installing after a look at
 * what it asks for, updating, rolling back, blocking and removing. Only for
 * `plugin.manage`; the page checks it again (`getAdminPluginsView`).
 */
export function AdminPlugins({ sources, installed }: AdminPluginsView) {
  const t = useTranslations();
  const text = usePluginText();
  const format = useFormatter();
  const router = useRouter();
  const confirm = useConfirm();
  const { openModal } = useModal();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const modal = isPhone ? { placement: "bottom" as const } : {};

  /** Runs an action; a returned error shows above the lists. */
  const run = (action: () => Promise<PluginResult<object>>) =>
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setError(text.error(result.error));
      else {
        setError("");
        router.refresh();
      }
    });

  const openAddSource = () =>
    openModal(
      ({ close }) => (
        <AddSourceDialog
          sheet={isPhone}
          close={close}
          onDone={() => router.refresh()}
        />
      ),
      { ...modal, label: text.t("addSource") },
    );

  const openBrowse = (source: PluginSourceRow) =>
    openModal(
      ({ close }) => (
        <BrowseDialog
          source={source}
          sheet={isPhone}
          close={close}
          onInstall={(plugin, version) => {
            close();
            openInstall(source, plugin, version);
          }}
        />
      ),
      { ...modal, label: text.t("browseTitle", { source: source.name }) },
    );

  const openInstall = (
    source: PluginSourceRow,
    plugin: DirectoryPlugin,
    version: string,
  ) =>
    openModal(
      ({ close }) => (
        <InstallDialog
          source={source}
          plugin={plugin}
          version={version}
          sheet={isPhone}
          close={close}
          onDone={() => router.refresh()}
        />
      ),
      { ...modal, label: text.t("installTitle", { name: plugin.name }) },
    );

  const openUninstall = (pluginId: string, name: string) =>
    openModal(
      ({ close }) => (
        <UninstallDialog
          pluginId={pluginId}
          name={name}
          sheet={isPhone}
          close={close}
          onDone={() => router.refresh()}
        />
      ),
      { ...modal, label: text.t("uninstallTitle", { name }) },
    );

  const removeSource = async (source: PluginSourceRow) => {
    const ok = await confirm({
      title: text.t("removeSourceTitle", { name: source.name }),
      description: text.t("removeSourceDesc"),
      confirmLabel: t("actions.delete"),
      cancelLabel: t("actions.cancel"),
      danger: true,
    });
    if (ok) run(() => removePluginSource(source.id));
  };

  const block = async (pluginId: string, name: string, blocked: boolean) => {
    if (blocked) {
      const ok = await confirm({
        title: text.t("blockTitle", { name }),
        description: text.t("blockDesc"),
        confirmLabel: text.t("block"),
        cancelLabel: t("actions.cancel"),
        danger: true,
        always: true,
      });
      if (!ok) return;
    }
    run(() => setPluginBlocked(pluginId, blocked));
  };

  const rollback = async (pluginId: string, name: string, to: string) => {
    const ok = await confirm({
      title: text.t("rollbackTitle", { name, version: to }),
      description: text.t("rollbackDesc"),
      confirmLabel: text.t("rollback"),
      cancelLabel: t("actions.cancel"),
    });
    if (ok) run(() => rollbackPlugin(pluginId));
  };

  const sourceColumns: SettingsColumn[] = [
    { id: "enabled", header: text.t("colEnabled"), width: "70px" },
    { id: "actions", header: "", width: "max-content" },
  ];
  const sourceRows: SettingsRow[] = sources.map((source) => ({
    id: source.id,
    label: source.name,
    desc: (
      <span className={styles.rowDesc}>
        <span className={styles.url}>{source.url}</span>
        <span className={styles.badges}>
          {source.private && (
            <Badge size="sm" mono={false}>
              <Icon icon="lucide:lock" width={11} /> {text.t("private")}
            </Badge>
          )}
          {source.lastSyncError ? (
            <Badge size="sm" mono={false}>
              <Icon icon="lucide:circle-alert" width={11} />{" "}
              {text.error(source.lastSyncError)}
            </Badge>
          ) : source.lastSyncAt ? (
            <span className={styles.muted}>
              {text.t("lastSync", {
                date: format.dateTime(source.lastSyncAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })}
            </span>
          ) : null}
        </span>
      </span>
    ),
    cells: {
      enabled: (
        <Switch
          id={`source-enabled-${source.id}`}
          label={text.t("colEnabled")}
          labelHidden
          checked={source.enabled}
          disabled={isPending}
          onChange={(enabled) =>
            run(() => updatePluginSource(source.id, { enabled }))
          }
        />
      ),
      actions: (
        <span className={styles.rowActions}>
          <Button
            variant="outline"
            size="sm"
            disabled={!source.enabled || isPending}
            icon={<Icon icon="lucide:search" width={14} />}
            onClick={() => openBrowse(source)}
          >
            {text.t("browse")}
          </Button>
          <Button
            variant="text"
            size="sm"
            icon={<Icon icon="lucide:trash-2" width={14} />}
            aria-label={text.t("removeSource")}
            title={text.t("removeSource")}
            disabled={isPending}
            onClick={() => removeSource(source)}
          />
        </span>
      ),
    },
  }));

  const installedColumns: SettingsColumn[] = [
    { id: "status", header: text.t("colStatus"), width: "180px" },
    { id: "actions", header: "", width: "max-content" },
  ];
  const installedRows: SettingsRow[] = installed.map((plugin) => ({
    id: plugin.pluginId,
    label: plugin.name,
    desc: (
      <span className={styles.rowDesc}>
        <span>
          {plugin.author}
          {plugin.version && <> · v{plugin.version}</>}
        </span>
        <PluginBadges kind={plugin.kind} levels={plugin.levels} />
      </span>
    ),
    cells: {
      status: plugin.blocked ? (
        <Badge size="sm" mono={false}>
          <Icon icon="lucide:shield-ban" width={11} /> {text.t("statusBlocked")}
        </Badge>
      ) : (
        <span className={styles.muted}>
          {text.t("activations", { count: plugin.activations })}
        </span>
      ),
      actions: (
        <span className={styles.rowActions}>
          {plugin.rollbackTo && !plugin.blocked && (
            <Button
              variant="text"
              size="sm"
              icon={<Icon icon="lucide:undo-2" width={14} />}
              disabled={isPending}
              onClick={() =>
                rollback(
                  plugin.pluginId,
                  plugin.name,
                  plugin.rollbackTo as string,
                )
              }
            >
              {text.t("rollbackTo", { version: plugin.rollbackTo })}
            </Button>
          )}
          <Button
            variant="text"
            size="sm"
            icon={
              <Icon
                icon={
                  plugin.blocked ? "lucide:shield-check" : "lucide:shield-ban"
                }
                width={14}
              />
            }
            disabled={isPending}
            onClick={() => block(plugin.pluginId, plugin.name, !plugin.blocked)}
          >
            {plugin.blocked ? text.t("unblock") : text.t("block")}
          </Button>
          <Button
            variant="text"
            size="sm"
            icon={<Icon icon="lucide:package-x" width={14} />}
            aria-label={text.t("uninstall")}
            title={text.t("uninstall")}
            disabled={isPending}
            onClick={() => openUninstall(plugin.pluginId, plugin.name)}
          />
        </span>
      ),
    },
  }));

  return (
    <>
      <PageHeader
        divider={false}
        title={text.t("adminTitle")}
        actions={
          <Button
            variant="primary"
            icon={<Icon icon="lucide:plus" width={15} />}
            onClick={openAddSource}
          >
            {text.t("addSource")}
          </Button>
        }
      />
      <SettingsBody>
        <ErrorLine message={error} />

        {sourceRows.length > 0 ? (
          <SettingsList
            title={text.t("sources")}
            rows={sourceRows}
            columns={sourceColumns}
          />
        ) : (
          <p className={styles.empty}>{text.t("noSources")}</p>
        )}

        {installedRows.length > 0 ? (
          <SettingsList
            title={text.t("installed")}
            rows={installedRows}
            columns={installedColumns}
          />
        ) : (
          <p className={styles.empty}>{text.t("noneInstalled")}</p>
        )}
      </SettingsBody>
    </>
  );
}

// ─── Dialogs ────────────────────────────────────────────────────────────────

function AddSourceDialog({
  sheet,
  close,
  onDone,
}: {
  sheet: boolean;
  close: () => void;
  onDone: () => void;
}) {
  const t = useTranslations();
  const text = usePluginText();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const canAdd = !!name.trim() && !!url.trim() && !isPending;

  const add = () =>
    startTransition(async () => {
      const result = await addPluginSource({ name, url, token });
      if ("error" in result) return setError(text.error(result.error));
      onDone();
      close();
    });

  return (
    <PluginDialog
      title={text.t("addSource")}
      sheet={sheet}
      close={close}
      footer={
        <>
          {!sheet && (
            <Button variant="ghost" onClick={close} disabled={isPending}>
              {t("actions.cancel")}
            </Button>
          )}
          <Button variant="primary" disabled={!canAdd} onClick={add}>
            {text.t("addSource")}
          </Button>
        </>
      }
    >
      <Input
        autoFocus={!sheet}
        label={text.t("sourceName")}
        placeholder={text.t("sourceNamePlaceholder")}
        value={name}
        disabled={isPending}
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        label={text.t("sourceUrl")}
        placeholder="https://raw.githubusercontent.com/…/plugins.json"
        hint={text.t("sourceUrlHint")}
        value={url}
        disabled={isPending}
        onChange={(e) => setUrl(e.target.value)}
      />
      <Input
        variant="password"
        autoComplete="off"
        label={text.t("sourceToken")}
        hint={text.t("sourceTokenHint")}
        value={token}
        disabled={isPending}
        onChange={(e) => setToken(e.target.value)}
      />
      <ErrorLine message={error} />
    </PluginDialog>
  );
}

function BrowseDialog({
  source,
  sheet,
  close,
  onInstall,
}: {
  source: PluginSourceRow;
  sheet: boolean;
  close: () => void;
  onInstall: (plugin: DirectoryPlugin, version: string) => void;
}) {
  const text = usePluginText();
  const t = useTranslations();
  const [state, setState] = useState<
    | { loading: true }
    | { loading: false; plugins: DirectoryPlugin[]; skipped: number }
    | { loading: false; error: string }
  >({ loading: true });

  // Read when the window opens — the directory lives elsewhere, the page
  // shouldn't wait for it.
  useEffect(() => {
    browseSource(source.id).then((result) =>
      setState(
        "error" in result
          ? { loading: false, error: text.error(result.error) }
          : { loading: false, ...result },
      ),
    );
  }, [source.id, text.error]);

  return (
    <PluginDialog
      title={text.t("browseTitle", { source: source.name })}
      sheet={sheet}
      close={close}
      footer={
        <Button variant="ghost" onClick={close}>
          {t("actions.close")}
        </Button>
      }
    >
      {state.loading ? (
        <p className={styles.muted}>
          <Icon
            icon="lucide:loader-circle"
            width={14}
            className={styles.spin}
          />{" "}
          {text.t("loadingDirectory")}
        </p>
      ) : "error" in state ? (
        <ErrorLine message={state.error} />
      ) : state.plugins.length === 0 ? (
        <p className={styles.empty}>{text.t("directoryEmpty")}</p>
      ) : (
        <>
          <ul className={styles.directory}>
            {state.plugins.map((plugin) => (
              <DirectoryItem
                key={plugin.id}
                plugin={plugin}
                onInstall={onInstall}
              />
            ))}
          </ul>
          {state.skipped > 0 && (
            <p className={styles.muted}>
              {text.t("skippedEntries", { count: state.skipped })}
            </p>
          )}
        </>
      )}
    </PluginDialog>
  );
}

function DirectoryItem({
  plugin,
  onInstall,
}: {
  plugin: DirectoryPlugin;
  onInstall: (plugin: DirectoryPlugin, version: string) => void;
}) {
  const text = usePluginText();
  const [version, setVersion] = useState(plugin.versions[0]);
  const newer =
    plugin.installed !== null && compareSemver(version, plugin.installed) > 0;
  const same = plugin.installed === version;

  return (
    <li className={styles.directoryItem}>
      <div className={styles.directoryHead}>
        <span className={styles.pluginName}>{plugin.name}</span>
        <PluginBadges kind={plugin.kind} levels={plugin.levels} />
      </div>
      <p className={styles.description}>{plugin.description}</p>
      <p className={styles.muted}>
        {plugin.author} ·{" "}
        <a
          href={`https://github.com/${plugin.repo}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          {plugin.repo}
        </a>
        {plugin.installed && (
          <> · {text.t("installedVersion", { version: plugin.installed })}</>
        )}
      </p>
      <div className={styles.directoryActions}>
        {plugin.versions.length > 1 && (
          <select
            className={styles.select}
            aria-label={text.t("version")}
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          >
            {plugin.versions.map((v) => (
              <option key={v} value={v}>
                v{v}
              </option>
            ))}
          </select>
        )}
        {plugin.blocked ? (
          <Badge size="sm" mono={false}>
            {text.t("statusBlocked")}
          </Badge>
        ) : same ? (
          <Badge size="sm" mono={false} active>
            {text.t("statusInstalled")}
          </Badge>
        ) : (
          <Button
            variant={plugin.installed ? "outline" : "primary"}
            size="sm"
            icon={
              <Icon
                icon={newer ? "lucide:package-check" : "lucide:package-plus"}
                width={14}
              />
            }
            onClick={() => onInstall(plugin, version)}
          >
            {plugin.installed
              ? newer
                ? text.t("updateTo", { version })
                : text.t("installOlder", { version })
              : text.t("installVersion", { version })}
          </Button>
        )}
      </div>
    </li>
  );
}

function InstallDialog({
  source,
  plugin,
  version,
  sheet,
  close,
  onDone,
}: {
  source: PluginSourceRow;
  plugin: DirectoryPlugin;
  version: string;
  sheet: boolean;
  close: () => void;
  onDone: () => void;
}) {
  const t = useTranslations();
  const text = usePluginText();
  const [preview, setPreview] = useState<ReleasePreview | null>(null);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  // The release is loaded and checked before anything is shown — what's
  // confirmed is what the files say, not what the directory claims.
  useEffect(() => {
    previewRelease({ sourceId: source.id, pluginId: plugin.id, version }).then(
      (result) =>
        "error" in result
          ? setError(text.error(result.error))
          : setPreview(result.preview),
    );
  }, [source.id, plugin.id, version, text.error]);

  const install = () =>
    preview &&
    startTransition(async () => {
      const result = await installPlugin({
        sourceId: source.id,
        pluginId: plugin.id,
        version,
        capabilities: preview.capabilities,
      });
      if ("error" in result) return setError(text.error(result.error));
      onDone();
      close();
    });

  return (
    <PluginDialog
      title={text.t("installTitle", { name: plugin.name })}
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
            disabled={!preview || !confirmed || isPending}
            onClick={install}
          >
            {plugin.installed
              ? text.t("updateTo", { version })
              : text.t("installVersion", { version })}
          </Button>
        </>
      }
    >
      {!preview && !error && (
        <p className={styles.muted}>
          <Icon
            icon="lucide:loader-circle"
            width={14}
            className={styles.spin}
          />{" "}
          {text.t("checkingRelease")}
        </p>
      )}
      <ErrorLine message={error} />
      {preview && (
        <>
          <dl className={styles.facts}>
            <dt>{text.t("author")}</dt>
            <dd>
              {preview.authorUrl ? (
                <a
                  href={preview.authorUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {preview.author}
                </a>
              ) : (
                preview.author
              )}
            </dd>
            <dt>{text.t("origin")}</dt>
            <dd>
              <a
                href={`https://github.com/${plugin.repo}/releases/tag/${version}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                {plugin.repo}@{version}
              </a>{" "}
              · {source.name}
            </dd>
            <dt>{text.t("kindLabel")}</dt>
            <dd>
              {text.kind(preview.kind)}
              <span className={styles.muted}>
                {" "}
                — {text.kindHint(preview.kind)}
              </span>
            </dd>
            <dt>{text.t("levels")}</dt>
            <dd>{preview.levels.map(text.level).join(", ")}</dd>
            <dt>{text.t("license")}</dt>
            <dd>{preview.license}</dd>
            <dt>{text.t("hash")}</dt>
            <dd>
              <code className={styles.hash} title={preview.hash}>
                {preview.hash.slice(0, 16)}…
              </code>
              {preview.codeSize > 0 && (
                <span className={styles.muted}>
                  {" "}
                  · {Math.ceil(preview.codeSize / 1024)} KB
                </span>
              )}
            </dd>
          </dl>
          <p className={styles.description}>{preview.description}</p>
          <span className={styles.fieldLabel}>{text.t("asksFor")}</span>
          <CapabilityList
            capabilities={preview.capabilities}
            network={preview.network}
          />
          <label className={styles.confirm}>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={isPending}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>{text.t("confirmInstall")}</span>
          </label>
        </>
      )}
    </PluginDialog>
  );
}

function UninstallDialog({
  pluginId,
  name,
  sheet,
  close,
  onDone,
}: {
  pluginId: string;
  name: string;
  sheet: boolean;
  close: () => void;
  onDone: () => void;
}) {
  const t = useTranslations();
  const text = usePluginText();
  const [deleteData, setDeleteData] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const uninstall = () =>
    startTransition(async () => {
      const result = await uninstallPlugin(pluginId, { deleteData });
      if ("error" in result) return setError(text.error(result.error));
      onDone();
      close();
    });

  return (
    <PluginDialog
      title={text.t("uninstallTitle", { name })}
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
            className={styles.danger}
            disabled={isPending}
            onClick={uninstall}
          >
            {text.t("uninstall")}
          </Button>
        </>
      }
    >
      <p>{text.t("uninstallDesc")}</p>
      <label className={styles.confirm}>
        <input
          type="checkbox"
          checked={deleteData}
          disabled={isPending}
          onChange={(e) => setDeleteData(e.target.checked)}
        />
        <span>{text.t("uninstallDeleteData")}</span>
      </label>
      <ErrorLine message={error} />
    </PluginDialog>
  );
}
