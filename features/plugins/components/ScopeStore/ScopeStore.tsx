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
import { CapabilityCards } from "../PluginStore/capabilities";
import { PluginTile } from "../PluginStore/PluginTile";
import { PreviewGallery } from "../PluginStore/PreviewGallery";
import store from "../PluginStore/pluginStore.module.scss";
import { PluginBadges, usePluginText } from "../shared";
import { isReleased, ReleaseActions, ReleaseSummary } from "./ScopeActivation";
import scope from "./scopeStore.module.scss";

// The workspace's plugin store (BARY-201), for its managers: what the
// platform has installed, next to the one that's open — what it does, what
// it asks for, and whether it's released here. Built from the admin store's pieces; what's
// open lives in the address (`?plugin=`, `?tab=`, `?category=`).

export type ScopeStoreTab = "overview" | "capabilities";
type Filter = "all" | "on" | "available";

/** Released in this workspace — the list's "Released" group. */
const isOn = isReleased;
const waits = (p: ScopeStorePlugin) =>
  [p.workspace, ...Object.values(p.projects)].some(
    (a) => a?.state === "needsConfirmation",
  );

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
  const workspaceName = workspace.name;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const href = (to: Parameters<typeof pluginStorePath>[1]) =>
    pluginStorePath(view.workspaceId, to);

  const needle = query.trim().toLowerCase();
  const shown = view.plugins.filter((p) => {
    if (
      needle &&
      ![p.name, p.author, p.description].some((s) =>
        s.toLowerCase().includes(needle),
      )
    )
      return false;
    if (category && !p.categories.includes(category)) return false;
    if (filter === "on") return isOn(p);
    if (filter === "available") return !isOn(p);
    return true;
  });
  const on = shown.filter(isOn);
  const available = shown.filter((p) => !isOn(p));
  const counts = {
    all: view.plugins.length,
    on: view.plugins.filter(isOn).length,
    available: view.plugins.filter((p) => !isOn(p)).length,
  };

  // Nothing installed yet — only a platform admin gets here then
  // (`canUsePluginStore`): how plugins come in, and where to start.
  if (view.plugins.length === 0)
    return (
      <>
        <PageHeader divider={false} title={text.t("scopeStoreTitle")} />
        <ScopeStoreWelcome />
      </>
    );

  return (
    <>
      <PageHeader
        divider={false}
        title={text.t("scopeStoreTitle")}
        leading={
          selected && (
            <Link
              href={href({})}
              className={store.headerBack}
              data-to="list"
              aria-label={text.t("allPlugins")}
              title={text.t("allPlugins")}
            >
              <Icon icon="lucide:chevron-left" width={22} aria-hidden />
            </Link>
          )
        }
      />
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
          />
          <div className={store.filters}>
            {(["all", "on", "available"] as const).map((f) => (
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
          {category && (
            <div className={store.filters}>
              <Chip
                type="input"
                selected
                icon={<Icon icon="lucide:tag" width={14} />}
                onRemove={() => router.push(href({}))}
                removeLabel={text.t("clearCategory")}
              >
                {text.t(`category.${category}` as "category.planning")}
              </Chip>
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
            <Home view={view} category={category} href={href} />
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
  const text = usePluginText();
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
              {p.blocked ? (
                <span className={store.state} data-tone="muted">
                  {text.t("statusBlocked")}
                </span>
              ) : waits(p) ? (
                <span className={store.state} data-tone="warning">
                  {text.t("stateConfirm")}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Next to the list when nothing is open: every plugin, by category. */
function Home({
  view,
  category,
  href,
}: {
  view: ScopeStoreView;
  category: string | null;
  href: Href;
}) {
  const text = usePluginText();
  const [picked, setPicked] = useState<string | null>(category);
  const used = PLUGIN_CATEGORIES.filter((c) =>
    view.plugins.some((p) => p.categories.includes(c)),
  );
  const shown = picked
    ? view.plugins.filter((p) => p.categories.includes(picked))
    : view.plugins;

  return (
    <section className={store.home}>
      <header className={scope.intro}>
        <h2>{text.t("scopeStoreIntroTitle")}</h2>
        <p>{text.t("scopeStoreIntro")}</p>
      </header>
      <section className={store.homeSection}>
        {used.length > 0 && (
          <div className={store.filters}>
            <Chip
              type="filter"
              selected={picked === null}
              onClick={() => setPicked(null)}
            >
              {text.t("categoryAll")}
            </Chip>
            {used.map((c) => (
              <Chip
                key={c}
                type="filter"
                selected={picked === c}
                onClick={() => setPicked(c)}
              >
                {text.t(`category.${c}` as "category.planning")}
              </Chip>
            ))}
          </div>
        )}
        <div className={store.grid}>
          {shown.map((p) => (
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
                {isOn(p) && (
                  <span className={store.cardState} data-state="installed">
                    {text.t("groupOnHere")}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      </section>
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
  return (
    <article className={store.detail}>
      <header className={store.detailHead}>
        <PluginTile id={plugin.pluginId} name={plugin.name} size="lg" />
        <div className={store.headText}>
          <h2 className={store.detailName}>{plugin.name}</h2>
          <span className={store.headMeta}>
            {plugin.author}
            {plugin.version && <> · v{plugin.version}</>}
          </span>
          <span className={store.categories}>
            <PluginBadges kind={plugin.kind} levels={plugin.levels} size="md" />
            {plugin.categories.map((c) => (
              <Link
                key={c}
                href={href({ category: c })}
                className={store.categoryLink}
              >
                {text.t(`category.${c}` as "category.planning")}
              </Link>
            ))}
          </span>
        </div>
        <ReleaseActions
          plugin={plugin}
          view={view}
          workspaceName={workspaceName}
        />
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

      {tab === "overview" ? (
        <div className={scope.overview}>
          <PreviewGallery previews={plugin.previews} />
          <section className={store.about}>
            <h3>{text.t("aboutPlugin", { name: plugin.name })}</h3>
            <p>{plugin.description}</p>
          </section>
        </div>
      ) : (
        <div className={store.capabilities}>
          <header className={store.capHead}>
            <h3>
              {text.t("capsOfVersion", { version: plugin.version ?? "" })}
            </h3>
            <p>{text.t("capabilitiesIntro")}</p>
          </header>
          <CapabilityCards
            capabilities={plugin.capabilities}
            network={plugin.network}
          />
        </div>
      )}
    </article>
  );
}
