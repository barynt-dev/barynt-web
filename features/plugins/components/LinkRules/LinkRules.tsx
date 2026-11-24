"use client";

import { Icon } from "@iconify/react";
import { NativeSelect } from "@/components/ui/atoms/NativeSelect/NativeSelect";
import { Switch } from "@/components/ui/atoms/Switch/Switch";
import type { PluginInboundView } from "@/features/plugins/queries";
import {
  type LinkTriggerGroup,
  linkTriggerGroup,
} from "@/lib/plugins/link-rules";
import { usePluginText } from "../shared";
import styles from "./linkRules.module.scss";

// A `link` hook's rules (BARY-227, BARY-238) as part of the settings form:
// per rule the status Barynt sets, as the plugin's app, for an issue a pull
// request works on — its key in the branch's name, or "Fixes KEY-1" — or
// whose branch's checks fail. One section per group: the pull request's
// way, with the target branches it counts for, and the checks. Saved with
// the page's Save button.

/** What the form holds for a hook: rule id → status ("" off), and the
 *  target branches as typed. */
export interface LinkRulesValue {
  statuses: Record<string, string>;
  bases: string;
  prComment: boolean;
}

export const linkRulesValue = (hook: PluginInboundView): LinkRulesValue => ({
  statuses: Object.fromEntries(hook.rules.map((r) => [r.id, r.status ?? ""])),
  bases: hook.bases.join(", "),
  prComment: hook.prComment,
});

/** The target branches as typed, as a list. */
export const parseBases = (typed: string) =>
  typed
    .split(/[,\n]/)
    .map((b) => b.trim())
    .filter(Boolean);

/** Each group's heading, icon and line under it. */
const GROUP = {
  pull_request: {
    icon: "lucide:git-pull-request",
    title: "rules.prTitle",
    hint: "rules.prHint",
  },
  checks: {
    icon: "lucide:circle-play",
    title: "rules.checksTitle",
    hint: "rules.checksHint",
  },
  deployment: {
    icon: "lucide:rocket",
    title: "rules.deployTitle",
    hint: "rules.deployHint",
  },
} as const;

export function LinkRules({
  hook,
  group,
  value,
  disabled,
  onChange,
}: {
  hook: PluginInboundView;
  group: LinkTriggerGroup;
  value: LinkRulesValue;
  disabled: boolean;
  onChange: (value: LinkRulesValue) => void;
}) {
  const text = usePluginText();
  const rules = hook.rules.filter((r) => linkTriggerGroup(r.on) === group);
  if (rules.length === 0) return null;
  const pr = group === "pull_request";
  const basesId = `rules-bases-${hook.id}`;

  return (
    <section
      className={styles.section}
      aria-labelledby={`rules-${group}-${hook.id}`}
    >
      <h2 id={`rules-${group}-${hook.id}`}>
        <Icon icon={GROUP[group].icon} width={17} aria-hidden />
        {text.t(GROUP[group].title)}
      </h2>
      <p className={styles.hint}>{text.t(GROUP[group].hint)}</p>

      {pr && hook.viaApp && (
        <div className={styles.switchRow}>
          <span className={styles.switchText}>
            <span className={styles.label}>{text.t("rules.prComment")}</span>
            <span className={styles.hint}>{text.t("rules.prCommentHint")}</span>
          </span>
          <Switch
            label={text.t("rules.prComment")}
            labelHidden
            checked={value.prComment}
            disabled={disabled}
            onChange={(prComment) => onChange({ ...value, prComment })}
          />
        </div>
      )}

      {pr && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor={basesId}>
            {text.t("rules.bases")}
          </label>
          <input
            id={basesId}
            className={styles.input}
            value={value.bases}
            placeholder="main, release/*"
            spellCheck={false}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, bases: e.target.value })}
          />
          <span className={styles.hint}>{text.t("rules.basesHint")}</span>
        </div>
      )}

      <ul className={styles.list}>
        {rules.map((rule) => {
          const status = value.statuses[rule.id] ?? "";
          return (
            <li key={rule.id} className={styles.rule} data-on={!!status}>
              <span className={styles.ruleTitle}>{rule.title}</span>
              <NativeSelect
                label={rule.title}
                value={status}
                disabled={disabled}
                onChange={(next) =>
                  onChange({
                    ...value,
                    statuses: { ...value.statuses, [rule.id]: next },
                  })
                }
                items={[
                  { value: "", label: text.t("inbound.ruleOff") },
                  ...hook.statuses.map((s) => ({
                    value: s.id,
                    label: text.t("inbound.ruleSet", { status: s.label }),
                  })),
                ]}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
