"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { NativeSelect } from "@/components/ui/atoms/NativeSelect/NativeSelect";
import { setInboundRule } from "@/features/plugins/actions";
import type { PluginInboundView } from "@/features/plugins/queries";
import { ErrorLine, usePluginText } from "../shared";
import styles from "./pluginInbound.module.scss";

/**
 * A `link` hook's rules (BARY-227): per rule the status Barynt sets, as the
 * plugin's app, when a pull request that works on an issue — its key in the
 * branch's name, or "Fixes KEY-1" — is opened or merged. "—" is off.
 */
export function InboundRules({ hook }: { hook: PluginInboundView }) {
  const text = usePluginText();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  if (hook.rules.length === 0) return null;

  const save = (ruleId: string, status: string) =>
    startTransition(async () => {
      const result = await setInboundRule({
        hookId: hook.id,
        ruleId,
        status: status || null,
      });
      if ("error" in result) setError(text.error(result.error));
      else {
        setError("");
        router.refresh();
      }
    });

  return (
    <div className={styles.rules}>
      <h4>{text.t("inbound.rulesTitle")}</h4>
      <p className={styles.howto}>{text.t("inbound.rulesHint")}</p>
      {hook.rules.map((rule) => (
        <div key={rule.id} className={styles.rule} data-on={!!rule.status}>
          <span className={styles.ruleTitle}>{rule.title}</span>
          <NativeSelect
            label={rule.title}
            value={rule.status ?? ""}
            disabled={pending}
            onChange={(status) => save(rule.id, status)}
            items={[
              { value: "", label: text.t("inbound.ruleOff") },
              ...hook.statuses.map((s) => ({
                value: s.id,
                label: text.t("inbound.ruleSet", { status: s.label }),
              })),
            ]}
          />
        </div>
      ))}
      <ErrorLine message={error} />
    </div>
  );
}
