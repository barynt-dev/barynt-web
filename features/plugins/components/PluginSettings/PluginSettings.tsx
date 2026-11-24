"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
import { NativeSelect } from "@/components/ui/atoms/NativeSelect/NativeSelect";
import { Switch } from "@/components/ui/atoms/Switch/Switch";
import { useConfirm } from "@/components/ui/layout/ConfirmDialog/ConfirmDialog";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { GitHubConnection } from "@/features/github/components/GitHubConnection/GitHubConnection";
import { RepositoryPicker } from "@/features/github/components/RepositoryPicker/RepositoryPicker";
import {
  activatePlugin,
  deactivatePlugin,
  deletePluginData,
  saveInboundRules,
  savePluginSettings,
} from "@/features/plugins/actions";
import type {
  PluginSettingField,
  PluginSettingsView,
} from "@/features/plugins/queries";
import { Link } from "@/i18n/navigation";
import { pluginStorePath } from "@/lib/nav";
import {
  repositoryList,
  SETTING_TEXTAREA_MAX,
  type SettingValue,
} from "@/lib/plugins/settings";
import { settingsSlotId } from "@/lib/plugins/slots";
import {
  LinkRules,
  type LinkRulesValue,
  linkRulesValue,
  parseBases,
} from "../LinkRules/LinkRules";
import { PluginCredentials } from "../PluginCredentials/PluginCredentials";
import { PluginFrame } from "../PluginFrame/PluginFrame";
import { PluginInbound } from "../PluginInbound/PluginInbound";
import { PluginService } from "../PluginService/PluginService";
import { CapabilityCards } from "../PluginStore/capabilities";
import { PluginTile } from "../PluginStore/PluginTile";
import shared from "../plugins.module.scss";
import { SuggestedText } from "../SuggestedText/SuggestedText";
import { ErrorLine, usePluginText } from "../shared";
import styles from "./pluginSettings.module.scss";

// A plugin's page in a workspace or project (BARY-201). In a project it's
// where a plugin the workspace released gets switched on — confirming what
// it may do here — and off again. While it runs: the form its manifest
// declares (`contributes.settings`). What's saved is checked against the
// manifest on the server (`savePluginSettings`) — the form only offers what
// may be stored. In the workspace, switching on and off is the store's
// release; this page only holds the settings.

type Value = SettingValue;

