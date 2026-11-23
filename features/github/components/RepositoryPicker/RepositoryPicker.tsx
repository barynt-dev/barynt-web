"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { usePluginText } from "@/features/plugins/components/shared";
import type { PluginSettingField } from "@/features/plugins/queries";
import { repositoryList } from "@/lib/plugins/settings";
import { RepoBadges, RepoName } from "../RepoBadges/RepoBadges";
import styles from "./repositoryPicker.module.scss";

// A `repositories` setting (BARY-238): the project's repositories, each with
// what it is and a way off the list, and a menu to add one of what the
// place's GitHub connections reach — searchable. Branches go to the first.
// Without a connection, a field for `owner/name` per line, as before.

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

  const key = (name: string) => name.toLowerCase();
  const optionOf = (name: string) =>
    field.options.find((o) => key(o.id) === key(name));
  const remove = (name: string) =>
    onChange(chosen.filter((c) => key(c) !== key(name)));
  const add = (name: string) => onChange([...chosen, name]);
  // What can still be added, found by the search in the menu.
  const needle = query.trim().toLowerCase();
  const addable = field.options.filter(
    (o) =>
      !chosen.some((c) => key(c) === key(o.id)) &&
      (!needle || key(o.id).includes(needle)),
  );
  const left = field.options.filter(
    (o) => !chosen.some((c) => key(c) === key(o.id)),
  ).length;

  return (
    <fieldset className={styles.field} disabled={disabled}>
      <legend className={styles.label}>{field.label}</legend>
      {field.description && (
        <span className={styles.hint}>{field.description}</span>
      )}

      {chosen.length > 0 ? (
        <ul className={styles.list}>
          {chosen.map((name, i) => {
            const o = optionOf(name);
            return (
              <li key={name} className={styles.chosen}>
                <Icon
                  icon={o?.archived ? "lucide:archive" : "lucide:book-marked"}
                  width={16}
                  className={styles.repoIcon}
                  aria-hidden
                />
                <span className={styles.name}>
                  {o?.url ? (
                    <a
                      href={o.url}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.repoLink}
                      title={text.t("github.openOnGitHub")}
                    >
                      <RepoName fullName={name} />
                      <Icon
                        icon="lucide:arrow-up-right"
                        width={13}
                        className={styles.arrow}
                        aria-hidden
                      />
                    </a>
                  ) : (
                    <RepoName fullName={name} />
                  )}
                </span>
                {i === 0 && (
                  <span
                    className={styles.first}
                    title={text.t("github.branchesHereHint")}
                  >
                    <Icon icon="lucide:git-branch" width={12} aria-hidden />
                    {text.t("github.branchesHere")}
                  </span>
                )}
                <RepoBadges
                  repo={
                    o
                      ? {
                          visibility: o.private ? "private" : "public",
                          archived: o.archived,
                          fork: o.fork,
                        }
                      : { unreachable: true }
                  }
                />
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => remove(name)}
                  aria-label={text.t("github.removeRepo", { repo: name })}
                  title={text.t("github.removeRepo", { repo: name })}
                >
                  <Icon icon="lucide:x" width={15} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.none}>{text.t("github.noneChosen")}</p>
      )}

      <div className={styles.addRow}>
        <InlinePicker
          width={440}
          title={text.t("github.addRepo")}
          trigger={
            <Button
              type="button"
              variant="outline"
              disabled={disabled || left <= 0}
              icon={<Icon icon="lucide:plus" width={15} />}
              iconRight={<Icon icon="lucide:chevron-down" width={14} />}
            >
              {text.t("github.addRepo")}
            </Button>
          }
        >
          {(close) => (
            <div className={styles.menu}>
              <label className={styles.search}>
                <Icon icon="lucide:search" width={15} aria-hidden />
                <input
                  type="search"
                  value={query}
                  // biome-ignore lint/a11y/noAutofocus: the menu was opened to search it
                  autoFocus
                  placeholder={text.t("github.searchRepos")}
                  aria-label={text.t("github.searchRepos")}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <ul className={styles.options}>
                {addable.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      className={styles.option}
                      onClick={() => {
                        add(o.id);
                        setQuery("");
                        close();
                      }}
                    >
                      <span className={styles.name}>
                        <RepoName fullName={o.label} />
                      </span>
                      <RepoBadges
                        repo={{
                          visibility: o.private ? "private" : "public",
                          archived: o.archived,
                          fork: o.fork,
                        }}
                      />
                    </button>
                  </li>
                ))}
                {addable.length === 0 && (
                  <li className={styles.empty}>
                    {field.options.length === 0
                      ? text.t("github.noRepos")
                      : needle
                        ? text.t("github.noMatch")
                        : text.t("github.allChosen")}
                  </li>
                )}
              </ul>
            </div>
          )}
        </InlinePicker>
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
      </div>
    </fieldset>
  );
}
