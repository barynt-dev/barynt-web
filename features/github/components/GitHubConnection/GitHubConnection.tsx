"use client";

import { Icon } from "@iconify/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import buttonStyles from "@/components/ui/atoms/Button/button.module.scss";
import {
  connectGitHubInstallation,
  dismissGitHubChoice,
  refreshGitHubConnections,
  removePluginConnection,
} from "@/features/github/actions";
import type { PluginConnectionView } from "@/features/github/queries";
import { ErrorLine, usePluginText } from "@/features/plugins/components/shared";
import { Link } from "@/i18n/navigation";
import { RepoBadges, RepoName } from "../RepoBadges/RepoBadges";
import styles from "./gitHubConnection.module.scss";

// A plugin's connection to GitHub in a workspace or project (BARY-238): the
// accounts connected here — a workspace's count in each of its projects —
// a button that goes to GitHub, and, back from there, the installations
// the person may connect.

const OUTCOMES = [
  "connected",
  "requested",
  "failed",
  "not_yours",
  "no_app",
] as const;

export function GitHubConnection({
  pluginId,
  view,
  scope,
}: {
  pluginId: string;
  view: PluginConnectionView;
  scope: { workspaceId: string; projectId: string | null };
}) {
  const text = usePluginText();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const inProject = scope.projectId !== null;
  const outcome = OUTCOMES.find((o) => o === params.get("github"));
  const own = view.connections.filter((c) => !c.inherited);
  const inherited = view.connections.filter((c) => c.inherited);

  const run = (action: () => Promise<{ ok: true } | { error: string }>) =>
    startTransition(async () => {
      const result = await action();
      if ("error" in result) return setError(text.error(result.error));
      setError("");
      router.replace("?", { scroll: false });
      router.refresh();
    });

  const linkClass = (variant: "primary" | "outline") =>
    [
      buttonStyles.btn,
      buttonStyles[variant],
      buttonStyles.md,
      buttonStyles.hasIcon,
    ].join(" ");

  return (
    <section className={styles.section} aria-labelledby="plugin-github">
      <h2 id="plugin-github">
        <Icon icon="lucide:github" width={17} aria-hidden />
        {view.title}
      </h2>
      <p className={styles.hint}>
        {inProject
          ? text.t("github.hintProject")
          : text.t("github.hintWorkspace")}
      </p>

      {outcome && (
        <p
          className={styles.outcome}
          data-tone={outcome === "connected" ? "success" : "warning"}
          role="status"
        >
          <Icon
            icon={
              outcome === "connected" ? "lucide:circle-check" : "lucide:info"
            }
            width={15}
            aria-hidden
          />
          {text.t(`github.outcome.${outcome}`)}
        </p>
      )}

      {!view.appReady && (
        <p className={styles.notice}>
          <Icon icon="lucide:info" width={15} aria-hidden />
          {text.t("github.noApp")}
        </p>
      )}

      {view.choice && view.choice.length > 0 && (
        <div className={styles.choice}>
          <p className={styles.choiceTitle}>{text.t("github.choose")}</p>
          <ul className={styles.list}>
            {view.choice.map((i) => (
              <li key={i.id} className={styles.item}>
                <Account
                  account={i.account}
                  avatar={i.avatar}
                  meta={text.t(
                    i.accountType === "Organization"
                      ? "github.org"
                      : "github.user",
                  )}
                />
                <Button
                  variant="primary"
                  disabled={isPending}
                  onClick={() =>
                    run(() =>
                      connectGitHubInstallation({
                        pluginId,
                        ...scope,
                        installationId: i.id,
                      }),
                    )
                  }
                >
                  {text.t("github.connectThis")}
                </Button>
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <a href={view.installHref} className={linkClass("outline")}>
              <Icon icon="lucide:plus" width={15} aria-hidden />
              {text.t("github.installElsewhere")}
            </a>
            <Button
              variant="text"
              disabled={isPending}
              onClick={() => run(dismissGitHubChoice)}
            >
              {text.t("github.cancel")}
            </Button>
          </div>
        </div>
      )}

      {(own.length > 0 || inherited.length > 0) && (
        <ul className={styles.list}>
          {[...own, ...inherited].map((c) => (
            <li key={c.rowId} className={styles.item}>
              <Account
                account={c.account}
                avatar={c.avatar}
                meta={`${text.t(
                  c.accountType === "Organization"
                    ? "github.org"
                    : "github.user",
                )} · ${
                  c.broken
                    ? text.t("github.broken")
                    : c.inherited
                      ? text.t("github.fromWorkspace")
                      : text.t("github.connectedHere")
                }`}
                broken={c.broken}
              />
              <div className={styles.itemActions}>
                <a
                  href={c.manageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.manage}
                >
                  {text.t("github.manage")}
                  <Icon icon="lucide:external-link" width={13} aria-hidden />
                </a>
                {!c.inherited && (
                  <Button
                    variant="text"
                    className={styles.remove}
                    disabled={isPending}
                    onClick={() =>
                      run(() =>
                        removePluginConnection({
                          pluginId,
                          ...scope,
                          connectionId: c.rowId,
                        }),
                      )
                    }
                  >
                    {text.t("github.disconnect")}
                  </Button>
                )}
              </div>
              {c.pending.length > 0 && (
                <p className={styles.pending}>
                  <Icon icon="lucide:shield-alert" width={15} aria-hidden />
                  <span>
                    {text.t("github.pending", {
                      permissions: c.pending
                        .map((p) => permissionName(text.t, p))
                        .join(", "),
                    })}{" "}
                    <a href={c.manageUrl} target="_blank" rel="noreferrer">
                      {text.t("github.acceptOnGitHub")}
                    </a>
                  </span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Only what a working connection reaches — a broken one says so on
          its own row. */}
      {view.repositories && view.connections.some((c) => !c.broken) && (
        <RepositoryLinks repositories={view.repositories} />
      )}

      <ErrorLine message={error} />

      {view.appReady && !view.choice?.length && (
        <div className={styles.actions}>
          <a href={view.connectHref} className={linkClass("primary")}>
            <Icon icon="lucide:github" width={15} aria-hidden />
            {own.length > 0
              ? text.t("github.connectAnother")
              : inherited.length > 0
                ? text.t("github.connectOwn")
                : text.t("github.connect")}
          </a>
          {view.connections.length > 0 && (
            <Button
              variant="outline"
              icon={<Icon icon="lucide:refresh-cw" width={15} />}
              disabled={isPending}
              onClick={() =>
                run(() => refreshGitHubConnections({ pluginId, ...scope }))
              }
            >
              {text.t("github.refresh")}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function Account({
  account,
  avatar,
  meta,
  broken = false,
}: {
  account: string;
  avatar: string | null;
  meta: string;
  broken?: boolean;
}) {
  return (
    <span className={styles.account}>
      {avatar ? (
        // GitHub's own picture of the account.
        // biome-ignore lint/performance/noImgElement: a remote avatar, no optimizing needed
        <img src={avatar} alt="" className={styles.avatar} />
      ) : (
        <span className={styles.avatar} aria-hidden>
          <Icon icon="lucide:github" width={16} />
        </span>
      )}
      <span className={styles.accountText}>
        <span className={styles.accountName}>{account}</span>
        <span className={styles.meta} data-broken={broken || undefined}>
          {meta}
        </span>
      </span>
    </span>
  );
}

/** In the workspace: which project works with which repository — the
 *  linked ones first, the rest folded away. */
function RepositoryLinks({
  repositories,
}: {
  repositories: NonNullable<PluginConnectionView["repositories"]>;
}) {
  const text = usePluginText();
  const linked = repositories.filter((r) => r.projects.length > 0);
  const rest = repositories.filter((r) => r.projects.length === 0);
  const row = (r: (typeof repositories)[number]) => (
    <li key={r.fullName} className={styles.repoRow}>
      <Icon
        icon={r.archived ? "lucide:archive" : "lucide:book-marked"}
        width={16}
        className={styles.repoIcon}
        aria-hidden
      />
      <span className={styles.repoMain}>
        <span className={styles.repoLine}>
          <a
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className={styles.repoLink}
            title={text.t("github.openOnGitHub")}
          >
            <RepoName fullName={r.fullName} />
            <Icon
              icon="lucide:arrow-up-right"
              width={13}
              className={styles.repoArrow}
              aria-hidden
            />
          </a>
        </span>
        {r.description && (
          <span className={styles.repoDescription}>{r.description}</span>
        )}
      </span>
      <span className={styles.repoSide}>
        {r.projects.length > 0 && (
          <span className={styles.repoProjects}>
            {r.projects.map((p) => (
              <Link key={p.href} href={p.href} className={styles.projectChip}>
                <span
                  className={styles.dot}
                  style={{ background: p.color }}
                  aria-hidden
                />
                {p.name}
              </Link>
            ))}
          </span>
        )}
        <RepoBadges repo={r} />
      </span>
    </li>
  );
  return (
    <div className={styles.repos}>
      <h3 className={styles.reposTitle}>{text.t("github.reposTitle")}</h3>
      {linked.length > 0 ? (
        <ul className={styles.repoList}>{linked.map(row)}</ul>
      ) : (
        <p className={styles.hint}>
          {repositories.length === 0
            ? text.t("github.noRepos")
            : text.t("github.noneLinked")}
        </p>
      )}
      {rest.length > 0 && (
        <details className={styles.unlinked}>
          <summary>{text.t("github.unlinked", { count: rest.length })}</summary>
          <ul className={styles.repoList}>{rest.map(row)}</ul>
        </details>
      )}
    </div>
  );
}

/** A permission of the app, named as GitHub's settings name it. */
export function permissionName(
  t: ReturnType<typeof usePluginText>["t"],
  permission: string,
): string {
  const key = `github.permission.${permission}` as "github.permission.actions";
  return t.has(key) ? t(key) : permission;
}
