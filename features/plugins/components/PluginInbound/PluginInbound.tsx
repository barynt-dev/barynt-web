"use client";

import { Icon } from "@iconify/react";
import { useFormatter, useTranslations } from "next-intl";
import { CopyField } from "@/components/ui/atoms/CopyField/CopyField";
import type { PluginInboundView } from "@/features/plugins/queries";
import { usePluginText } from "../shared";
import { InboundRules } from "./InboundRules";
import styles from "./pluginInbound.module.scss";

/**
 * Webhooks another service sends the plugin through Barynt (BARY-215): per
 * hook, the address and secret to give GitLab or GitHub — and what came
 * last, so a setup that doesn't work shows why.
 */
export function PluginInbound({ hooks }: { hooks: PluginInboundView[] }) {
  const text = usePluginText();
  const t = useTranslations();
  const format = useFormatter();
  if (hooks.length === 0) return null;
  return (
    <section className={styles.root} aria-labelledby="plugin-inbound">
      <h2 id="plugin-inbound">{text.t("inbound.title")}</h2>
      <p className={styles.hint}>{text.t("inbound.hint")}</p>
      {hooks.map((hook) => {
        const state = !hook.last
          ? "idle"
          : hook.last.status !== null && hook.last.status < 300
            ? "ok"
            : "failing";
        return (
          <div key={hook.hookId} className={styles.hook}>
            <div className={styles.head}>
              <h3>
                <Icon
                  icon={
                    hook.provider === "gitlab"
                      ? "lucide:gitlab"
                      : hook.provider === "github"
                        ? "lucide:github"
                        : "lucide:webhook"
                  }
                  width={16}
                  aria-hidden
                />
                {hook.title}
              </h3>
              <span className={styles.state} data-state={state}>
                <span className={styles.dot} aria-hidden />
                {state === "idle"
                  ? text.t("inbound.idle")
                  : text.t("inbound.last", {
                      date: format.dateTime(hook.last?.at as Date, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }),
                      event: hook.last?.event ?? "—",
                      status: String(hook.last?.status ?? "—"),
                    })}
              </span>
            </div>
            {state === "failing" && hook.last?.error && (
              <p className={styles.error}>{hook.last.error}</p>
            )}
            <div className={styles.field}>
              <span>{text.t("inbound.url")}</span>
              <CopyField
                value={hook.url}
                copyLabel={t("apiKeys.copyLabel")}
                copiedLabel={t("apiKeys.copiedLabel")}
              />
            </div>
            {hook.secret && (
              <div className={styles.field}>
                <span>
                  {hook.provider === "gitlab"
                    ? text.t("inbound.secretGitlab")
                    : text.t("inbound.secret")}
                </span>
                <CopyField
                  value={hook.secret}
                  copyLabel={t("apiKeys.copyLabel")}
                  copiedLabel={t("apiKeys.copiedLabel")}
                />
              </div>
            )}
            <p className={styles.howto}>
              {hook.provider === "gitlab"
                ? text.t("inbound.howtoGitlab")
                : hook.provider === "github"
                  ? // Barynt reads it itself: which events it reads (BARY-226).
                    hook.handle === "link"
                    ? text.t("inbound.howtoGithubLink")
                    : text.t("inbound.howtoGithub")
                  : text.t("inbound.howtoGeneric")}
            </p>
            <InboundRules hook={hook} />
          </div>
        );
      })}
    </section>
  );
}
