"use client";

import { Icon } from "@iconify/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import buttonStyles from "@/components/ui/atoms/Button/button.module.scss";
import { FoldGroup } from "@/components/ui/layout/FoldGroup/FoldGroup";
import { unlinkGitHubAccount } from "@/features/github/actions";
import type { UserLinkView } from "@/features/github/user-link";
import { ErrorLine, usePluginText } from "@/features/plugins/components/shared";
import { Account } from "../GitHubConnection/GitHubConnection";
import styles from "../GitHubConnection/gitHubConnection.module.scss";

// A person's own GitHub account on a plugin's Personal tab (BARY-238):
// which account plugins act as — linked here, or the one they sign in
// with — and the button to GitHub to link one.

const OUTCOMES = ["linked", "failed", "no_app"] as const;

export function GitHubUserLink({ view }: { view: UserLinkView }) {
  const text = usePluginText();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const outcome = OUTCOMES.find((o) => o === params.get("github"));
  const account = view.account;
  const connectHref = `/api/github/link?back=${encodeURIComponent(pathname)}`;
  const connectClass = [
    buttonStyles.btn,
    buttonStyles[account ? "outline" : "primary"],
    buttonStyles.md,
    buttonStyles.hasIcon,
  ].join(" ");

  const unlink = () =>
    startTransition(async () => {
      const result = await unlinkGitHubAccount();
      if ("error" in result) return setError(text.error(result.error));
      setError("");
      router.replace("?", { scroll: false });
      router.refresh();
    });

  return (
    <FoldGroup
      className={styles.section}
      heading={<h2 id="plugin-github-me">{text.t("github.meTitle")}</h2>}
    >
      <p className={styles.hint}>{text.t("github.meHint")}</p>

      {outcome && (
        <p
          className={styles.outcome}
          data-tone={outcome === "linked" ? "success" : "warning"}
          role="status"
        >
          <Icon
            icon={outcome === "linked" ? "lucide:circle-check" : "lucide:info"}
            width={15}
            aria-hidden
          />
          {text.t(`github.outcome.${outcome}`)}
        </p>
      )}

      {!view.appReady && !account && (
        <p className={styles.notice}>
          <Icon icon="lucide:info" width={15} aria-hidden />
          {text.t("github.noApp")}
        </p>
      )}

      {account && (
        <ul className={styles.list}>
          <li className={styles.item}>
            <Account
              account={`@${account.login}`}
              avatar={account.avatar}
              meta={
                account.expired
                  ? text.t("github.meExpired")
                  : account.via === "login"
                    ? text.t("github.meViaLogin")
                    : text.t("github.meLinked")
              }
              broken={account.expired}
            />
            {account.via === "link" && (
              <Button
                variant="text"
                className={styles.remove}
                disabled={isPending}
                onClick={unlink}
              >
                {text.t("github.disconnect")}
              </Button>
            )}
          </li>
        </ul>
      )}

      {!account && view.signedInAs && (
        <p className={styles.notice}>
          <Icon icon="lucide:github" width={15} aria-hidden />
          {text.t("github.meSignedIn", { login: view.signedInAs })}
        </p>
      )}

      <ErrorLine message={error} />

      {view.appReady && (!account || account.expired) && (
        <div className={styles.actions}>
          <a href={connectHref} className={connectClass}>
            <Icon icon="lucide:github" width={15} aria-hidden />
            {account?.expired
              ? text.t("github.meReconnect")
              : text.t("github.meConnect")}
          </a>
        </div>
      )}
    </FoldGroup>
  );
}
