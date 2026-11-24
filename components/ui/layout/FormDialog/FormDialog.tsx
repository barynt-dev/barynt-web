"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
import { NativeSelect } from "@/components/ui/atoms/NativeSelect/NativeSelect";
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
  options?: { id: string; label: string }[];
  hint?: string;
  required?: boolean;
  /** Shown as code — a branch's name, say. */
  mono?: boolean;
}

export interface FormOptions {
  title: string;
  description?: string;
  fields: FormField[];
  submitLabel: string;
  cancelLabel: string;
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
              <div key={field.id} className={styles.field}>
                {/* The select has no label of its own: shown here, like
                    the text fields' above them. */}
                <span className={styles.label} aria-hidden>
                  {field.label}
                </span>
                <NativeSelect
                  label={field.label}
                  items={(field.options ?? []).map((o) => ({
                    value: o.id,
                    label: o.label,
                  }))}
                  value={values[field.id] ?? ""}
                  onChange={(v) => set(field.id, v)}
                />
                {field.hint && (
                  <span className={styles.hint}>{field.hint}</span>
                )}
              </div>
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
