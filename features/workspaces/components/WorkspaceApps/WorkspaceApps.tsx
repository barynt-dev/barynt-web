"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import { UserCell } from "@/components/ui/atoms/UserCell/UserCell";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { Table, type TableColumn } from "@/components/ui/layout/Table/Table";
import type { WorkspaceAppRow } from "@/features/plugins/queries";
import { Link } from "@/i18n/navigation";
import { useTimeAgo } from "@/lib/utils/useTimeAgo";
import styles from "./workspaceApps.module.scss";

/**
 * The bots a workspace's plugins act as (BARY-213): who wrote that comment
 * "as GitLab", where each may act, what it may do, when it was last busy.
 * Apart from the members — a bot is no member, can't sign in, can't be
 * assigned — and managed where its plugin is: its settings.
 */
export function WorkspaceApps({
  apps,
  tabs,
}: {
  /** Each with where its plugin's settings are. */
  apps: (WorkspaceAppRow & { settingsHref: string })[];
  tabs: React.ReactNode;
}) {
  const t = useTranslations("workspaceMembers");
  const timeAgo = useTimeAgo();

  const columns: TableColumn<WorkspaceAppRow & { settingsHref: string }>[] = [
    {
      id: "app",
      header: t("appColumn"),
      width: "minmax(0, 1fr)",
      cell: (row) => (
        <UserCell
          avatar={{ name: row.name, color: row.color }}
          name={row.name}
          meta={`@${row.handle}`}
        />
      ),
    },
    {
      id: "where",
      header: t("appWhere"),
      width: "160px",
      cell: (row) => row.project?.name ?? t("appWholeWorkspace"),
    },
    {
      id: "may",
      header: t("appMay"),
      width: "max-content",
      cell: (row) => t("appCapabilities", { count: row.capabilities.length }),
    },
    {
      id: "lastUsed",
      header: t("appLastUsed"),
      width: "130px",
      cell: (row) =>
        row.lastUsedAt
          ? timeAgo(new Date(row.lastUsedAt).getTime())
          : t("appNeverUsed"),
    },
    {
      id: "state",
      header: "",
      width: "max-content",
      cell: (row) => (
        <span className={styles.state} data-on={row.enabled || undefined}>
          {row.enabled ? t("appOn") : t("appOff")}
          <Link href={row.settingsHref} className={styles.manage}>
            {t("appManage")}
            <Icon icon="lucide:arrow-right" width={13} aria-hidden />
          </Link>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        divider={false}
        title={t("appsTitle")}
        count={apps.length}
        description={t("appsSubtitle")}
      />
      {tabs}
      <div className={styles.content}>
        <Table
          fill
          variant="card"
          label={t("appsTitle")}
          columns={columns}
          rows={apps}
          getRowKey={(row) => row.botUserId}
          empty={
            <EmptyState
              icon={<Icon icon="lucide:bot" width={32} />}
              title={t("appsEmptyTitle")}
              description={t("appsEmptyDesc")}
            />
          }
        />
      </div>
    </>
  );
}
