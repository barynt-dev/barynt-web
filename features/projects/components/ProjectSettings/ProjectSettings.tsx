"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";
import { AvatarUploader } from "@/components/ui/atoms/AvatarUploader/AvatarUploader";
import { Button } from "@/components/ui/atoms/Button/Button";
import { ColorPicker } from "@/components/ui/atoms/ColorPicker/ColorPicker";
import { CopyField } from "@/components/ui/atoms/CopyField/CopyField";
import { Input } from "@/components/ui/atoms/Input/Input";
import { SegmentedControl } from "@/components/ui/atoms/SegmentedControl/SegmentedControl";
import { FoldGroup } from "@/components/ui/layout/FoldGroup/FoldGroup";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { SettingsIdentity } from "@/components/ui/layout/SettingsIdentity/SettingsIdentity";
import { Table, type TableColumn } from "@/components/ui/layout/Table/Table";
import {
  confirmProjectAvatarUpload,
  deleteProject,
  removeProjectAvatar,
  requestProjectAvatarUploadUrl,
  updateProject,
} from "@/features/projects/actions";
import type {
  ProjectSettingsView,
  ProjectVisibility,
} from "@/features/projects/types";
import { useRouter } from "@/i18n/navigation";
import styles from "./projectSettings.module.scss";

interface Props extends ProjectSettingsView {
  workspaceId: string;
  /** The project's absolute address — already assembled by the server. */
  projectUrl: string;
}

/** A setting as a row: what it's about, what it means, and how you change it. */
interface SettingRow {
  id: string;
  label: string;
  desc: ReactNode;
  control: ReactNode;
}

/**
 * Two columns for every setting — the same table as under Labels and Roles.
 * The definition needs neither translation nor state and therefore lives
 * outside the component.
 *
 * Left, what it's about (label above explanation); right, how you change
 * it. The explanation takes the free space; every control sits at the same
 * fixed width (`.control`), so the right edges form a line.
 */
const COLUMNS: TableColumn<SettingRow>[] = [
  {
    id: "setting",
    width: "minmax(0, 1fr)",
    cell: (row) => (
      <div className={styles.setting}>
        <span className={styles.label}>{row.label}</span>
        <span className={styles.desc}>{row.desc}</span>
      </div>
    ),
  },
  {
    id: "control",
    width: "minmax(280px, max-content)",
    align: "end",
    cell: (row) => row.control,
  },
];

/**
 * A project's core data: name, prefix, color, visibility, delete.
 *
 * What someone is allowed to do arrives ready-made from the server
 * (`canUpdate`, `canDelete`) — the fields here don't reimplement permission
 * rules. Without `canUpdate` the page stays readable: it shows what applies,
 * just not changeable.
 *
 * Structured like the rest of the settings sections: header with the action
 * on the right, lists in cards below, headings in between. The three text
 * fields share the save button in the page header: whoever changes a prefix
 * usually checks the name at the same time too, and three separate buttons
 * would need three round trips to the server for that. Visibility has none
 * — it's a toggle, and a toggle that only takes effect via "Save" looks like
 * it already took effect.
 */
