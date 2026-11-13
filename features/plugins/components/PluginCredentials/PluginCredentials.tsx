"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
import {
  removePluginCredential,
  savePluginCredential,
} from "@/features/plugins/actions";
import type { PluginCredentialField } from "@/features/plugins/queries";
import { ErrorLine, usePluginText } from "../shared";
import styles from "./pluginCredentials.module.scss";

// A plugin's credentials at one level (BARY-147): whether each is kept, a
// field to keep a new one, and a way to remove it. A kept value is never
// shown again — not even to whoever kept it; Barynt adds it to the plugin's
// requests to its host itself.

export function PluginCredentials({
  pluginId,
  credentials,
  scope,
  own = false,
}: {
  pluginId: string;
  credentials: PluginCredentialField[];
  scope: { workspaceId: string; projectId: string | null };
  /** A person's own credentials, in their personal settings. */
  own?: boolean;
}) {
  const text = usePluginText();
  if (credentials.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="plugin-credentials">
      <h2 id="plugin-credentials">{text.t("credentials")}</h2>
      <p className={styles.hint}>
        {own ? text.t("credentialsHintOwn") : text.t("credentialsHint")}
      </p>
      <ul className={styles.list}>
        {credentials.map((credential) => (
          <Credential
            key={credential.key}
            pluginId={pluginId}
            credential={credential}
            scope={scope}
          />
        ))}
      </ul>
    </section>
  );
}

function Credential({
  pluginId,
  credential,
  scope,
}: {
  pluginId: string;
  credential: PluginCredentialField;
  scope: { workspaceId: string; projectId: string | null };
}) {
  const t = useTranslations();
  const text = usePluginText();
  const format = useFormatter();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const kept = credential.updatedAt !== null;
  const ids = { pluginId, key: credential.key, ...scope };

  const run = (action: () => Promise<{ ok: true } | { error: string }>) =>
    startTransition(async () => {
      const result = await action();
      if ("error" in result) return setError(text.error(result.error));
      setError("");
      setValue("");
      router.refresh();
    });

  return (
    <li className={styles.item}>
      <div className={styles.head}>
        <span className={styles.label}>
          <Icon icon="lucide:key-round" width={15} aria-hidden />
          {credential.label}
        </span>
        <span className={styles.state} data-kept={kept || undefined}>
          {kept && credential.updatedAt
            ? text.t("credentialKept", {
                date: format.dateTime(new Date(credential.updatedAt), {
                  dateStyle: "medium",
                }),
              })
            : text.t("credentialMissing")}
        </span>
      </div>
      <span className={styles.meta}>
        {text.t("credentialFor", { host: credential.host })}
        {credential.description && <> · {credential.description}</>}
      </span>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) run(() => savePluginCredential({ ...ids, value }));
        }}
      >
        <Input
          variant="password"
          aria-label={credential.label}
          autoComplete="off"
          placeholder={
            kept ? text.t("credentialReplace") : text.t("credentialEnter")
          }
          value={value}
          disabled={isPending}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          variant="primary"
          type="submit"
          disabled={isPending || !value.trim()}
        >
          {t("actions.save")}
        </Button>
        {kept && (
          <Button
            variant="text"
            className={styles.remove}
            icon={<Icon icon="lucide:trash-2" width={15} />}
            disabled={isPending}
            onClick={() => run(() => removePluginCredential(ids))}
          >
            {text.t("credentialRemove")}
          </Button>
        )}
      </form>
      <ErrorLine message={error} />
    </li>
  );
}
