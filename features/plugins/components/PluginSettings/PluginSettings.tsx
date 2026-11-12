"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
import { NativeSelect } from "@/components/ui/atoms/NativeSelect/NativeSelect";
import { Switch } from "@/components/ui/atoms/Switch/Switch";
import { useConfirm } from "@/components/ui/layout/ConfirmDialog/ConfirmDialog";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import {
  activatePlugin,
  deactivatePlugin,
  deletePluginData,
  savePluginSettings,
} from "@/features/plugins/actions";
import type {
  PluginSettingField,
  PluginSettingsView,
} from "@/features/plugins/queries";
import { Link } from "@/i18n/navigation";
import { pluginStorePath } from "@/lib/nav";
import { CapabilityCards } from "../PluginStore/capabilities";
import { PluginTile } from "../PluginStore/PluginTile";
import shared from "../plugins.module.scss";
import { ErrorLine, usePluginText } from "../shared";
import styles from "./pluginSettings.module.scss";

// A plugin's page in a workspace or project (BARY-201). In a project it's
// where a plugin the workspace released gets switched on — confirming what
// it may do here — and off again. While it runs: the form its manifest
// declares (`contributes.settings`). What's saved is checked against the
// manifest on the server (`savePluginSettings`) — the form only offers what
// may be stored. In the workspace, switching on and off is the store's
// release; this page only holds the settings.

type Value = string | number | boolean;

/** What a field shows: the stored value, else the manifest's default. */
function initial(field: PluginSettingField, stored: unknown): Value {
  const value = stored ?? field.default;
  if (field.type === "boolean") return value === true;
  if (value === null || value === undefined) return "";
  return value as Value;
}

