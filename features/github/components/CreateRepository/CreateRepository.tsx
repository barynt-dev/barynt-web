"use client";

import { Icon } from "@iconify/react";
import { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
import { NativeSelect } from "@/components/ui/atoms/NativeSelect/NativeSelect";
import { SegmentedControl } from "@/components/ui/atoms/SegmentedControl/SegmentedControl";
import { ModalFooter } from "@/components/ui/layout/Modal/components/ModalFooter";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import { Modal, ModalBody } from "@/components/ui/layout/Modal/Modal";
import { createGitHubRepository } from "@/features/github/actions";
import { ErrorLine, usePluginText } from "@/features/plugins/components/shared";
import type { RepositoryAccount } from "@/features/plugins/settings-options";
import { useModal } from "@/lib/context";
import styles from "./createRepository.module.scss";

// "New repository" in a plugin's GitHub settings (BARY-238): in one of the
// place's connected accounts, with a name, a line about it and whether it's
// private. Answers with what was created.

export interface CreatedRepository {
  fullName: string;
  /** The app doesn't see it yet — added on GitHub by its owner. */
  notShared: boolean;
}

interface Place {
  pluginId: string;
  workspaceId: string;
  projectId: string | null;
}

/** Opens the window; `null` when it's closed without one. */
export function useCreateRepository() {
  const { openModal } = useModal();
  return useCallback(
    (place: Place, accounts: RepositoryAccount[]) =>
      new Promise<CreatedRepository | null>((resolve) => {
        let done = false;
        const settle = (value: CreatedRepository | null) => {
          if (done) return;
          done = true;
          resolve(value);
        };
        openModal(
          ({ close }) => (
            <CreateRepositoryDialog
              place={place}
              accounts={accounts}
              onDone={(value) => {
                settle(value);
                close();
              }}
            />
          ),
          { label: "GitHub", onClose: () => settle(null) },
        );
      }),
    [openModal],
  );
}

function CreateRepositoryDialog({
  place,
  accounts,
  onDone,
}: {
  place: Place;
  accounts: RepositoryAccount[];
  onDone: (value: CreatedRepository | null) => void;
}) {
  const text = usePluginText();
  // An organization first: that's where a team's repositories live.
  const [account, setAccount] = useState(
    (accounts.find((a) => a.accountType === "Organization") ?? accounts[0])
      ?.id ?? "",
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const owner = accounts.find((a) => a.id === account)?.account ?? "";

  const create = () =>
    startTransition(async () => {
      const result = await createGitHubRepository({
        ...place,
        installationId: account,
        name,
        description,
        private: visibility === "private",
      });
      if ("error" in result) return setError(text.error(result.error));
      onDone({ fullName: result.fullName, notShared: !!result.notShared });
    });

  return (
    <Modal width={480} compact>
      <ModalHeader title={text.t("github.newRepoTitle")} divider={false} />
      <ModalBody>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && account) create();
          }}
        >
          {accounts.length > 1 && (
            <NativeSelect
              label={text.t("github.newRepoOwner")}
              items={accounts.map((a) => ({
                value: a.id,
                label: `${a.account} · ${text.t(
                  a.accountType === "Organization"
                    ? "github.org"
                    : "github.user",
                )}`,
              }))}
              value={account}
              onChange={setAccount}
              disabled={isPending}
            />
          )}
          <Input
            label={text.t("github.newRepoName")}
            value={name}
            // biome-ignore lint/a11y/noAutofocus: the window was opened to name one
            autoFocus
            prefix={<span className={styles.owner}>{owner}/</span>}
            placeholder="web-app"
            disabled={isPending}
            onChange={(e) => setName(e.target.value.replace(/\s+/g, "-"))}
          />
          <Input
            label={text.t("github.newRepoDescription")}
            value={description}
            disabled={isPending}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className={styles.visibility}>
            <SegmentedControl
              items={[
                {
                  value: "private",
                  label: text.t("github.newRepoPrivate"),
                  icon: <Icon icon="lucide:lock" width={14} />,
                },
                {
                  value: "public",
                  label: text.t("github.newRepoPublic"),
                  icon: <Icon icon="lucide:globe" width={14} />,
                },
              ]}
              value={visibility}
              onChange={(v) => setVisibility(v as "private" | "public")}
            />
            <span className={styles.hint}>{text.t("github.newRepoHint")}</span>
          </div>
          <ErrorLine message={error} />
        </form>
      </ModalBody>
      <ModalFooter divider={false}>
        <Button variant="text" onClick={() => onDone(null)}>
          {text.t("github.cancel")}
        </Button>
        <Button
          variant="primary"
          disabled={!name.trim() || !account || isPending}
          onClick={create}
        >
          {text.t("github.newRepoCreate")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
