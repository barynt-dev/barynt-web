"use client";

import { Icon } from "@iconify/react";
import { useFormatter, useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { CopyField } from "@/components/ui/atoms/CopyField/CopyField";
import { Switch } from "@/components/ui/atoms/Switch/Switch";
import { setInboundRule } from "@/features/plugins/actions";
import type { PluginInboundView } from "@/features/plugins/queries";
import { LINK_RULES } from "@/lib/plugins/link";
import { usePluginText } from "../shared";
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
                  ? text.t("inbound.howtoGithub")
                  : text.t("inbound.howtoGeneric")}
            </p>
            {hook.handle === "link" && <LinkRules hook={hook} />}
          </div>
        );
      })}
    </section>
  );
}

/** A `link` hook (BARY-216): where what it reports lands, and the rules
 *  the plugin's app follows — each a switch, saved as it's flipped. */
function LinkRules({ hook }: { hook: PluginInboundView }) {
  const text = usePluginText();
  const [rules, setRule] = useOptimistic(
    hook.rules,
    (current: string[], change: { rule: string; on: boolean }) =>
      change.on
        ? [...current, change.rule]
        : current.filter((r) => r !== change.rule),
  );
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();
  const flip = (rule: string, on: boolean) =>
    startTransition(async () => {
      setRule({ rule, on });
      setFailed(false);
      const result = await setInboundRule({ hookId: hook.id, rule, on });
      if ("error" in result) setFailed(true);
    });
  return (
    <div className={styles.rules}>
      <p className={styles.howto}>{text.t("inbound.linkHint")}</p>
      <h4>{text.t("inbound.rules")}</h4>
      {LINK_RULES.map((rule) => (
        <Switch
          key={rule}
          checked={rules.includes(rule)}
          onChange={(on) => flip(rule, on)}
          label={text.t(`inbound.rule.${rule}`)}
        />
      ))}
      {failed && <p className={styles.error}>{text.t("inbound.ruleFailed")}</p>}
    </div>
  );
}
