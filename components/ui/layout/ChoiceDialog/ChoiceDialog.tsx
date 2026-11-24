"use client";

import { Icon } from "@iconify/react";
import { useCallback } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { OptionButton } from "@/components/ui/atoms/OptionButton/OptionButton";
import { ModalFooter } from "@/components/ui/layout/Modal/components/ModalFooter";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import { Modal, ModalBody } from "@/components/ui/layout/Modal/Modal";
import { useModal } from "@/lib/context";
import styles from "./choiceDialog.module.scss";

export interface Choice {
  id: string;
  label: string;
  /** A second line under it. */
  hint?: string;
}

export interface ChooseOptions {
  title: string;
  choices: Choice[];
  cancelLabel: string;
  /** Before each row — `lucide:…`. */
  icon?: string;
}

/**
 * Asks to pick one of a few — like `useConfirm`, awaited:
 *
 * ```tsx
 * const choose = useChoose()
 * const id = await choose({ title, choices, cancelLabel }) // null: dismissed
 * ```
 *
 * Escape and the backdrop both count as no choice.
 */
export function useChoose() {
  const { openModal } = useModal();
  return useCallback(
    (options: ChooseOptions) =>
      new Promise<string | null>((resolve) => {
        let answered = false;
        const settle = (value: string | null) => {
          if (answered) return;
          answered = true;
          resolve(value);
        };
        openModal(
          ({ close }) => (
            <ChoiceDialog
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

function ChoiceDialog({
  options,
  onAnswer,
}: {
  options: ChooseOptions;
  onAnswer: (value: string | null) => void;
}) {
  return (
    <Modal width={440} compact>
      <ModalHeader title={options.title} divider={false} />
      <ModalBody className={styles.body}>
        <ul className={styles.list}>
          {options.choices.map((choice) => (
            <li key={choice.id}>
              <OptionButton
                icon={
                  <Icon icon={options.icon ?? "lucide:circle-dot"} width={18} />
                }
                title={choice.label}
                subtitle={choice.hint}
                onClick={() => onAnswer(choice.id)}
              />
            </li>
          ))}
        </ul>
      </ModalBody>
      <ModalFooter divider={false}>
        <Button variant="text" onClick={() => onAnswer(null)}>
          {options.cancelLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
