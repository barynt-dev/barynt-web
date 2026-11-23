"use client";

import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import type { PluginSettingField } from "@/features/plugins/queries";
import { usePluginText } from "../shared";
import styles from "./suggestedText.module.scss";

// A `text` setting with ready-made values (`suggestions` in the manifest):
// the field, free to type in, and beside it a menu of the suggestions —
// each with its name, the value and what it gives. Picking one fills the
// field; the one it holds is marked.

export function SuggestedText({
  field,
  value,
  disabled,
  onChange,
}: {
  field: PluginSettingField;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const text = usePluginText();
  const id = `setting-${field.key}`;
  const suggestions = field.suggestions ?? [];

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {field.label}
      </label>
      <div className={styles.row}>
        <input
          id={id}
          className={styles.input}
          value={value}
          disabled={disabled}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
        <InlinePicker
          width={420}
          align="end"
          title={text.t("suggestionsTitle")}
          trigger={
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              icon={<Icon icon="lucide:sparkles" width={15} />}
              iconRight={<Icon icon="lucide:chevron-down" width={14} />}
            >
              {text.t("suggestions")}
            </Button>
          }
        >
          {(close) => (
            <ul className={styles.menu}>
              {suggestions.map((s) => {
                const current = s.value === value;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={styles.option}
                      aria-current={current || undefined}
                      onClick={() => {
                        onChange(s.value);
                        close();
                      }}
                    >
                      <span className={styles.check} aria-hidden>
                        {current && <Icon icon="lucide:check" width={15} />}
                      </span>
                      <span className={styles.text}>
                        <span className={styles.name}>
                          {s.label}
                          {current && (
                            <span className={styles.current}>
                              {text.t("suggestionCurrent")}
                            </span>
                          )}
                        </span>
                        <code className={styles.value}>{s.value}</code>
                        {s.hint && (
                          <span className={styles.hint}>{s.hint}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </InlinePicker>
      </div>
      {field.description && (
        <span className={styles.description}>{field.description}</span>
      )}
    </div>
  );
}