export function ProjectSettings({
  project,
  canUpdate,
  canDelete,
  workspaceId,
  projectUrl,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.desc);
  const [prefix, setPrefix] = useState(project.prefix);
  const [color, setColor] = useState(project.color);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty =
    name.trim() !== project.name ||
    desc.trim() !== project.desc ||
    prefix !== project.prefix ||
    color !== project.color;

  const run = (
    action: () => Promise<{ ok: true } | { error: string }>,
    after: () => void,
  ) =>
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError("");
      after();
    });

  const save = () =>
    run(
      () =>
        updateProject(project.id, { name: name.trim(), desc, prefix, color }),
      () => {
        setSaved(true);
        router.refresh();
      },
    );

  const setVisibility = (next: ProjectVisibility) =>
    run(
      () => updateProject(project.id, { visibility: next }),
      () => router.refresh(),
    );

  const remove = () =>
    run(
      () => deleteProject(project.id),
      () => router.push(`/${workspaceId}/projects`),
    );

  const touch = () => setSaved(false);

  const general: SettingRow[] = [
    // The slug appears in every URL of the project and doesn't change with
    // the name — otherwise every shared link would break. That's why it's
    // shown here for reference and copying, not as an editable field.
    {
      id: "url",
      label: t("projectSettings.url"),
      desc: t("projectSettings.urlDesc"),
      control: (
        <div className={`${styles.control} ${styles.urlControl}`}>
          <CopyField
            value={projectUrl}
            copyLabel={t("actions.copyLink")}
            copiedLabel={t("actions.linkCopied")}
          />
        </div>
      ),
    },
  ];

  const visibility: SettingRow[] = [
    {
      id: "visibility",
      label:
        project.visibility === "public"
          ? t("projectSettings.publicTitle")
          : t("projectSettings.privateTitle"),
      desc:
        project.visibility === "public"
          ? t("projectSettings.publicDesc")
          : t("projectSettings.privateDesc"),
      control: canUpdate && (
        <SegmentedControl
          items={[
            { value: "public", label: t("projectSettings.public") },
            { value: "private", label: t("projectSettings.private") },
          ]}
          value={project.visibility}
          onChange={(v) => setVisibility(v as ProjectVisibility)}
        />
      ),
    },
  ];

  const danger: SettingRow[] = [
    {
      id: "delete",
      label: t("projectSettings.deleteTitle"),
      desc: t("projectSettings.deleteDesc", { count: project.issueCount }),
      control: confirmDelete ? (
        <div className={styles.confirm}>
          <Button
            variant="text"
            disabled={isPending}
            onClick={() => setConfirmDelete(false)}
          >
            {t("actions.cancel")}
          </Button>
          <Button
            variant="outline"
            className={styles.deleteButton}
            disabled={isPending}
            onClick={remove}
          >
            {t("projectSettings.deleteConfirm")}
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          className={styles.deleteButton}
          icon={<Icon icon="lucide:trash-2" width={14} />}
          onClick={() => setConfirmDelete(true)}
        >
          {t("actions.delete")}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.general")}
        description={t("projectSettings.generalDesc")}
        actions={
          canUpdate && (
            <>
              {/* Disappears as soon as something changes again — the
                  confirmation belongs to the completed action. */}
              {saved && !dirty && (
                <span className={styles.saved}>
                  <Icon icon="lucide:check" width={14} />
                  {t("projectSettings.saved")}
                </span>
              )}
              <Button
                variant="primary"
                disabled={!dirty || !name.trim() || isPending}
                onClick={save}
              >
                {t("actions.save")}
              </Button>
            </>
          )
        }
      />

      <div className={styles.content}>
        {error && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {error}
          </p>
        )}

        <SettingsIdentity
          avatar={
            <AvatarUploader
              avatar={{ name, color, image: project.avatarUrl ?? undefined }}
              shape="square"
              disabled={!canUpdate || isPending}
              removeLabel={t("projectSettings.removeAvatar")}
              onRequestUpload={(input) =>
                requestProjectAvatarUploadUrl(project.id, input)
              }
              onConfirmUpload={(key) =>
                confirmProjectAvatarUpload(project.id, key)
              }
              onRemove={
                canUpdate ? () => removeProjectAvatar(project.id) : undefined
              }
              onDone={() => router.refresh()}
            />
          }
        >
          <Input
            label={t("fields.name")}
            value={name}
            disabled={!canUpdate || isPending}
            onChange={(e) => {
              setName(e.target.value);
              touch();
            }}
          />
          <Input
            label={t("fields.description")}
            placeholder={t("projects.descPlaceholder")}
            value={desc}
            disabled={!canUpdate || isPending}
            onChange={(e) => {
              setDesc(e.target.value);
              touch();
            }}
          />
          <Input
            label={t("projects.identifier")}
            hint={`${t("projects.example")} ${prefix || "WEB"}-123`}
            value={prefix}
            spellCheck={false}
            maxLength={4}
            disabled={!canUpdate || isPending}
            onChange={(e) => {
              setPrefix(
                e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(),
              );
              touch();
            }}
          />
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t("fields.color")}</span>
            {canUpdate ? (
              <ColorPicker
                value={color}
                onChange={(next) => {
                  setColor(next);
                  touch();
                }}
              />
            ) : (
              // Without write access, all that's left of the color picker is the color.
              <span
                role="img"
                className={styles.colorProof}
                style={{ background: color }}
                aria-label={color}
              />
            )}
          </div>
        </SettingsIdentity>

        <Table
          variant="card"
          label={t("nav.general")}
          columns={COLUMNS}
          rows={general}
          getRowKey={(row) => row.id}
        />

        <FoldGroup
          heading={
            <h2 className={styles.groupTitle}>
              {t("projectSettings.visibility")}
            </h2>
          }
        >
          {/* Sits above the card, not inside it: the sentence explains the
              toggle's boundary, not its function. */}
          <p className={styles.groupDesc}>
            {t("projectSettings.visibilityNote", {
              count: project.memberCount,
            })}
          </p>
          <Table
            variant="card"
            label={t("projectSettings.visibility")}
            columns={COLUMNS}
            rows={visibility}
            getRowKey={(row) => row.id}
          />
        </FoldGroup>

        {canDelete && (
          <FoldGroup
            heading={
              <h2 className={`${styles.groupTitle} ${styles.dangerTitle}`}>
                {t("projectSettings.dangerZone")}
              </h2>
            }
          >
            <Table
              variant="card"
              className={styles.dangerCard}
              label={t("projectSettings.dangerZone")}
              columns={COLUMNS}
              rows={danger}
              getRowKey={(row) => row.id}
            />
          </FoldGroup>
        )}
      </div>
    </>
  );
}
