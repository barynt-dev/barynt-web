"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import buttonStyles from "@/components/ui/atoms/Button/button.module.scss";
import { Chip } from "@/components/ui/atoms/Chip/Chip";
import { Input } from "@/components/ui/atoms/Input/Input";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import {
  type SettingsNavSubject,
  SettingsSubjectMenu,
} from "@/components/ui/layout/SettingsNav/SettingsSubjectMenu";
import { Tab, Tabs } from "@/components/ui/layout/Tabs/Tabs";
import type {
  ScopeStorePlugin,
  ScopeStoreView,
} from "@/features/plugins/queries";
import { Link } from "@/i18n/navigation";
import { adminPath, pluginStorePath } from "@/lib/nav";
import { PLUGIN_CATEGORIES } from "@/lib/plugins/directory";
import { PHONE_QUERY, useMediaQuery } from "@/lib/utils/useMediaQuery";
import { CapabilitiesHead, CapabilityCards } from "../PluginStore/capabilities";
import { NewestRow } from "../PluginStore/NewestRow";
import { PluginAbout, PluginLinks } from "../PluginStore/PluginAbout";
import { PluginTile } from "../PluginStore/PluginTile";
import { PreviewGallery } from "../PluginStore/PreviewGallery";
import store from "../PluginStore/pluginStore.module.scss";
import { ShareButton } from "../PluginStore/ShareButton";
import {
  ActiveFacets,
  activeFacets,
  type FacetItem,
  matchesFacets,
  NO_FACETS,
  type StoreFacet,
  type StoreFacets,
  StoreFilterButton,
} from "../PluginStore/StoreFilter";
import { LoadMore } from "../PluginStore/StoreHome";
import { PluginBadges, usePluginText } from "../shared";
import { isReleased, ReleaseActions, ReleaseSummary } from "./ScopeActivation";
import scope from "./scopeStore.module.scss";

// The workspace's plugin store (BARY-201), for its managers: what the
// platform has installed, next to the one that's open — what it does, what
// it asks for, and whether it's released here. Laid out like the admin store
// (BARY-237) and built from its pieces: the search with its filter, a start
// page with the numbers, what was added last, every plugin by category,
// and a plugin's page with its facts beside the overview. What's open lives
// in the address (`?plugin=`, `?tab=`, `?category=`).

export type ScopeStoreTab = "overview" | "capabilities";
type Filter = "all" | "on" | "available" | "waiting";

/** Released in this workspace — the list's "Released" group. */
const isOn = isReleased;
/** On somewhere here, and an update waits for a confirmation. */
const waits = (p: ScopeStorePlugin) =>
  [p.workspace, ...Object.values(p.projects)].some(
    (a) => a?.state === "needsConfirmation",
  );
const facetsOf = (p: ScopeStorePlugin): FacetItem => ({
  kind: p.kind,
  levels: p.levels,
  categories: p.categories,
  source: p.source,
});

/** The workspace the store is for, and the others to switch to. */
export interface StoreWorkspace {
  name: string;
  color: string;
  image?: string;
  siblings: SettingsNavSubject[];
  label: string;
}