export function PluginSettings({
  view,
  scope,
  viewsHref,
}: {
  view: PluginSettingsView;
  scope: { workspaceId: string; projectId: string | null };
  /** Where the plugin's project views open, `<viewsHref>/<viewId>`. */
  viewsHref?: string;
}) {
  const t = useTranslations();
  const text = usePluginText();
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, Value>>(() =>
    Object.fromEntries(
      view.fields.map((f) => [f.key, initial(f, view.values[f.key])]),
    ),
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const { plugin } = view;
  const inProject = scope.projectId !== null;
  const running = view.state === "active" || view.state === "needsConfirmation";
  const storeHref = pluginStorePath(scope.workspaceId, {
    plugin: plugin.pluginId,
  });

  const set = (key: string, value: Value) => {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  };

  const save = () =>
    startTransition(async () => {
      const result = await savePluginSettings({
        pluginId: plugin.pluginId,
        ...scope,
        values,
      });
      if ("error" in result) return setError(text.error(result.error));
      setError("");
      setSaved(true);
      router.refresh();
    });

  const switchOn = () =>
    startTransition(async () => {
      const result = await activatePlugin({
        pluginId: plugin.pluginId,
        ...scope,
        capabilities: plugin.capabilities,
      });
      if ("error" in result) return setError(text.error(result.error));
      setError("");
      setConfirmed(false);
      router.refresh();
    });

  const switchOff = () =>
    startTransition(async () => {
      const result = await deactivatePlugin({
        pluginId: plugin.pluginId,
        ...scope,
      });
      if ("error" in result) return setError(text.error(result.error));
      router.refresh();
    });

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
      const result = await deletePluginData({
        pluginId: plugin.pluginId,
        ...scope,
      });
      if ("error" in result) return setError(text.error(result.error));
      router.refresh();
    });
  };

  return (
    <>
      <PageHeader
        leading={<PluginTile id={plugin.pluginId} name={plugin.name} />}
        title={plugin.name}
        description={`${plugin.author} · v${plugin.version}`}
        actions={
          // Only a workspace manager has the store.
          !inProject && (
            <Link href={storeHref} className={styles.storeLink}>
              <Icon icon="lucide:store" width={15} aria-hidden />
              {text.t("openInStore")}
            </Link>
          )
        }
      />
      <div className={styles.page}>
        {/* Off here, or an update asks for more: what it may do, confirmed. */}
        {(!running || view.state === "needsConfirmation") && (
          <section className={styles.switchOn} aria-labelledby="plugin-on">
            <h2 id="plugin-on">
              {running
                ? text.t("confirmAgainTitle")
                : text.t("switchOnInProject")}
            </h2>
            <p>
              {running
                ? text.t("updateAsksMore")
                : text.t("switchOnHint", { name: plugin.name })}
            </p>
            {!running && <p className={styles.about}>{plugin.description}</p>}
            <CapabilityCards
              capabilities={plugin.capabilities}
              network={plugin.network}
            />
            <label className={shared.confirm}>
              <input
                type="checkbox"
                checked={confirmed}
                disabled={isPending}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>{text.t("switchOnConfirm")}</span>
            </label>
            <ErrorLine message={error} />
            <div className={styles.formActions}>
              {view.state === "disabled" && (
                <Button
                  variant="text"
                  className={styles.dangerText}
                  icon={<Icon icon="lucide:trash-2" width={15} />}
                  disabled={isPending}
                  onClick={removeData}
                >
                  {text.t("deleteData")}
                </Button>
              )}
              <Button
                variant="primary"
                disabled={!confirmed || isPending}
                onClick={switchOn}
              >
                {running ? text.t("confirmAgain") : text.t("switchOn")}
              </Button>
            </div>
          </section>
        )}

        {running && viewsHref && view.views.length > 0 && (
          <section className={styles.views} aria-labelledby="plugin-views">
            <h2 id="plugin-views">{text.t("projectViews")}</h2>
            <ul>
              {view.views.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`${viewsHref}/${v.id}`}
                    className={styles.viewLink}
                  >
                    <Icon
                      icon="lucide:layout-panel-top"
                      width={16}
                      aria-hidden
                    />
                    <span>{v.title}</span>
                    <Icon icon="lucide:arrow-right" width={15} aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {running && view.fields.length > 0 && (
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            {view.fields.map((field) => (
              <Field
                key={field.key}
                field={field}
                value={values[field.key]}
                disabled={isPending}
                onChange={(v) => set(field.key, v)}
              />
            ))}
            {view.state === "active" && <ErrorLine message={error} />}
            <div className={styles.formActions}>
              {saved && (
                <span className={styles.saved} role="status">
                  <Icon icon="lucide:check" width={14} aria-hidden />
                  {text.t("settingsSaved")}
                </span>
              )}
              <Button variant="primary" type="submit" disabled={isPending}>
                {t("actions.save")}
              </Button>
            </div>
          </form>
        )}
        {running && view.fields.length === 0 && (
          <p className={styles.empty}>{text.t("noSettings")}</p>
        )}

        {running && inProject && (
          <section className={styles.danger} aria-labelledby="plugin-off">
            <h2 id="plugin-off">{text.t("offInProject")}</h2>
            <p>{text.t("offHint")}</p>
            <div className={styles.dangerActions}>
              <Button
                variant="outline"
                disabled={isPending}
                onClick={switchOff}
              >
                {text.t("switchOff")}
              </Button>
              <Button
                variant="text"
                className={styles.dangerText}
                icon={<Icon icon="lucide:trash-2" width={15} />}
                disabled={isPending}
                onClick={removeData}
              >
                {text.t("deleteData")}
              </Button>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

/** One setting, drawn by its type. */
function Field({
  field,
  value,
  disabled,
  onChange,
}: {
  field: PluginSettingField;
  value: Value;
  disabled: boolean;
  onChange: (value: Value) => void;
}) {
  const id = `setting-${field.key}`;
  if (field.type === "boolean")
    return (
      <div className={styles.switchRow}>
        <span className={styles.switchText}>
          <span className={styles.label}>{field.label}</span>
          {field.description && (
            <span className={styles.hint}>{field.description}</span>
          )}
        </span>
        <Switch
          id={id}
          label={field.label}
          labelHidden
          checked={value === true}
          disabled={disabled}
          onChange={onChange}
        />
      </div>
    );
  if (field.type === "select")
    return (
      <div className={styles.field}>
        <span className={styles.label} id={`${id}-label`}>
          {field.label}
        </span>
        <NativeSelect
          label={field.label}
          value={String(value)}
          disabled={disabled}
          onChange={onChange}
          items={[
            ...(field.default === null ? [{ value: "", label: "—" }] : []),
            ...field.options.map((o) => ({ value: o.id, label: o.label })),
          ]}
        />
        {field.description && (
          <span className={styles.hint}>{field.description}</span>
        )}
      </div>
    );
  return (
    <Input
      variant={field.type === "number" ? "number" : "text"}
      label={field.label}
      hint={field.description ?? undefined}
      value={String(value)}
      disabled={disabled}
      onChange={(e) =>
        onChange(
          field.type === "number" && e.target.value !== ""
            ? Number(e.target.value)
            : e.target.value,
        )
      }
    />
  );
}
