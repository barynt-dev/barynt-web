import { Icon } from "@iconify/react";
import { getTranslations } from "next-intl/server";
import buttonStyles from "@/components/ui/atoms/Button/button.module.scss";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { PluginTile } from "@/features/plugins/components/PluginStore/PluginTile";
import type { PluginsAreaPlugin } from "@/features/plugins/queries";
import { Link } from "@/i18n/navigation";
import { pluginPath } from "@/lib/nav";
import styles from "./pluginsOverview.module.scss";

/**
 * The plugins' start page (BARY-238): a card per plugin with where it can
 * be set and where it's on — the levels as links straight to their page —
 * and the way to the store for more.
 */
export async function PluginsOverview({
  workspaceId,
  plugins,
  storeHref,
}: {
  workspaceId: string;
  plugins: PluginsAreaPlugin[];
  storeHref: string | null;
}) {
  const t = await getTranslations("plugins.area");
  const storeLink = (variant: "primary" | "outline") =>
    storeHref && (
      <Link
        href={storeHref}
        className={[
          buttonStyles.btn,
          buttonStyles[variant],
          buttonStyles.md,
          buttonStyles.hasIcon,
        ].join(" ")}
      >
        <Icon icon="lucide:store" width={15} aria-hidden />
        {t("openStore")}
      </Link>
    );

  return (
    <>
      <PageHeader
        title={t("title")}
        count={plugins.length}
        actions={plugins.length > 0 && storeLink("outline")}
      />
      <div className={styles.page}>
        {plugins.length === 0 ? (
          <EmptyState
            icon={<Icon icon="lucide:puzzle" width={22} />}
            title={t("empty")}
            description={storeHref ? t("emptyHint") : t("emptyNoStore")}
            action={storeLink("primary")}
          />
        ) : (
          <>
            <p className={styles.intro}>{t("intro")}</p>
            <ul className={styles.list}>
              {plugins.map((p) => {
                const on = p.projects.filter((x) => x.on).length;
                return (
                  <li key={p.pluginId} className={styles.card}>
                    <Link
                      href={pluginPath(workspaceId, p.pluginId)}
                      className={styles.main}
                    >
                      <PluginTile id={p.pluginId} name={p.name} />
                      <span className={styles.text}>
                        <span className={styles.name}>{p.name}</span>
                        {p.description && (
                          <span className={styles.description}>
                            {p.description}
                          </span>
                        )}
                      </span>
                      <Icon
                        icon="lucide:chevron-right"
                        width={16}
                        className={styles.arrow}
                        aria-hidden
                      />
                    </Link>
                    <div className={styles.levels}>
                      {p.personal && (
                        <Link
                          href={pluginPath(workspaceId, p.pluginId, {
                            kind: "personal",
                          })}
                          className={styles.level}
                        >
                          <Icon
                            icon="lucide:circle-user"
                            width={13}
                            aria-hidden
                          />
                          {t("personal")}
                          <span className={styles.state}>
                            {t("personalHint")}
                          </span>
                        </Link>
                      )}
                      {p.projects.length > 0 && (
                        <Link
                          href={pluginPath(workspaceId, p.pluginId, {
                            kind: "project",
                            slug: (
                              p.projects.find((x) => x.on) ?? p.projects[0]
                            ).slug,
                          })}
                          className={styles.level}
                          data-on={on > 0 || undefined}
                        >
                          <Icon icon="lucide:folders" width={13} aria-hidden />
                          {t("project")}
                          <span className={styles.state}>
                            {t("projectsOn", {
                              on,
                              count: p.projects.length,
                            })}
                          </span>
                        </Link>
                      )}
                      {p.workspace && (
                        <Link
                          href={pluginPath(workspaceId, p.pluginId, {
                            kind: "workspace",
                          })}
                          className={styles.level}
                          data-on={p.workspaceOn || undefined}
                        >
                          <Icon
                            icon="lucide:building-2"
                            width={13}
                            aria-hidden
                          />
                          {t("workspace")}
                          {p.workspaceOn !== null && (
                            <span className={styles.state}>
                              {p.workspaceOn ? t("on") : t("off")}
                            </span>
                          )}
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
