"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Chip } from "@/components/ui/atoms/Chip/Chip";
import { Input } from "@/components/ui/atoms/Input/Input";
import { useConfirm } from "@/components/ui/layout/ConfirmDialog/ConfirmDialog";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import {
  type PluginResult,
  refreshPluginSource,
  removePluginSource,
  rollbackPlugin,
  setPluginBlocked,
  updatePluginSource,
} from "@/features/plugins/actions";
import type {
  PluginPlace,
  PluginSourceRow,
  StoreEntry,
  StoreView,
} from "@/features/plugins/queries";
import { Link } from "@/i18n/navigation";
import { useModal } from "@/lib/context";
import { adminPath } from "@/lib/nav";
import { PHONE_QUERY, useMediaQuery } from "@/lib/utils/useMediaQuery";
import { ErrorLine, usePluginText } from "../shared";
import {
  AddSourceDialog,
  InstallDialog,
  type InstallTarget,
  UninstallDialog,
} from "./dialogs";
import { PluginDetail } from "./PluginDetail";
import { PluginTile } from "./PluginTile";
import styles from "./pluginStore.module.scss";
import { StoreHome } from "./StoreHome";
import { SourcesPane, StoreWelcome } from "./StorePanels";
import type { StoreTab } from "./tabs";

// The admin plugin store (BARY-200, design "Option B"): a list of every
// plugin — what needs attention, what's installed, what the sources offer —
// next to the one that's open, with its overview, capabilities, versions and
// where it's on. What's open lives in the address (`?plugin=`, `?tab=`,
// `?view=sources`), so it survives a reload and the back button works. On a
// phone the list and the plugin are two screens.

export const STORE_PATH = "/admin/plugins";

/** The store's address for a plugin and tab, or the sources. */
export function storeHref(to: {
  plugin?: string;
  tab?: StoreTab;
  sources?: boolean;
  /** Narrows the list and the start page's "All plugins" to a category. */
  category?: string;
}) {
  const params = new URLSearchParams();
  if (to.sources) params.set("view", "sources");
  if (to.plugin) params.set("plugin", to.plugin);
  if (to.tab && to.tab !== "overview") params.set("tab", to.tab);
  if (to.category) params.set("category", to.category);
  const query = params.toString();
  const path = query ? `${STORE_PATH}?${query}` : STORE_PATH;
  // Straight to the plugins of the category on the start page.
  return to.category && !to.plugin ? `${path}#all-plugins` : path;
}

/** What the panes can do; the store runs it and shows what went wrong. */
export interface StoreActions {
  pending: boolean;
  install: (entry: StoreEntry, version: string) => void;
  block: (entry: StoreEntry, blocked: boolean) => void;
  rollback: (entry: StoreEntry) => void;
  uninstall: (entry: StoreEntry) => void;
  addSource: () => void;
  removeSource: (source: PluginSourceRow) => void;
  refreshSource: (source: PluginSourceRow) => void;
  toggleSource: (source: PluginSourceRow, enabled: boolean) => void;
}

type Filter = "all" | "installed" | "updates" | "blocked";

