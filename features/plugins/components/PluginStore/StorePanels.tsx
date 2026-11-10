"use client";

import { Icon } from "@iconify/react";
import { useFormatter } from "next-intl";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Switch } from "@/components/ui/atoms/Switch/Switch";
import type {
  PluginSourceRow,
  StoreEntry,
  StoreView,
} from "@/features/plugins/queries";
import { Link } from "@/i18n/navigation";
import { usePluginText } from "../shared";
import { type StoreActions, storeHref } from "./PluginStore";
import { PluginTile } from "./PluginTile";
import styles from "./pluginStore.module.scss";

// The store's other panes: the sources, the start page next to the list,
// and the first visit, before there is any source.

/** The Git repositories the store reads, with how each one fares. */
export function SourcesPane({
  sources,
  unreadable,
  entries,
  actions,
}: {
  sources: PluginSourceRow[];
  unreadable: StoreView["unreadable"];
  entries: StoreEntry[];
  actions: StoreActions;
}) {
  const text = usePluginText();
  const format = useFormatter();
  return (
    <section className={styles.pane}>
      <Link href={storeHref({})} className={styles.back}>
        <Icon icon="lucide:chevron-left" width={18} aria-hidden />
        {text.t("allPlugins")}
      </Link>
      <header className={styles.paneHead}>
        <span className={styles.paneIcon} aria-hidden>
          <Icon icon="lucide:database" width={22} />
        </span>
        <div className={styles.headText}>
          <h2 className={styles.detailName}>{text.t("sources")}</h2>
          <span className={styles.headMeta}>{text.t("sourcesIntro")}</span>
        </div>
        <Button
          variant="outline"
          icon={<Icon icon="lucide:plus" width={15} />}
          onClick={actions.addSource}
        >
          {text.t("addSource")}
        </Button>
      </header>

      {sources.length === 0 && (
        <p className={styles.listEmpty}>{text.t("noSources")}</p>
      )}
      {sources.map((source) => {
        const error =
          unreadable.find((u) => u.sourceId === source.id)?.error ??
          source.lastSyncError;
        const listed = entries.filter((e) => e.listing?.sourceId === source.id);
        const installed = listed.filter((e) => e.installed).length;
        return (
          <article
            key={source.id}
            className={styles.sourceCard}
            data-off={!source.enabled || undefined}
          >
            <div className={styles.sourceHead}>
              <strong className={styles.sourceName}>{source.name}</strong>
              <Badge size="sm" mono={false}>
                {text.t(`provider.${source.provider}` as "provider.https")}
              </Badge>
              {source.ref && (
                <Badge size="sm">
                  <Icon icon="lucide:git-branch" width={11} /> {source.ref}
                </Badge>
              )}
              {source.private && (
                <Badge size="sm" mono={false}>
                  <Icon icon="lucide:lock" width={11} /> {text.t("private")}
                </Badge>
              )}
              <span className={styles.sourceActions}>
                <Switch
                  id={`source-on-${source.id}`}
                  label={text.t("colEnabled")}
                  labelHidden
                  checked={source.enabled}
                  disabled={actions.pending}
                  onChange={(on) => actions.toggleSource(source, on)}
                />
                <Button
                  variant="text"
                  size="sm"
                  icon={<Icon icon="lucide:refresh-cw" width={14} />}
                  disabled={!source.enabled || actions.pending}
                  onClick={() => actions.refreshSource(source)}
                >
                  {text.t("fetchNow")}
                </Button>
                <Button
                  variant="text"
                  size="sm"
                  icon={<Icon icon="lucide:trash-2" width={14} />}
                  aria-label={text.t("removeSource")}
                  title={text.t("removeSource")}
                  disabled={actions.pending}
                  onClick={() => actions.removeSource(source)}
                />
              </span>
            </div>
            <div className={styles.sourceMeta}>
              <code>{source.url}</code>
              {source.enabled && (
                <span>
                  {text.t("sourceCounts", {
                    plugins: listed.length,
                    installed,
                  })}
                </span>
              )}
              {source.lastSyncAt && (
                <span>
                  {text.t("lastSync", {
                    date: format.dateTime(source.lastSyncAt, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                  })}
                </span>
              )}
              {!source.enabled && <span>{text.t("sourceOff")}</span>}
            </div>
            {error && source.enabled && (
              <p className={styles.sourceError} role="alert">
                <Icon icon="lucide:triangle-alert" width={16} aria-hidden />
                <span>{text.error(error)}</span>
              </p>
            )}
          </article>
        );
      })}
      <p className={styles.muted}>{text.t("sourcesNote")}</p>
    </section>
  );
}

/** Next to the list when nothing is open: the numbers, and where to look. */
export function StoreHome({
  view,
  actions,
}: {
  view: StoreView;
  actions: StoreActions;
}) {
  const text = usePluginText();
  const installed = view.entries.filter((e) => e.installed);
  const tiles = [
    {
      id: "installed",
      icon: "lucide:package",
      value: installed.length,
      sub: text.t("homeActive", {
        count: installed.filter((e) => (e.installed?.activations ?? 0) > 0)
          .length,
      }),
    },
    {
      id: "updates",
      icon: "lucide:sparkles",
      value: view.entries.filter((e) => e.update).length,
      sub: text.t("homeUpdatesSub"),
    },
    {
      id: "listed",
      icon: "lucide:store",
      value: view.entries.filter((e) => !e.installed).length,
      sub: text.t("homeListedSub"),
    },
    {
      id: "sources",
      icon: "lucide:database",
      value: view.sources.length,
      sub:
        view.unreadable.length > 0
          ? text.t("sourcesUnreadable", { count: view.unreadable.length })
          : text.t("homeSourcesOk"),
    },
  ];
  const next =
    view.entries.find((e) => e.update) ??
    view.entries.find((e) => !e.installed);

  return (
    <section className={styles.home}>
      <div className={styles.kpis}>
        {tiles.map((tile) => (
          <div key={tile.id} className={styles.kpi} data-kpi={tile.id}>
            <span className={styles.kpiLabel}>
              <Icon icon={tile.icon} width={15} aria-hidden />
              {text.t(`homeKpi.${tile.id}` as "homeKpi.installed")}
            </span>
            <span className={styles.kpiValue}>{tile.value}</span>
            <span className={styles.kpiSub}>{tile.sub}</span>
          </div>
        ))}
      </div>
      {next && (
        <Link
          href={storeHref({ plugin: next.id })}
          className={styles.spotlight}
        >
          <PluginTile id={next.id} name={next.name} size="lg" />
          <span className={styles.itemText}>
            <span className={styles.spotlightKicker}>
              {next.update
                ? text.t("spotlightUpdate", { version: next.update })
                : text.t("spotlightNew")}
            </span>
            <span className={styles.itemName}>{next.name}</span>
            <span className={styles.itemSub}>{next.description}</span>
          </span>
          <Icon icon="lucide:chevron-right" width={18} aria-hidden />
        </Link>
      )}
      <p className={styles.homeHint}>
        <Icon icon="lucide:mouse-pointer-click" width={16} aria-hidden />
        {text.t("homeHint")}
      </p>
      {view.sources.length === 0 && (
        <Button variant="primary" onClick={actions.addSource}>
          {text.t("addSource")}
        </Button>
      )}
    </section>
  );
}

/** The first visit: no source yet, nothing installed. */
export function StoreWelcome({ actions }: { actions: StoreActions }) {
  const text = usePluginText();
  return (
    <section className={styles.welcome}>
      <div className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.heroKicker}>
            <Icon icon="lucide:puzzle" width={14} aria-hidden />
            {text.t("adminTitle")}
          </span>
          <h2 className={styles.heroTitle}>{text.t("welcomeTitle")}</h2>
          <p>{text.t("welcomeText")}</p>
          <div className={styles.heroActions}>
            <Button
              variant="primary"
              icon={<Icon icon="lucide:plus" width={15} />}
              onClick={actions.addSource}
            >
              {text.t("addSource")}
            </Button>
          </div>
        </div>
        <div className={styles.heroTiles} aria-hidden>
          {["git", "chat", "zeit", "sync", "kpi", "plus"].map((id) => (
            <PluginTile
              key={id}
              id={id}
              name={id === "plus" ? "+" : id}
              size="lg"
            />
          ))}
        </div>
      </div>
      <ol className={styles.steps}>
        {(["stepSource", "stepInstall", "stepEnable"] as const).map(
          (key, i) => (
            <li key={key} className={styles.stepCard}>
              <span className={styles.stepNumber}>{i + 1}</span>
              <strong>{text.t(`${key}Title`)}</strong>
              <span className={styles.muted}>{text.t(`${key}Text`)}</span>
            </li>
          ),
        )}
      </ol>
    </section>
  );
}