export function ScopeStore({
  view,
  workspace,
  selected,
  tab,
  category,
}: {
  view: ScopeStoreView;
  workspace: StoreWorkspace;
  selected: ScopeStorePlugin | null;
  tab: ScopeStoreTab;
  category: string | null;
}) {
  const text = usePluginText();
  const router = useRouter();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const workspaceName = workspace.name;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const href = (to: Parameters<typeof pluginStorePath>[1]) =>
    pluginStorePath(view.workspaceId, to);
  const fromAddress = (c: string | null): StoreFacets => ({
    ...NO_FACETS,
    category: c ? [c] : [],
  });
  const [facets, setFacets] = useState(() => fromAddress(category));
  // A new `?category=` (a category link) starts the filter afresh.
  const [addressCategory, setAddressCategory] = useState(category);
  if (category !== addressCategory) {
    setAddressCategory(category);
    setFacets(fromAddress(category));
  }
  const removeFacet = (facet: StoreFacet, value: string) => {
    setFacets((f) => ({ ...f, [facet]: f[facet].filter((v) => v !== value) }));
    if (facet === "category" && value === category) {
      setAddressCategory(null);
      router.push(href({}));
    }
  };

  // Nothing installed yet — only a platform admin gets here then
  // (`canUsePluginStore`): how plugins come in, and where to start.
  if (view.plugins.length === 0) return <ScopeStoreWelcome />;

  const needle = query.trim().toLowerCase();
  const shown = view.plugins.filter((p) => {
    if (
      needle &&
      ![p.name, p.author, p.description].some((s) =>
        s.toLowerCase().includes(needle),
      )
    )
      return false;
    if (!matchesFacets(facetsOf(p), facets)) return false;
    if (filter === "on") return isOn(p);
    if (filter === "available") return !isOn(p);
    if (filter === "waiting") return waits(p);
    return true;
  });
  const on = shown.filter(isOn);
  const available = shown.filter((p) => !isOn(p));
  const counts = {
    all: view.plugins.length,
    on: view.plugins.filter(isOn).length,
    available: view.plugins.filter((p) => !isOn(p)).length,
    waiting: view.plugins.filter(waits).length,
  };

  return (
    <>
      {/* The tab above already says "Store": a header only on a phone
          showing a plugin — its name, and the way back to the list. */}
      {selected && (
        <PageHeader
          divider={false}
          className={scope.phoneHeader}
          title={isPhone ? selected.name : text.t("scopeStoreTitle")}
          leading={
            <Link
              href={href({})}
              className={store.headerBack}
              data-to="list"
              aria-label={text.t("allPlugins")}
              title={text.t("allPlugins")}
            >
              <Icon icon="lucide:chevron-left" width={22} aria-hidden />
            </Link>
          }
        />
      )}
      <div
        className={`${store.store} ${scope.fill}`}
        data-open={selected ? "plugin" : "home"}
      >
        <aside className={store.list} aria-label={text.t("storeList")}>
          {/* Which workspace this is for — the same switcher as in the
              workspace's settings. */}
          <div className={scope.subject}>
            {workspace.siblings.length > 1 ? (
              <SettingsSubjectMenu
                name={workspace.name}
                color={workspace.color}
                image={workspace.image}
                siblings={workspace.siblings}
                label={workspace.label}
              />
            ) : (
              <span className={scope.subjectFixed}>
                <Avatar
                  avatar={{
                    name: workspace.name,
                    color: workspace.color,
                    image: workspace.image,
                  }}
                  shape="square"
                  size={20}
                />
                {workspace.name}
              </span>
            )}
          </div>
          <Input
            variant="search"
            placeholder={text.t("searchPlugins")}
            aria-label={text.t("searchPlugins")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            iconRight={
              <StoreFilterButton
                items={view.plugins.map(facetsOf)}
                facets={facets}
                onChange={(next) => {
                  if (category && !next.category.includes(category)) {
                    setAddressCategory(null);
                    router.push(href({}));
                  }
                  setFacets(next);
                }}
              />
            }
          />
          <div className={store.filters}>
            {(["all", "on", "available", "waiting"] as const)
              // Waiting only once something waits — or while it's picked.
              .filter(
                (f) => f !== "waiting" || counts.waiting > 0 || filter === f,
              )
              .map((f) => (
                <Chip
                  key={f}
                  type="filter"
                  selected={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {text.t(`scopeFilter.${f}`, { count: counts[f] })}
                </Chip>
              ))}
          </div>
          <ActiveFacets facets={facets} onRemove={removeFacet} />

          {/* A phone has no start page: what was added last sits above
              the list, while nothing narrows it. */}
          {!query && filter === "all" && activeFacets(facets) === 0 && (
            <div className={store.phoneFeatured}>
              <Newest plugins={view.plugins} href={href} />
            </div>
          )}

          {shown.length === 0 && (
            <p className={store.listEmpty}>{text.t("noMatches")}</p>
          )}
          <ListGroup
            title={text.t("groupOnHere")}
            plugins={on}
            selected={selected}
            href={href}
          />
          <ListGroup
            title={text.t("groupAvailable")}
            plugins={available}
            selected={selected}
            href={href}
          />
        </aside>

        <main className={store.main}>
          {selected ? (
            <Detail
              plugin={selected}
              tab={tab}
              view={view}
              workspaceName={workspaceName}
              href={href}
            />
          ) : (
            <Home
              // A new `?category=` starts the start page's filter afresh.
              key={category ?? ""}
              view={view}
              category={category}
              href={href}
              onFilter={setFilter}
            />
          )}
        </main>
      </div>
    </>
  );
}

type Href = (to: Parameters<typeof pluginStorePath>[1]) => string;

/** The store's start page while the platform has no plugin installed: what
 *  plugins are, the three steps from a source to a project, and the way to
 *  the first one — the admin store. Built like that store's own start page
 *  (`StoreWelcome`). */
function ScopeStoreWelcome() {
  const text = usePluginText();
  return (
    <section className={store.welcome}>
      <div className={store.hero}>
        <div className={store.heroText}>
          <span className={store.heroKicker}>
            <Icon icon="lucide:store" width={14} aria-hidden />
            {text.t("scopeStoreTitle")}
          </span>
          <h2 className={store.heroTitle}>{text.t("scopeWelcomeTitle")}</h2>
          <p>{text.t("scopeWelcomeText")}</p>
          <div className={store.heroActions}>
            <Link
              href={adminPath("plugins")}
              className={[
                buttonStyles.btn,
                buttonStyles.primary,
                buttonStyles.md,
                buttonStyles.hasIcon,
              ].join(" ")}
            >
              <Icon icon="lucide:shield" width={15} aria-hidden />
              {text.t("scopeWelcomeAction")}
            </Link>
          </div>
        </div>
        <div className={store.heroTiles} aria-hidden>
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
      <ol className={store.steps}>
        {(
          ["scopeStepInstall", "scopeStepRelease", "scopeStepProjects"] as const
        ).map((key, i) => (
          <li key={key} className={store.stepCard}>
            <span className={store.stepNumber}>{i + 1}</span>
            <strong>{text.t(`${key}Title`)}</strong>
            <span className={store.muted}>{text.t(`${key}Text`)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ListGroup({
  title,
  plugins,
  selected,
  href,
}: {
  title: string;
  plugins: ScopeStorePlugin[];
  selected: ScopeStorePlugin | null;
  href: Href;
}) {
  if (plugins.length === 0) return null;
  return (
    <section className={store.group}>
      <h2 className={store.groupTitle}>{title}</h2>
      <ul className={store.items}>
        {plugins.map((p) => (
          <li key={p.pluginId}>
            <Link
              href={href({ plugin: p.pluginId })}
              className={store.item}
              aria-current={
                selected?.pluginId === p.pluginId ? "page" : undefined
              }
            >
              <PluginTile id={p.pluginId} name={p.name} />
              <span className={store.itemText}>
                <span className={store.itemName}>{p.name}</span>
                <span className={store.itemSub}>
                  {p.author}
                  {p.version && ` · v${p.version}`}
                </span>
              </span>
              <ItemState plugin={p} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Blocked, or a confirmation it waits for — in the list. */
function ItemState({ plugin }: { plugin: ScopeStorePlugin }) {
  const text = usePluginText();
  if (plugin.blocked)
    return (
      <span className={store.state} data-tone="muted">
        {text.t("statusBlocked")}
      </span>
    );
  if (waits(plugin))
    return (
      <span className={store.state} data-tone="warning">
        {text.t("stateConfirm")}
      </span>
    );
  return null;
}

/** Released, blocked, waiting — on a card; nothing for one that's available. */
function CardState({ plugin }: { plugin: ScopeStorePlugin }) {
  const text = usePluginText();
  const state = plugin.blocked
    ? "blocked"
    : waits(plugin)
      ? "update"
      : isOn(plugin)
        ? "installed"
        : null;
  if (!state) return null;
  return (
    <span className={store.cardState} data-state={state}>
      {state === "blocked"
        ? text.t("cardState.blocked")
        : state === "update"
          ? text.t("stateConfirm")
          : text.t("groupOnHere")}
    </span>
  );
}

/** How many of "All plugins" show at once, and come with each "more". */
const ALL_PAGE = 12;

/** Next to the list when nothing is open: the numbers, what was
 *  added last, and every plugin by category. */
function Home({
  view,
  category: initialCategory,
  href,
  onFilter,
}: {
  view: ScopeStoreView;
  category: string | null;
  href: Href;
  /** Narrows the list on the left — a number is a shortcut to it. */
  onFilter: (filter: Filter) => void;
}) {
  const text = usePluginText();
  const [category, setCategoryState] = useState<string | null>(initialCategory);
  const [limit, setLimit] = useState(ALL_PAGE);
  const setCategory = (next: string | null) => {
    setCategoryState(next);
    setLimit(ALL_PAGE);
  };
  const plugins = view.plugins;
  const released = plugins.filter(isOn);
  const waiting = plugins.filter(waits);
  const available = plugins.filter((p) => !isOn(p) && !p.blocked);
  const used = PLUGIN_CATEGORIES.filter((c) =>
    plugins.some((p) => p.categories.includes(c)),
  );
  // The projects with at least one plugin on.
  const projectsOn = view.projects.filter((pr) =>
    plugins.some((p) => {
      const a = p.projects[pr.id];
      return a?.state === "active" || a?.state === "needsConfirmation";
    }),
  );
  const shown = category
    ? plugins.filter((p) => p.categories.includes(category))
    : plugins;

  return (
    <section className={store.home}>
      <div className={store.kpis}>
        <button
          type="button"
          className={store.kpi}
          data-accent="teal"
          onClick={() => onFilter("on")}
        >
          <span className={store.kpiHead}>
            <Icon icon="lucide:circle-check" width={15} aria-hidden />
            {text.t("scopeKpi.released")}
          </span>
          <span className={store.kpiValue}>{released.length}</span>
          <span
            className={store.kpiBar}
            aria-hidden
            data-empty={released.length === 0 || undefined}
          >
            {/* The one dynamic value: how much of the bar is filled. */}
            <span
              style={{ width: `${(released.length / plugins.length) * 100}%` }}
            />
          </span>
          <span className={store.kpiSub}>
            {text.t("scopeKpiReleasedSub", { count: plugins.length })}
          </span>
        </button>

        <button
          type="button"
          className={store.kpi}
          data-accent="amber"
          data-bg={waiting.length > 0 ? "tint" : undefined}
          onClick={() => onFilter(waiting.length > 0 ? "waiting" : "on")}
        >
          <span className={store.kpiHead}>
            <Icon icon="lucide:sparkles" width={15} aria-hidden />
            {text.t("scopeKpi.waiting")}
          </span>
          <span className={store.kpiValue}>{waiting.length}</span>
          <span className={store.kpiSub}>
            {waiting.length > 0
              ? waiting.map((p) => p.name).join(", ")
              : text.t("scopeKpiNothingWaits")}
          </span>
        </button>

        <button
          type="button"
          className={store.kpi}
          data-accent="blue"
          onClick={() => onFilter("available")}
        >
          <span className={store.kpiHead}>
            <Icon icon="lucide:store" width={15} aria-hidden />
            {text.t("scopeKpi.available")}
          </span>
          <span className={store.kpiValue}>{available.length}</span>
          <span className={store.kpiSub}>
            {text.t("scopeKpiAvailableSub", { count: used.length })}
          </span>
        </button>

        <a href="#all-plugins" className={store.kpi} data-accent="green">
          <span className={store.kpiHead}>
            <Icon icon="lucide:folder-kanban" width={15} aria-hidden />
            {text.t("scopeKpi.projects")}
            <span className={store.kpiMeta}>
              {text.t("homeOnOf", {
                on: projectsOn.length,
                all: view.projects.length,
              })}
            </span>
          </span>
          <span className={store.kpiValue}>{projectsOn.length}</span>
          <span className={store.kpiSub}>{text.t("scopeKpiProjectsSub")}</span>
        </a>
      </div>

      <Newest plugins={plugins} href={href} />

      <section className={store.homeSection} id="all-plugins">
        <header className={store.homeHead}>
          <h2>{text.t("allPlugins")}</h2>
        </header>
        {used.length > 0 && (
          <div className={store.filters}>
            <Chip
              type="filter"
              selected={category === null}
              onClick={() => setCategory(null)}
            >
              {text.t("categoryAll")}
            </Chip>
            {used.map((c) => (
              <Chip
                key={c}
                type="filter"
                selected={category === c}
                onClick={() => setCategory(c)}
              >
                {text.t(`category.${c}` as "category.planning")}
              </Chip>
            ))}
          </div>
        )}
        <div className={store.grid}>
          {shown.slice(0, limit).map((p) => (
            <Link
              key={p.pluginId}
              href={href({ plugin: p.pluginId })}
              className={store.gridCard}
            >
              <span className={store.cardTop}>
                <PluginTile id={p.pluginId} name={p.name} />
                <span className={store.itemText}>
                  <span className={store.itemName}>{p.name}</span>
                  <span className={store.itemSub}>{p.author}</span>
                </span>
              </span>
              <span className={store.gridText}>{p.description}</span>
              <span className={store.cardFoot}>
                <PluginBadges kind={p.kind} levels={p.levels} size="md" />
                <CardState plugin={p} />
              </span>
            </Link>
          ))}
        </div>
        {shown.length > limit && (
          <LoadMore
            key={limit}
            shown={limit}
            total={shown.length}
            onMore={() => setLimit((l) => l + ALL_PAGE)}
          />
        )}
      </section>
    </section>
  );
}

/**
 * What was added last, among what the platform installed — in the compact
 * row of the admin store's "New in the directory", newest first (BARY-237).
 */
function Newest({
  plugins,
  href,
}: {
  plugins: ScopeStorePlugin[];
  href: Href;
}) {
  const text = usePluginText();
  const newest = plugins
    .filter((p) => p.added)
    .sort((a, b) => (b.added ?? "").localeCompare(a.added ?? ""))
    .slice(0, 18);
  if (newest.length === 0) return null;
  return (
    <section className={store.homeSection}>
      <header className={store.homeHead}>
        <h2>{text.t("scopeNewestTitle")}</h2>
      </header>
      <NewestRow
        cards={newest.map((p) => (
          <Link
            key={p.pluginId}
            href={href({ plugin: p.pluginId })}
            className={store.newestItem}
          >
            <PluginTile id={p.pluginId} name={p.name} />
            <span className={store.itemText}>
              <span className={store.itemName}>{p.name}</span>
              <span className={store.itemSub}>{p.description}</span>
            </span>
            <CardState plugin={p} />
          </Link>
        ))}
      />
    </section>
  );
}

const TAB_ICONS: Record<ScopeStoreTab, string> = {
  overview: "lucide:layout-panel-top",
  capabilities: "lucide:key-round",
};

function Detail({
  plugin,
  tab,
  view,
  workspaceName,
  href,
}: {
  plugin: ScopeStorePlugin;
  tab: ScopeStoreTab;
  view: ScopeStoreView;
  workspaceName: string;
  href: Href;
}) {
  const text = usePluginText();
  const publicUrl =
    plugin.links.find((l) => l.kind === "homepage")?.url ??
    plugin.links.find((l) => l.kind === "github" || l.kind === "gitlab")?.url ??
    null;
  return (
    <article className={store.detail}>
      {/* Stays at the top while what's under the divider scrolls. */}
      <div className={store.detailTop}>
        <header className={store.detailHead}>
          <PluginTile id={plugin.pluginId} name={plugin.name} size="xl" />
          <div className={store.headText}>
            <h2 className={store.detailName}>{plugin.name}</h2>
            <span className={store.headMeta}>
              {plugin.author}
              {plugin.version && <> · v{plugin.version}</>}
            </span>
            <PluginBadges kind={plugin.kind} levels={plugin.levels} size="md" />
          </div>
          <div className={store.headActions}>
            <ReleaseActions
              plugin={plugin}
              view={view}
              workspaceName={workspaceName}
            />
            <ShareButton
              name={plugin.name}
              description={plugin.description}
              publicUrl={publicUrl}
            />
          </div>
        </header>

        <ReleaseSummary
          plugin={plugin}
          view={view}
          workspaceName={workspaceName}
        />

        <Tabs label={text.t("detailTabs")} className={store.tabs}>
          {(["overview", "capabilities"] as const).map((id) => (
            <Tab
              key={id}
              href={href({ plugin: plugin.pluginId, tab: id })}
              active={tab === id}
              icon={<Icon icon={TAB_ICONS[id]} width={15} />}
            >
              {text.t(`tab.${id}`)}
            </Tab>
          ))}
        </Tabs>
      </div>

      {tab === "overview" ? (
        <Overview plugin={plugin} view={view} href={href} />
      ) : (
        <div className={store.capabilities}>
          <CapabilitiesHead />
          <CapabilityCards
            capabilities={plugin.capabilities}
            service={plugin.service}
            network={plugin.network}
          />
        </div>
      )}
    </article>
  );
}

/** The plugin's pictures and page, and beside them what it asks for and
 *  where it comes from — as in the admin store. */
function Overview({
  plugin,
  view,
  href,
}: {
  plugin: ScopeStorePlugin;
  view: ScopeStoreView;
  href: Href;
}) {
  const text = usePluginText();
  const projectsOn = view.projects.filter((p) => {
    const a = plugin.projects[p.id];
    return a?.state === "active" || a?.state === "needsConfirmation";
  }).length;
  return (
    <div className={store.overview}>
      <div className={store.overviewMain}>
        <PreviewGallery previews={plugin.previews} />
        <PluginAbout
          name={plugin.name}
          description={plugin.description}
          about={plugin.about}
        />
      </div>

      <aside className={store.facts}>
        <PluginLinks links={plugin.links} />
        <section className={store.card}>
          <h3 className={store.cardTitle}>
            <Icon icon="lucide:key-round" width={14} aria-hidden />
            {text.t("asksFor")}
          </h3>
          {plugin.capabilities.length === 0 ? (
            <p className={store.muted}>{text.t("noCapabilities")}</p>
          ) : (
            <ul className={store.capChips}>
              {plugin.capabilities.map((cap) => (
                <li key={cap}>{text.capability(cap)}</li>
              ))}
            </ul>
          )}
          {plugin.network.length > 0 && (
            <p className={store.hostsLine}>
              <Icon icon="lucide:globe" width={14} aria-hidden />
              {text.t("callsHosts", { hosts: plugin.network.join(", ") })}
            </p>
          )}
          <Link
            href={href({ plugin: plugin.pluginId, tab: "capabilities" })}
            className={store.cardLink}
          >
            {text.t("allCapabilities")}
          </Link>
        </section>

        <section className={store.card}>
          <h3 className={store.cardTitle}>
            <Icon icon="lucide:shield" width={14} aria-hidden />
            {text.t("provenance")}
          </h3>
          <dl className={store.factList}>
            <dt>{text.t("author")}</dt>
            <dd>{plugin.author}</dd>
            {plugin.source && (
              <>
                <dt>{text.t("source")}</dt>
                <dd>{plugin.source}</dd>
              </>
            )}
            <dt>{text.t("kindLabel")}</dt>
            <dd>{text.kind(plugin.kind)}</dd>
            {plugin.categories.length > 0 && (
              <>
                <dt>
                  {text.t("categoriesLabel", {
                    count: plugin.categories.length,
                  })}
                </dt>
                <dd className={store.categories}>
                  {plugin.categories.map((c) => (
                    // Every plugin of the category, on the start page.
                    <Link
                      key={c}
                      href={href({ category: c })}
                      className={store.categoryLink}
                    >
                      {text.t(`category.${c}` as "category.planning")}
                    </Link>
                  ))}
                </dd>
              </>
            )}
            {plugin.levels.includes("project") && (
              <>
                <dt>{text.t("activeIn")}</dt>
                <dd>{text.t("scopeActiveIn", { count: projectsOn })}</dd>
              </>
            )}
          </dl>
          <p className={store.muted}>{text.t("scopeProvenanceNote")}</p>
        </section>
      </aside>
    </div>
  );
}
