"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Chip } from "@/components/ui/atoms/Chip/Chip";
import { Input } from "@/components/ui/atoms/Input/Input";
import {
  addPluginSource,
  checkPluginSource,
  installPlugin,
  previewRelease,
  type ReleasePreview,
  uninstallPlugin,
} from "@/features/plugins/actions";
import {
  detectProvider,
  GIT_PROVIDERS,
  type GitProvider,
  parseGitRepo,
} from "@/lib/plugins/git-hosts";
import styles from "../plugins.module.scss";
import {
  CapabilityList,
  ErrorLine,
  PluginDialog,
  PreviewStrip,
  usePluginText,
} from "../shared";

// The admin store's windows (BARY-200, from the B5 page): adding a source,
// installing a release after a look at it, uninstalling.

/** Where the code comes from: the release page, else the repository. */
export function OriginLink({
  target,
  version,
}: {
  target: Pick<InstallTarget, "repoUrl" | "releaseUrls">;
  version: string;
}) {
  const href = target.releaseUrls[version] ?? target.repoUrl;
  const label = `${(target.repoUrl ?? "").replace(/^https?:\/\//, "")}@${version}`;
  return href ? (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {label}
    </a>
  ) : (
    <span>{label}</span>
  );
}

export function AddSourceDialog({
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
  const [choice, setChoice] = useState<GitProvider | "auto">("auto");
  const [ref, setRef] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [checked, setChecked] = useState("");
  const [isPending, startTransition] = useTransition();

  // What the address says on its own; the admin may overrule it.
  const detected = guessProvider(url);
  const provider = choice === "auto" ? detected : choice;
  const host = hostOf(url, provider);
  const canAdd = !!name.trim() && !!url.trim() && !!provider && !isPending;
  const input = () => ({
    url,
    provider: choice === "auto" ? null : choice,
    ref: provider === "https" ? null : ref,
    token,
  });

  const check = () =>
    startTransition(async () => {
      setError("");
      setChecked("");
      const result = await checkPluginSource(input());
      if ("error" in result) return setError(text.error(result.error));
      setChecked(
        text.t("checkOk", {
          plugins: result.plugins,
          versions: result.versions,
        }),
      );
    });

  const add = () =>
    startTransition(async () => {
      const result = await addPluginSource({ name, ...input() });
      if ("error" in result) return setError(text.error(result.error));
      onDone();
      close();
    });

  const reset = () => {
    setChecked("");
    setError("");
  };

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
          <Button
            variant="outline"
            disabled={!url.trim() || !provider || isPending}
            onClick={check}
          >
            {text.t("checkSource")}
          </Button>
          <Button variant="primary" disabled={!canAdd} onClick={add}>
            {text.t("addSource")}
          </Button>
        </>
      }
    >
      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldLabel}>
          {text.t("sourceProvider")}
        </legend>
        <div className={styles.providers}>
          {GIT_PROVIDERS.map((p) => (
            <Chip
              key={p}
              type="filter"
              selected={provider === p}
              disabled={isPending}
              onClick={() => {
                // Clicking what the address already says goes back to
                // following the address.
                setChoice(p === detected ? "auto" : p);
                reset();
              }}
            >
              {text.t(`provider.${p}`)}
            </Chip>
          ))}
        </div>
      </fieldset>
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
        placeholder={URL_EXAMPLES[provider ?? "github"]}
        hint={
          provider
            ? text.t(
                choice === "auto" ? "providerDetected" : "providerChosen",
                {
                  provider: text.t(`provider.${provider}`),
                  how: text.t(`providerHow.${provider}`),
                },
              )
            : text.t("sourceUrlHint")
        }
        value={url}
        disabled={isPending}
        onChange={(e) => {
          setUrl(e.target.value);
          reset();
        }}
      />
      {provider !== "https" && (
        <Input
          label={text.t("sourceRef")}
          placeholder={text.t("sourceRefPlaceholder")}
          value={ref}
          disabled={isPending}
          onChange={(e) => {
            setRef(e.target.value);
            reset();
          }}
        />
      )}
      <Input
        variant="password"
        autoComplete="off"
        label={text.t("sourceToken")}
        hint={[
          text.t(`tokenHint.${provider ?? "https"}`),
          host && text.t("tokenGoesTo", { host }),
        ]
          .filter(Boolean)
          .join(" ")}
        value={token}
        disabled={isPending}
        onChange={(e) => {
          setToken(e.target.value);
          reset();
        }}
      />
      {checked && (
        <p className={styles.ok} role="status">
          <Icon icon="lucide:circle-check" width={14} />
          {checked}
        </p>
      )}
      <ErrorLine message={error} />
    </PluginDialog>
  );
}

/** What an address looks like per provider, as the field's placeholder. */
const URL_EXAMPLES: Record<GitProvider, string> = {
  github: "https://github.com/team/barynt-plugins",
  gitlab: "https://gitlab.example.com/team/barynt-plugins",
  gitea: "https://codeberg.org/team/barynt-plugins",
  bitbucket: "https://bitbucket.org/team/barynt-plugins",
  https: "https://plugins.example.com/plugins.json",
};

/** The provider an address names on its own — `null` until it does. */
function guessProvider(raw: string): GitProvider | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^[\w-]+\/[\w.-]+$/.test(value)) return "github";
  try {
    return detectProvider(new URL(value));
  } catch {
    return null;
  }
}

/** Where a token for this address would go, for the hint under the field. */
function hostOf(raw: string, provider: GitProvider | null): string | null {
  if (!provider) return null;
  const repo = parseGitRepo(raw, provider, { allowHttp: true });
  if (!repo) return null;
  if (provider === "github") return "api.github.com";
  if (provider === "bitbucket") return "api.bitbucket.org";
  return new URL(repo.origin).host;
}

/** What the install dialog needs to know about the plugin it installs. */
export interface InstallTarget {
  sourceId: string;
  sourceName: string;
  pluginId: string;
  name: string;
  /** The version installed now; `null` for a first install. */
  installed: string | null;
  repoUrl: string | null;
  releaseUrls: Record<string, string>;
}

/**
 * Loads and checks a release, shows what it is and asks for, and installs it
 * once confirmed (BARY-143, steps and previews BARY-199/200).
 */
export function InstallDialog({
  target,
  version,
  sheet,
  close,
  onDone,
}: {
  target: InstallTarget;
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
    previewRelease({
      sourceId: target.sourceId,
      pluginId: target.pluginId,
      version,
    }).then((result) =>
      "error" in result
        ? setError(text.error(result.error))
        : setPreview(result.preview),
    );
  }, [target.sourceId, target.pluginId, version, text.error]);

  const install = () =>
    preview &&
    startTransition(async () => {
      const result = await installPlugin({
        sourceId: target.sourceId,
        pluginId: target.pluginId,
        version,
        capabilities: preview.capabilities,
      });
      if ("error" in result) return setError(text.error(result.error));
      onDone();
      close();
    });

  return (
    <PluginDialog
      title={text.t("installTitle", { name: target.name })}
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
            {target.installed
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
          <ul className={styles.checks} aria-label={text.t("checksLabel")}>
            {(
              [
                "checkDownloaded",
                "checkHash",
                "checkManifest",
                "checkCompatible",
              ] as const
            ).map((key) => (
              <li key={key}>
                <Icon icon="lucide:circle-check" width={14} aria-hidden />
                {text.t(key)}
              </li>
            ))}
          </ul>
          <PreviewStrip previews={preview.previews} />
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
              <OriginLink target={target} version={version} /> ·{" "}
              {target.sourceName}
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

export function UninstallDialog({
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
