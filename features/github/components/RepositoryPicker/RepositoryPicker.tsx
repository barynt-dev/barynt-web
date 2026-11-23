"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";
import { usePluginText } from "@/features/plugins/components/shared";
import type { PluginSettingField } from "@/features/plugins/queries";
import { repositoryList } from "@/lib/plugins/settings";
import styles from "./repositoryPicker.module.scss";

// A `repositories` setting (BARY-238): what the place's GitHub connections
// reach, to tick — searchable once there are many. Without a connection, a
// field for `owner/name` per line, as before.

const SEARCH_FROM = 8;

export function RepositoryPicker({
  field,
  value,
  disabled,
  onChange,
}: {
  field: PluginSettingField;
  value: unknown;
  disabled: boolean;
  onChange: (value: string[]) => void;
}) {
  const text = usePluginText();
  const chosen = repositoryList(value);
  const [query, setQuery] = useState("");
  const [typed, setTyped] = useState(chosen.join("\n"));
  const id = `setting-${field.key}`;

  if (!field.connected)
    return (
      <div className={styles.field}>
        <label className={styles.label} htmlFor={id}>
          {field.label}
        </label>
        <textarea
          id={id}
          className={styles.textarea}
          value={typed}
          rows={3}
          placeholder="owner/repo"
          disabled={disabled}
          onChange={(e) => {
            setTyped(e.target.value);
            onChange(
              e.target.value
                .split(/[\n,]/)
                .map((x) => x.trim())
                .filter(Boolean),
            );
          }}
        />
        <span className={styles.hint}>{text.t("github.typeRepos")}</span>
      </div>
    );

  const isChosen = (name: string) =>
    chosen.some((c) => c.toLowerCase() === name.toLowerCase());
  const toggle = (name: string) =>
    onChange(
      isChosen(name)
        ? chosen.filter((c) => c.toLowerCase() !== name.toLowerCase())
        : [...chosen, name],
    );
  // Chosen once, out of reach now (another account, renamed, access taken
  // away): still shown, to untick.
  const unreachable = chosen.filter(
    (c) => !field.options.some((o) => o.id.toLowerCase() === c.toLowerCase()),
  );
  const needle = query.trim().toLowerCase();
  const shown = field.options.filter(
    (o) => !needle || o.id.toLowerCase().includes(needle),
  );

  return (
    <fieldset className={styles.field} disabled={disabled}>
      <legend className={styles.label}>{field.label}</legend>
      {field.description && (
        <span className={styles.hint}>{field.description}</span>
      )}
      {field.options.length >= SEARCH_FROM && (
        <label className={styles.search}>
          <Icon icon="lucide:search" width={15} aria-hidden />
          <input
            type="search"
            value={query}
            placeholder={text.t("github.searchRepos")}
            aria-label={text.t("github.searchRepos")}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      )}
      <ul className={styles.list}>
        {unreachable.map((name) => (
          <li key={name}>
            <label className={styles.row} data-unreachable>
              <input type="checkbox" checked onChange={() => toggle(name)} />
              <Icon icon="lucide:book-x" width={15} aria-hidden />
              <span className={styles.name}>{name}</span>
              <span className={styles.tag}>{text.t("github.unreachable")}</span>
            </label>
          </li>
        ))}
        {shown.map((o) => (
          <li key={o.id}>
            <label className={styles.row}>
              <input
                type="checkbox"
                checked={isChosen(o.id)}
                onChange={() => toggle(o.id)}
              />
              <Icon
                icon={o.private ? "lucide:lock" : "lucide:book-marked"}
                width={15}
                aria-hidden
              />
              <span className={styles.name}>{o.label}</span>
              {o.private && (
                <span className={styles.tag}>{text.t("github.private")}</span>
              )}
            </label>
          </li>
        ))}
        {shown.length === 0 && unreachable.length === 0 && (
          <li className={styles.empty}>
            {field.options.length === 0
              ? text.t("github.noRepos")
              : text.t("github.noMatch")}
          </li>
        )}
      </ul>
      <span className={styles.hint}>
        {text.t("github.chosenCount", {
          count: chosen.length,
          total: field.options.length,
        })}
        {field.failed && field.failed.length > 0 && (
          <>
            {" "}
            · {text.t("github.failed", { accounts: field.failed.join(", ") })}
          </>
        )}
      </span>
    </fieldset>
  );
}
