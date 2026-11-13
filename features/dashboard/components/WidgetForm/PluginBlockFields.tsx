"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/atoms/Input/Input";
import { NativeSelect } from "@/components/ui/atoms/NativeSelect/NativeSelect";
import { Switch } from "@/components/ui/atoms/Switch/Switch";
import type { PluginBlockEntry } from "@/features/dashboard/types";
import type { WidgetConfig } from "@/features/dashboard/widgets";
import styles from "./blocksEditor.module.scss";

type Values = NonNullable<WidgetConfig["pluginConfig"]>;

/**
 * A plugin's building block, opened in the builder (BARY-205): the settings
 * its manifest declares for it, kept with the block. Without the plugin
 * running here, only a note — the block stays as it is.
 */
export function PluginBlockFields({
  entry,
  pluginId,
  values,
  onChange,
}: {
  entry: PluginBlockEntry | undefined;
  pluginId: string;
  values: Values;
  onChange: (values: Values) => void;
}) {
  const t = useTranslations("widgets");
  if (!entry)
    return (
      <span className={styles.help}>
        {t("pluginBlockOff", { name: pluginId })}
      </span>
    );
  const set = (key: string, value: string | number | boolean | undefined) => {
    const next = { ...values };
    if (value === undefined || value === "") delete next[key];
    else next[key] = value;
    onChange(next);
  };
  return (
    <>
      {entry.description && (
        <span className={styles.help}>{entry.description}</span>
      )}
      {entry.settings.map((s) => {
        const value = values[s.key] ?? s.default ?? undefined;
        if (s.type === "boolean")
          return (
            <div key={s.key} className={styles.field}>
              <span className={styles.fieldLabel}>{s.label}</span>
              <Switch
                label={s.label}
                checked={value === true}
                onChange={(on) => set(s.key, on)}
              />
              {s.description && (
                <span className={styles.help}>{s.description}</span>
              )}
            </div>
          );
        if (s.type === "select")
          return (
            <div key={s.key} className={styles.field}>
              <span className={styles.fieldLabel}>{s.label}</span>
              <NativeSelect
                label={s.label}
                value={String(value ?? "")}
                onChange={(v) => set(s.key, v)}
                items={[
                  ...(s.default === null ? [{ value: "", label: "—" }] : []),
                  ...s.options.map((o) => ({ value: o.id, label: o.label })),
                ]}
              />
              {s.description && (
                <span className={styles.help}>{s.description}</span>
              )}
            </div>
          );
        return (
          <Input
            key={s.key}
            variant={s.type === "number" ? "number" : "text"}
            label={s.label}
            hint={s.description ?? undefined}
            value={value === undefined ? "" : String(value)}
            onChange={(e) =>
              set(
                s.key,
                s.type === "number" && e.target.value !== ""
                  ? Number(e.target.value)
                  : e.target.value,
              )
            }
          />
        );
      })}
    </>
  );
}
