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
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      options.fields.map((f) => [
        f.id,
        f.value ?? (f.type === "select" ? (f.options?.[0]?.id ?? "") : ""),
      ]),
    ),
  );
  const ready = options.fields.every(
    (f) => !f.required || values[f.id]?.trim(),
  );
  const set = (id: string, value: string) =>
    setValues((v) => ({ ...v, [id]: value }));

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
                searchLabel={options.searchLabel}
                value={values[field.id] ?? ""}
                onChange={(v) => set(field.id, v)}
              />
            ) : (
              <Input
                key={field.id}
                label={field.label}
                hint={field.hint}
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
  searchLabel,
  value,
  onChange,
}: {
  field: FormField;
  searchLabel?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const labelId = useId();
  const options = field.options ?? [];
  const picked = options.find((o) => o.id === value);
  // The menu as wide as the field: measured as it's about to open.
  const [width, setWidth] = useState<number>();
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
