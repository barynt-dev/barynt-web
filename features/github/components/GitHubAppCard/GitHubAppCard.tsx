"use client";

import { Icon } from "@iconify/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
import type { GitHubAppAdminView } from "@/features/github/queries";
import storeStyles from "@/features/plugins/components/PluginStore/pluginStore.module.scss";
import { usePluginText } from "@/features/plugins/components/shared";
import styles from "./gitHubAppCard.module.scss";

// The instance's GitHub App in Admin → Plugins (BARY-238), beside a plugin
// that connects to GitHub. Creating it is GitHub's manifest flow: the form
// posts the manifest to GitHub, GitHub shows what the app may do, and
// returns to Barynt with a code for its keys.

const OUTCOMES = ["app_created", "app_failed"] as const;

/** Where the manifest goes: under an organization, or the person's own
 *  account. (`lib/github/app#newAppUrl`, without its server imports.) */
const newAppUrl = (organization: string, state: string) =>
  `https://github.com/${
    organization ? `organizations/${encodeURIComponent(organization)}/` : ""
  }settings/apps/new?state=${encodeURIComponent(state)}`;

export function GitHubAppCard({ view }: { view: GitHubAppAdminView }) {
  const text = usePluginText();
  const params = useSearchParams();
  const [organization, setOrganization] = useState("");
  const [creating, setCreating] = useState(view.app === null);
  const outcome = OUTCOMES.find((o) => o === params.get("github"));

  return (
    <section className={storeStyles.card} aria-labelledby="github-app">
      <h3 id="github-app" className={storeStyles.cardTitle}>
        <Icon icon="lucide:github" width={14} aria-hidden />
        {text.t("githubApp.title")}
      </h3>
      {outcome && (
        <p
          className={styles.outcome}
          data-tone={outcome === "app_created" ? "success" : "warning"}
          role="status"
        >
          {text.t(`githubApp.outcome.${outcome}`)}
        </p>
      )}
      {view.app && (
        <>
          <p className={styles.ready}>
            <Icon icon="lucide:circle-check" width={15} aria-hidden />
            {text.t("githubApp.ready")}
          </p>
          <a
            href={view.app.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className={styles.appLink}
          >
            {view.app.name}
            <Icon icon="lucide:external-link" width={13} aria-hidden />
          </a>
          {view.app.owner && (
            <p className={storeStyles.muted}>
              {text.t("githubApp.owner", { owner: view.app.owner })}
            </p>
          )}
          {view.app.fromEnv && (
            <p className={storeStyles.muted}>{text.t("githubApp.fromEnv")}</p>
          )}
        </>
      )}
      {!view.app && (
        <p className={storeStyles.muted}>{text.t("githubApp.missing")}</p>
      )}
      <p className={styles.webhook}>
        <span className={storeStyles.muted}>{text.t("githubApp.webhook")}</span>
        <code>{view.webhookUrl}</code>
      </p>
      {!view.app?.fromEnv &&
        (creating ? (
          <form
            method="post"
            action={newAppUrl(organization.trim(), view.state)}
            className={styles.form}
          >
            <input type="hidden" name="manifest" value={view.manifest} />
            <Input
              label={text.t("githubApp.orgLabel")}
              hint={text.t("githubApp.orgHint")}
              value={organization}
              placeholder="acme"
              onChange={(e) => setOrganization(e.target.value)}
            />
            <Button
              variant="primary"
              type="submit"
              icon={<Icon icon="lucide:github" width={15} />}
            >
              {text.t("githubApp.create")}
            </Button>
          </form>
        ) : (
          <Button variant="text" onClick={() => setCreating(true)}>
            {text.t("githubApp.recreate")}
          </Button>
        ))}
    </section>
  );
}
