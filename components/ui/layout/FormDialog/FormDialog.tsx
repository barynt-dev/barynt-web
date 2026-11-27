"use client";

import { Icon } from "@iconify/react";
import { useCallback, useId, useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { Input } from "@/components/ui/atoms/Input/Input";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { ModalFooter } from "@/components/ui/layout/Modal/components/ModalFooter";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import { Modal, ModalBody } from "@/components/ui/layout/Modal/Modal";
import { useModal } from "@/lib/context";
import styles from "./formDialog.module.scss";

export interface FormField {
  id: string;
  label: string;
  type: "text" | "select";
  value?: string;
  /** `select`: what to pick from — a note on the right ("Default"). */
  options?: { id: string; label: string; hint?: string }[];
  hint?: string;
  required?: boolean;
  /** Shown as code — a branch's name, say (a select's options too). */
  mono?: boolean;
  /** Checked as it's typed: a value matching one of these is wrong — its
   *  message shows under the field, and the window doesn't go on. */
  invalid?: { pattern: string; message: string }[];
  /** Values it can't have (a name that's taken), and what to say then. */
  taken?: { values: string[]; message: string };
  /** Another field (a select) it follows: `per` that field's value — its
   *  options, what's taken, the value it starts with. */
  dependsOn?: string;
  per?: Record<
    string,
    {
      options?: { id: string; label: string; hint?: string }[];
      taken?: string[];
      value?: string;
    }
  >;
}

/** A field as it is for what's picked in the one it follows. */
function current(field: FormField, values: Record<string, string>) {
  const per = field.dependsOn
    ? field.per?.[values[field.dependsOn] ?? ""]
    : undefined;
  return {
    options: per?.options ?? field.options ?? [],
    taken: per?.taken ?? field.taken?.values ?? [],
  };
}

/** What's wrong with a field's value, if anything — said as the plugin
 *  says it. */
function problem(
  field: FormField,
  values: Record<string, string>,
): string | null {
  const value = values[field.id] ?? "";
  if (field.type !== "text" || !value) return null;
  for (const rule of field.invalid ?? []) {
    try {
      if (new RegExp(rule.pattern, "u").test(value)) return rule.message;
    } catch {}
  }
  if (field.taken && current(field, values).taken.includes(value.trim()))
    return field.taken.message;
  return null;
}

export interface FormOptions {
  title: string;
  description?: string;
  fields: FormField[];
  submitLabel: string;
  cancelLabel: string;
  /** A long select's search field. */
  searchLabel?: string;
  /** Its button in red — the answer costs something. */
  danger?: boolean;
}

/**
 * A few fields in a window, awaited — like `useConfirm`, with values:
 *
 * ```tsx
 * const ask = useForm()
 * const values = await ask({ title, fields, submitLabel, cancelLabel })
 * // null: dismissed
 * ```
 *
 * Without fields it's a confirmation. Escape and the backdrop count as
 * dismissed.
 */
export function useForm() {
  const { openModal } = useModal();
  return useCallback(
    (options: FormOptions) =>
      new Promise<Record<string, string> | null>((resolve) => {
        let answered = false;
        const settle = (value: Record<string, string> | null) => {
          if (answered) return;
          answered = true;
          resolve(value);
        };
        openModal(
          ({ close }) => (
            <FormDialog
              options={options}
              onAnswer={(value) => {
                settle(value);
                close();
              }}
            />
          ),
          { label: options.title, onClose: () => settle(null) },
        );
      }),
    [openModal],
  );
}

function FormDialog({
  options,
  onAnswer,
}: {
  options: FormOptions;
  onAnswer: (value: Record<string, string> | null) => void;
}) {
  // What a field starts with: its own value, its `per` one, else a
  // select's first option.
  const start = (f: FormField, vals: Record<string, string>) =>
    (f.dependsOn ? f.per?.[vals[f.dependsOn] ?? ""]?.value : undefined) ??
    f.value ??
    (f.type === "select" ? (current(f, vals).options[0]?.id ?? "") : "");
  const [values, setValues] = useState<Record<string, string>>(() => {
    const vals: Record<string, string> = {};
    for (const f of options.fields) vals[f.id] = start(f, vals);
    return vals;
  });
  const problems = Object.fromEntries(
    options.fields.map((f) => [f.id, problem(f, values)]),
  );
  const ready = options.fields.every(
    (f) => (!f.required || values[f.id]?.trim()) && !problems[f.id],
  );
  // A field that follows this one starts again from what's picked.
  const set = (id: string, value: string) =>
    setValues((v) => {
      const next = { ...v, [id]: value };
      for (const f of options.fields)
        if (f.dependsOn === id && f.type === "select")
          next[f.id] = start(f, next);
      return next;
    });

  return (
    <Modal width={480} compact>
      <ModalHeader title={options.title} divider={false} />
      <ModalBody className={styles.body}>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) onAnswer(values);
          }}
        >
          {options.description && (
            <p className={styles.description}>{options.description}</p>
          )}
          {options.fields.map((field, i) =>
            field.type === "select" ? (
              <SelectField
                key={field.id}
                field={field}
                options={current(field, values).options}
                searchLabel={options.searchLabel}
                value={values[field.id] ?? ""}
                onChange={(v) => set(field.id, v)}
              />
            ) : (
              <Input
                key={field.id}
                label={field.label}
                hint={problems[field.id] ? undefined : field.hint}
                error={problems[field.id] ?? undefined}
                value={values[field.id] ?? ""}
                className={field.mono ? styles.mono : undefined}
                // biome-ignore lint/a11y/noAutofocus: the window was opened to fill it in
                autoFocus={
                  i === options.fields.findIndex((f) => f.type === "text")
                }
                onChange={(e) => set(field.id, e.target.value)}
              />
            ),
          )}
          {/* Enter submits. */}
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      </ModalBody>
      <ModalFooter divider={false}>
        <Button variant="text" onClick={() => onAnswer(null)}>
          {options.cancelLabel}
        </Button>
        <Button
          variant="primary"
          className={options.danger ? styles.danger : undefined}
          disabled={!ready}
          onClick={() => onAnswer(values)}
        >
          {options.submitLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

/** Past this many options, the menu has a search. */
const SEARCH_FROM = 7;

/**
 * A select as Barynt draws its own: a field that opens its menu — with a
 * search for a long list (a repository's branches) and each option's note
 * on the right.
 */
function SelectField({
  field,
  options,
  searchLabel,
  value,
  onChange,
}: {
  field: FormField;
  options: { id: string; label: string; hint?: string }[];
  searchLabel?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const labelId = useId();
  // The menu as wide as the field: measured as it's about to open.
  const [width, setWidth] = useState<number>();
  const picked = options.find((o) => o.id === value);
  // One to pick from is no choice: shown as it is.
  if (options.length === 1)
    return (
      <div className={styles.field}>
        <span id={labelId} className={styles.label}>
          {field.label}
        </span>
        <div
          className={styles.select}
          data-static
          data-mono={field.mono || undefined}
        >
          <span className={styles.selectValue}>{options[0].label}</span>
          {options[0].hint && (
            <span className={styles.selectHint}>{options[0].hint}</span>
          )}
        </div>
        {field.hint && <span className={styles.hint}>{field.hint}</span>}
      </div>
    );
  const measure = (e: React.SyntheticEvent<HTMLElement>) =>
    setWidth(e.currentTarget.offsetWidth);
  return (
    <div
      className={styles.field}
      onPointerDownCapture={measure}
      onFocusCapture={measure}
    >
      <span id={labelId} className={styles.label}>
        {field.label}
      </span>
      <InlinePicker
        title={field.label}
        width={width}
        stop
        trigger={
          <button
            type="button"
            className={styles.select}
            data-mono={field.mono || undefined}
            aria-labelledby={labelId}
            aria-haspopup="listbox"
          >
            <span className={styles.selectValue}>{picked?.label ?? ""}</span>
            {picked?.hint && (
              <span className={styles.selectHint}>{picked.hint}</span>
            )}
            <Icon icon="lucide:chevron-down" width={15} aria-hidden />
          </button>
        }
      >
        {(close) => (
          <SelectMenu
            items={options.map((o) => ({
              value: o.id,
              label: o.label,
              ...(o.hint && { hint: o.hint }),
            }))}
            value={value}
            searchable={options.length >= SEARCH_FROM}
            placeholder={searchLabel}
            checkMark
            onPick={(v) => {
              onChange(String(v ?? ""));
              close();
            }}
            onClose={close}
          />
        )}
      </InlinePicker>
      {field.hint && <span className={styles.hint}>{field.hint}</span>}
    </div>
  );
}