/** What a field shows: the stored value, else the manifest's default. */
function initial(field: PluginSettingField, stored: unknown): Value {
  const value = stored ?? field.default;
  if (field.type === "boolean") return value === true;
  if (field.type === "multiselect") return Array.isArray(value) ? value : [];
  if (field.type === "repositories") return repositoryList(value);
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
  const locale = useLocale();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, Value>>(() =>
    Object.fromEntries(
      view.fields.map((f) => [f.key, initial(f, view.values[f.key])]),
    ),
  );
  // What's saved — the form has changes while `values` differ from it.
  const [savedValues, setSavedValues] = useState(values);
  // The `link` hooks' rules (BARY-227), part of the form: by hook row.
  const ruleHooks = view.inbound.filter((h) => h.rules.length > 0);
  const [rules, setRules] = useState<Record<string, LinkRulesValue>>(() =>
    Object.fromEntries(ruleHooks.map((h) => [h.id, linkRulesValue(h)])),
  );
  const [savedRules, setSavedRules] = useState(rules);
  const rulesChanged = (id: string) =>
    JSON.stringify(rules[id]) !== JSON.stringify(savedRules[id]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  // Its own settings page saves with the same button (SDK `save`), once it
  // says so — and has changes while it says that.
  const [frameSaves, setFrameSaves] = useState(false);
  const [frameUnsaved, setFrameUnsaved] = useState(false);
  const [saveRequest, setSaveRequest] = useState<{ seq: number } | null>(null);
  const saving = useRef(
    new Map<number, (r: { ok: boolean; error?: string }) => void>(),
  );
  const [confirmed, setConfirmed] = useState(false);
  const { plugin } = view;
  const inProject = scope.projectId !== null;
  const running = view.state === "active" || view.state === "needsConfirmation";
  const hasForm =
    running && view.settingsPage !== "page" && view.fields.length > 0;
  const formDirty =
    hasForm && JSON.stringify(values) !== JSON.stringify(savedValues);
  const rulesDirty = running && ruleHooks.some((h) => rulesChanged(h.id));
  const dirty = formDirty || rulesDirty || (frameSaves && frameUnsaved);
  const canSave = running && (hasForm || frameSaves || ruleHooks.length > 0);
  const storeHref = pluginStorePath(scope.workspaceId, {
    plugin: plugin.pluginId,
  });

  const ownSettings = view.settingsPage && (
    <section
      className={styles.ownSettings}
      data-part={view.settingsPage}
      aria-label={text.t("pluginSettings")}
    >
      <PluginFrame
        pluginId={plugin.pluginId}
        name={plugin.name}
        context={{
          slot: {
            kind: "settings",
            id: settingsSlotId(
              view.settingsPage === "section" ? "section" : true,
            ),
          },
          workspaceId: scope.workspaceId,
          projectId: scope.projectId,
          locale,
        }}
        saveRequest={saveRequest}
        onUnsaved={(unsaved) => {
          setFrameSaves(true);
          setFrameUnsaved(unsaved);
          if (unsaved) setSaved(false);
        }}
        onSaveDone={(seq, ok, error) => {
          saving.current.get(seq)?.({ ok, error });
          saving.current.delete(seq);
        }}
      />
    </section>
  );

  /** Has its own settings page save, and waits for how it went. */
  const saveFrame = () =>
    new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const seq = Date.now();
      saving.current.set(seq, resolve);
      setSaveRequest({ seq });
    });

  const set = (key: string, value: Value) => {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  };

  /** The Save button at the top: the form and its own page, as far as
   *  each has changes. */
  const save = () =>
    startTransition(async () => {
      if (formDirty) {
        const result = await savePluginSettings({
          pluginId: plugin.pluginId,
          ...scope,
          values,
        });
        if ("error" in result) return setError(text.error(result.error));
        setSavedValues(values);
      }
      for (const hook of ruleHooks) {
        if (!rulesChanged(hook.id)) continue;
        const value = rules[hook.id];
        const result = await saveInboundRules({
          hookId: hook.id,
          statuses: Object.fromEntries(
            hook.rules.map((r) => [r.id, value.statuses[r.id] || null]),
          ),
          bases: parseBases(value.bases),
          prComment: value.prComment,
        });
        if ("error" in result) return setError(text.error(result.error));
      }
      setSavedRules(rules);
      if (frameSaves && frameUnsaved) {
        const result = await saveFrame();
        if (!result.ok)
          return setError(result.error || text.t("settingsSaveFailed"));
      }
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
          <>
            {/* Only a workspace manager has the store. */}
            {!inProject && (
              <Link href={storeHref} className={styles.storeLink}>
                <Icon icon="lucide:store" width={15} aria-hidden />
                {text.t("openInStore")}
              </Link>
            )}
            {canSave && (
              <>
                {/* Gone as soon as something changes again — it belongs
                    to the save that's done. */}
                {saved && !dirty && (
                  <span className={styles.saved} role="status">
                    <Icon icon="lucide:check" width={14} aria-hidden />
                    {text.t("settingsSaved")}
                  </span>
                )}
                <Button
                  variant="primary"
                  disabled={!dirty || isPending}
                  onClick={save}
                >
                  {t("actions.save")}
                </Button>
              </>
            )}
          </>
        }
      />
      <div className={styles.page}>
        {/* Off here, or an update asks for more: what it may do, confirmed. */}
        {/* A workspace that only connects for its projects (BARY-238)
            has nothing to switch on. */}
        {(inProject || running) &&
          (!running || view.state === "needsConfirmation") && (
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
                service={plugin.service}
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

        {/* Its own settings page (BARY-149): its frame instead of the
            form — saving still goes through Barynt (`settings.set`). */}
        {running && view.settingsPage === "page" && (
          <>
            <ErrorLine message={error} />
            {ownSettings}
          </>
        )}

        {/* Connected first, then the repositories to pick from it. */}
        {view.connection && (running || !inProject) && (
          <GitHubConnection
            pluginId={plugin.pluginId}
            view={view.connection}
            scope={scope}
          />
        )}

        {hasForm && (
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              if (dirty) save();
            }}
          >
            {view.fields.map((field, i) => (
              <Fragment key={field.key}>
                {/* A group's heading, over the first of its settings. */}
                {field.group && field.group !== view.fields[i - 1]?.group && (
                  <GroupTitle
                    title={field.group}
                    icon={
                      view.fields.find(
                        (f) => f.group === field.group && f.groupIcon,
                      )?.groupIcon
                    }
                  />
                )}
                <Field
                  field={field}
                  value={values[field.key]}
                  disabled={isPending}
                  onChange={(v) => set(field.key, v)}
                />
              </Fragment>
            ))}
            {view.state === "active" && <ErrorLine message={error} />}
          </form>
        )}
        {/* What a pull request and its checks do to the issues they work
            on — saved with the same button. */}
        {running &&
          (["pull_request", "checks", "deployment"] as const).flatMap((group) =>
            ruleHooks.map((hook) => (
              <LinkRules
                key={`${group}-${hook.id}`}
                hook={hook}
                group={group}
                value={rules[hook.id]}
                disabled={isPending}
                onChange={(value) => {
                  setRules((r) => ({ ...r, [hook.id]: value }));
                  setSaved(false);
                }}
              />
            )),
          )}
        {running && !hasForm && ruleHooks.length > 0 && (
          <ErrorLine message={error} />
        )}
        {/* Its part below the form (BARY-204): a check, a preview, a
            picker that asks its own service. */}
        {running && view.settingsPage === "section" && ownSettings}
        {running && (
          <PluginCredentials
            pluginId={plugin.pluginId}
            credentials={view.credentials}
            scope={scope}
          />
        )}
        {running && view.service && <PluginService service={view.service} />}
        {running && <PluginInbound hooks={view.inbound} />}
        {running &&
          view.fields.length === 0 &&
          view.credentials.length === 0 &&
          !view.service &&
          view.inbound.length === 0 &&
          !view.connection && (
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

/** A group's heading, with the icon the plugin gave it. */
function GroupTitle({ title, icon }: { title: string; icon?: string }) {
  return (
    <h2 className={styles.groupTitle}>
      {icon && <Icon icon={icon} width={17} aria-hidden />}
      {title}
    </h2>
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
  if (field.type === "repositories")
    return (
      <RepositoryPicker
        field={field}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    );
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
  if (field.type === "multiselect") {
    const chosen = Array.isArray(value) ? value : [];
    return (
      <fieldset className={styles.field} disabled={disabled}>
        <legend className={styles.label}>{field.label}</legend>
        <div className={styles.choices}>
          {field.options.map((o) => (
            <button
              key={o.id}
              type="button"
              className={styles.choice}
              aria-pressed={chosen.includes(o.id)}
              onClick={() =>
                onChange(
                  chosen.includes(o.id)
                    ? chosen.filter((id) => id !== o.id)
                    : [...chosen, o.id],
                )
              }
            >
              <Icon icon="lucide:check" width={13} aria-hidden />
              {o.label}
            </button>
          ))}
        </div>
        {field.description && (
          <span className={styles.hint}>{field.description}</span>
        )}
      </fieldset>
    );
  }
  if (
    field.type === "select" ||
    field.type === "member" ||
    field.type === "label" ||
    field.type === "status"
  )
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
            // A member, label or status is always optional: the place's may
            // change.
            ...(field.default === null || field.type !== "select"
              ? [{ value: "", label: "—" }]
              : []),
            ...field.options.map((o) => ({ value: o.id, label: o.label })),
          ]}
        />
        {field.description && (
          <span className={styles.hint}>{field.description}</span>
        )}
      </div>
    );
  if (field.type === "text" && field.suggestions?.length)
    return (
      <SuggestedText
        field={field}
        value={String(value)}
        disabled={disabled}
        onChange={onChange}
      />
    );
  if (field.type === "textarea")
    return (
      <div className={styles.field}>
        <label className={styles.label} htmlFor={id}>
          {field.label}
        </label>
        <textarea
          id={id}
          className={styles.textarea}
          value={String(value)}
          rows={4}
          maxLength={SETTING_TEXTAREA_MAX}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        {field.description && (
          <span className={styles.hint}>{field.description}</span>
        )}
      </div>
    );
  return (
    <Input
      variant={
        field.type === "number"
          ? "number"
          : field.type === "url"
            ? "url"
            : "text"
      }
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