export function PluginStore({
  view,
  selected,
  tab,
  sourcesOpen,
  places,
  category = null,
}: {
  view: StoreView;
  selected: StoreEntry | null;
  tab: StoreTab;
  sourcesOpen: boolean;
  places: PluginPlace[] | null;
  /** From the address (`?category=`): the list shows only that category. */
  category?: string | null;
}) {
  const t = useTranslations();
  const text = usePluginText();
  const router = useRouter();
  const confirm = useConfirm();
  const { openModal } = useModal();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const modal = isPhone ? { placement: "bottom" as const } : {};
  const refresh = () => router.refresh();

  const run = (action: () => Promise<PluginResult<object>>) =>
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setError(text.error(result.error));
      else {
        setError("");
        refresh();
      }
    });

  const targetOf = (entry: StoreEntry): InstallTarget | null =>
    entry.listing && {
      sourceId: entry.listing.sourceId,
      sourceName: entry.listing.sourceName,
      pluginId: entry.id,
      name: entry.name,
      installed: entry.installed?.version ?? null,
      repoUrl: entry.listing.repoUrl,
      releaseUrls: entry.listing.releaseUrls,
    };

  const actions: StoreActions = {
    pending: isPending,
    install: (entry, version) => {
      const target = targetOf(entry);
      if (!target) return;
      openModal(
        ({ close }) => (
          <InstallDialog
            target={target}
            version={version}
            sheet={isPhone}
            close={close}
            onDone={refresh}
          />
        ),
        { ...modal, label: text.t("installTitle", { name: entry.name }) },
      );
    },
    block: async (entry, blocked) => {
      if (blocked) {
        const ok = await confirm({
          title: text.t("blockTitle", { name: entry.name }),
          description: text.t("blockDesc"),
          confirmLabel: text.t("block"),
          cancelLabel: t("actions.cancel"),
          danger: true,
          always: true,
        });
        if (!ok) return;
      }
      run(() => setPluginBlocked(entry.id, blocked));
    },
    rollback: async (entry) => {
      const to = entry.installed?.rollbackTo;
      if (!to) return;
      const ok = await confirm({
        title: text.t("rollbackTitle", { name: entry.name, version: to }),
        description: text.t("rollbackDesc"),
        confirmLabel: text.t("rollback"),
        cancelLabel: t("actions.cancel"),
      });
      if (ok) run(() => rollbackPlugin(entry.id));
    },
    uninstall: (entry) =>
      openModal(
        ({ close }) => (
          <UninstallDialog
            pluginId={entry.id}
            name={entry.name}
            sheet={isPhone}
            close={close}
            onDone={refresh}
          />
        ),
        { ...modal, label: text.t("uninstallTitle", { name: entry.name }) },
      ),
    addSource: () =>
      openModal(
        ({ close }) => (
          <AddSourceDialog sheet={isPhone} close={close} onDone={refresh} />
        ),
        { ...modal, label: text.t("addSource") },
      ),
    removeSource: async (source) => {
      const ok = await confirm({
        title: text.t("removeSourceTitle", { name: source.name }),
        description: text.t("removeSourceDesc"),
        confirmLabel: t("actions.delete"),
        cancelLabel: t("actions.cancel"),
        danger: true,
      });
      if (ok) run(() => removePluginSource(source.id));
    },
    refreshSource: (source) => run(() => refreshPluginSource(source.id)),
    toggleSource: (source, enabled) =>
      run(() => updatePluginSource(source.id, { enabled })),
  };

  // Nothing to show yet: no source, nothing installed.
  if (view.sources.length === 0 && view.entries.length === 0)
    return (
      <>
        <PageHeader divider={false} title={text.t("adminTitle")} />
        <StoreWelcome actions={actions} />
      </>
    );

  const needle = query.trim().toLowerCase();
  const shown = view.entries.filter((e) => {
    if (
      needle &&
      ![e.name, e.author, e.description].some((s) =>
        s.toLowerCase().includes(needle),
      )
    )
      return false;
    if (category && !e.listing?.categories.includes(category)) return false;
    if (filter === "installed") return !!e.installed;
    if (filter === "updates") return !!e.update;
    if (filter === "blocked") return !!e.installed?.blocked;
    return true;
  });
  const attention = shown.filter((e) => e.update || e.installed?.blocked);
  const installed = shown.filter((e) => e.installed && !attention.includes(e));
  const listed = shown.filter((e) => !e.installed);
  const counts = {
    all: view.entries.length,
    installed: view.entries.filter((e) => e.installed).length,
    updates: view.entries.filter((e) => e.update).length,
    blocked: view.entries.filter((e) => e.installed?.blocked).length,
  };
  const open = selected ? "plugin" : sourcesOpen ? "sources" : "home";

  return (
    <>
      <PageHeader
        divider={false}
        title={text.t("adminTitle")}
        leading={
          // Up a level, as an arrow like everywhere on a phone or tablet,
          // whose admin menu sits behind the hamburger: on a phone from a
          // plugin or the sources back to the list, otherwise to the admin
          // overview. A desktop has the sidebar and needs neither.
          <>
            {open !== "home" && (
              <Link
                href={storeHref({})}
                className={styles.headerBack}
                data-to="list"
                aria-label={text.t("allPlugins")}
                title={text.t("allPlugins")}
              >
                <Icon icon="lucide:chevron-left" width={22} aria-hidden />
              </Link>
            )}
            <Link
              href={adminPath("")}
              className={styles.headerBack}
              data-to="admin"
              data-also-list={open !== "home" || undefined}
              aria-label={text.t("backToAdmin")}
              title={text.t("backToAdmin")}
            >
              <Icon icon="lucide:chevron-left" width={22} aria-hidden />
            </Link>
          </>
        }
        actions={
          <Button
            variant="primary"
            icon={<Icon icon="lucide:plus" width={15} />}
            onClick={actions.addSource}
          >
            {text.t("addSource")}
          </Button>
        }
      />
      <div className={styles.store} data-open={open}>
        <aside className={styles.list} aria-label={text.t("storeList")}>
          <Input
            variant="search"
            placeholder={text.t("searchPlugins")}
            aria-label={text.t("searchPlugins")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className={styles.filters}>
            {(["all", "installed", "updates", "blocked"] as const).map((f) => (
              <Chip
                key={f}
                type="filter"
                selected={filter === f}
                onClick={() => setFilter(f)}
              >
                {text.t(`filter.${f}`, { count: counts[f] })}
              </Chip>
            ))}
          </div>
          {category && (
            <div className={styles.filters}>
              <Chip
                type="input"
                selected
                icon={<Icon icon="lucide:tag" width={14} />}
                onRemove={() => router.push(storeHref({}))}
                removeLabel={text.t("clearCategory")}
              >
                {text.t(`category.${category}` as "category.planning")}
              </Chip>
            </div>
          )}

          {view.unreadable.length > 0 && (
            <Link
              href={storeHref({ sources: true })}
              className={styles.sourceAlert}
            >
              <Icon icon="lucide:triangle-alert" width={16} aria-hidden />
              <span>
                {text.t("sourcesUnreadable", {
                  count: view.unreadable.length,
                })}
              </span>
              <Icon icon="lucide:chevron-right" width={16} aria-hidden />
            </Link>
          )}

          {shown.length === 0 && (
            <p className={styles.listEmpty}>{text.t("noMatches")}</p>
          )}
          <ListGroup
            title={text.t("groupAttention")}
            entries={attention}
            selected={selected}
          />
          <ListGroup
            title={text.t("groupInstalled")}
            entries={installed}
            selected={selected}
          />
          <ListGroup
            title={text.t("groupDirectory")}
            entries={listed}
            selected={selected}
          />

          <Link
            href={storeHref({ sources: true })}
            className={styles.sourcesLink}
            aria-current={sourcesOpen ? "page" : undefined}
          >
            <Icon icon="lucide:database" width={16} aria-hidden />
            <span>{text.t("sources")}</span>
            <span className={styles.count}>{view.sources.length}</span>
            <Icon icon="lucide:chevron-right" width={16} aria-hidden />
          </Link>
        </aside>

        <main className={styles.main}>
          <ErrorLine message={error} />
          {selected ? (
            <PluginDetail
              entry={selected}
              tab={tab}
              places={places}
              actions={actions}
            />
          ) : sourcesOpen ? (
            <SourcesPane
              sources={view.sources}
              unreadable={view.unreadable}
              entries={view.entries}
              actions={actions}
            />
          ) : (
            <StoreHome
              // A new `?category=` starts the start page's filter afresh.
              key={category ?? ""}
              view={view}
              onFilter={setFilter}
              initialCategory={category}
            />
          )}
        </main>
      </div>
    </>
  );
}

function ListGroup({
  title,
  entries,
  selected,
}: {
  title: string;
  entries: StoreEntry[];
  selected: StoreEntry | null;
}) {
  const text = usePluginText();
  if (entries.length === 0) return null;
  return (
    <section className={styles.group}>
      <h2 className={styles.groupTitle}>{title}</h2>
      <ul className={styles.items}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <Link
              href={storeHref({ plugin: entry.id })}
              className={styles.item}
              aria-current={selected?.id === entry.id ? "page" : undefined}
            >
              <PluginTile id={entry.id} name={entry.name} />
              <span className={styles.itemText}>
                <span className={styles.itemName}>{entry.name}</span>
                <span className={styles.itemSub}>
                  {entry.installed?.version
                    ? `${entry.author} · v${entry.installed.version}`
                    : entry.author}
                </span>
              </span>
              <ItemState entry={entry} label={text} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ItemState({
  entry,
  label,
}: {
  entry: StoreEntry;
  label: ReturnType<typeof usePluginText>;
}) {
  if (entry.installed?.blocked)
    return (
      <span className={styles.state} data-tone="muted">
        {label.t("statusBlocked")}
      </span>
    );
  if (entry.update)
    return (
      <span className={styles.state} data-tone="warning">
        {label.t("stateUpdate")}
      </span>
    );
  if (!entry.installed)
    return (
      <span className={styles.state} data-tone="new">
        {label.t("stateNew")}
      </span>
    );
  return null;
}
