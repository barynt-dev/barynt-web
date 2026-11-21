"use client";

import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Chip } from "@/components/ui/atoms/Chip/Chip";
import type { StoreEntry, StoreView } from "@/features/plugins/queries";
import { Link } from "@/i18n/navigation";
import { PLUGIN_CATEGORIES } from "@/lib/plugins/directory";
import { preferredVersion } from "@/lib/plugins/semver";
import { PluginBadges, usePluginText } from "../shared";
import { FeaturedCarousel } from "./FeaturedCarousel";
import { NewestRow } from "./NewestRow";
import { storeHref } from "./PluginStore";
import { PluginTile, tileHue } from "./PluginTile";
import styles from "./pluginStore.module.scss";

// The store's start page next to the list (BARY-200, design "Option A"): the
// numbers as dashboard widgets, what the directory puts forward, what's new
// in it, and every plugin by category.

type Filter = "installed" | "updates";

export function StoreHome({
  view,
  onFilter,
  initialCategory = null,
}: {
  view: StoreView;
  /** The category the address asks for (`?category=`), if any. */
  initialCategory?: string | null;
  /** Narrows the list on the left — a widget is a shortcut to it. */
  onFilter: (filter: Filter) => void;
}) {
  const text = usePluginText();
  const [category, setCategory] = useState<string | null>(initialCategory);
  const entries = view.entries;
  const installed = entries.filter((e) => e.installed);
  const on = installed.filter((e) => (e.installed?.activations ?? 0) > 0);
  const updates = entries.filter((e) => e.update);
  const listed = entries.filter((e) => !e.installed);
  const newest = entries
    .filter((e) => e.listing?.added)
    .sort((a, b) =>
      (b.listing?.added ?? "").localeCompare(a.listing?.added ?? ""),
    )
    .slice(0, 18);
  const used = PLUGIN_CATEGORIES.filter((c) =>
    entries.some((e) => e.listing?.categories.includes(c)),
  );
  const shown = category
    ? entries.filter((e) => e.listing?.categories.includes(category))
    : entries;

  return (
    <section className={styles.home}>
      <div className={styles.kpis}>
        <button
          type="button"
          className={styles.kpi}
          data-accent="teal"
          onClick={() => onFilter("installed")}
        >
          <span className={styles.kpiHead}>
            <Icon icon="lucide:package" width={15} aria-hidden />
            {text.t("homeKpi.installed")}
            <span className={styles.kpiMeta}>
              {text.t("homeOnOf", { on: on.length, all: installed.length })}
            </span>
          </span>
          <span className={styles.kpiValue}>{installed.length}</span>
          <span
            className={styles.kpiBar}
            aria-hidden
            data-empty={installed.length === 0 || undefined}
          >
            {/* The one dynamic value: how much of the bar is filled. */}
            <span
              style={{
                width: `${installed.length ? (on.length / installed.length) * 100 : 0}%`,
              }}
            />
          </span>
          <span className={styles.kpiSub}>
            {text.t("homeActive", { count: on.length })}
          </span>
        </button>

        <button
          type="button"
          className={styles.kpi}
          data-accent="amber"
          data-bg={updates.length > 0 ? "tint" : undefined}
          onClick={() => onFilter("updates")}
        >
          <span className={styles.kpiHead}>
            <Icon icon="lucide:sparkles" width={15} aria-hidden />
            {text.t("homeKpi.updates")}
          </span>
          <span className={styles.kpiValue}>{updates.length}</span>
          <span className={styles.kpiSub}>
            {updates.length > 0
              ? updates.map((e) => e.name).join(", ")
              : text.t("homeUpToDate")}
          </span>
        </button>

        <a href="#all-plugins" className={styles.kpi} data-accent="blue">
          <span className={styles.kpiHead}>
            <Icon icon="lucide:store" width={15} aria-hidden />
            {text.t("homeKpi.listed")}
          </span>
          <span className={styles.kpiValue}>{listed.length}</span>
          <span className={styles.kpiSub}>
            {text.t("homeListedSub", { count: used.length })}
          </span>
        </a>

        <Link
          href={storeHref({ sources: true })}
          className={styles.kpi}
          data-accent={view.unreadable.length > 0 ? "red" : "green"}
          data-bg={view.unreadable.length > 0 ? "tint" : undefined}
        >
          <span className={styles.kpiHead}>
            <Icon icon="lucide:database" width={15} aria-hidden />
            {text.t("homeKpi.sources")}
          </span>
          <span className={styles.kpiValue}>{view.sources.length}</span>
          <span className={styles.kpiSub}>
            {view.unreadable.length > 0
              ? text.t("sourcesUnreadable", { count: view.unreadable.length })
              : text.t("homeSourcesOk")}
          </span>
        </Link>
      </div>

      <FeaturedSection entries={entries} />

      {newest.length > 0 && (
        <section className={styles.homeSection}>
          <header className={styles.homeHead}>
            <h2>{text.t("newestTitle")}</h2>
          </header>
          <NewestRow>
            {newest.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={storeHref({ plugin: entry.id })}
                  className={styles.newestItem}
                >
                  <PluginTile id={entry.id} name={entry.name} />
                  <span className={styles.itemText}>
                    <span className={styles.itemName}>{entry.name}</span>
                    <span className={styles.itemSub}>{entry.description}</span>
                  </span>
                  <CardState entry={entry} />
                </Link>
              </li>
            ))}
          </NewestRow>
        </section>
      )}

      <section className={styles.homeSection} id="all-plugins">
        <header className={styles.homeHead}>
          <h2>{text.t("allPlugins")}</h2>
        </header>
        {used.length > 0 && (
          <div className={styles.filters}>
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
        <div className={styles.grid}>
          {shown.map((entry) => (
            <Link
              key={entry.id}
              href={storeHref({ plugin: entry.id })}
              className={styles.gridCard}
            >
              <span className={styles.cardTop}>
                <PluginTile id={entry.id} name={entry.name} />
                <span className={styles.itemText}>
                  <span className={styles.itemName}>{entry.name}</span>
                  <span className={styles.itemSub}>{entry.author}</span>
                </span>
              </span>
              <span className={styles.gridText}>{entry.description}</span>
              <span className={styles.cardFoot}>
                <Badge mono={false}>{text.kind(entry.kind)}</Badge>
                <CardState entry={entry} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </section>
  );
}

/** Installed, update, blocked — or nothing for a plugin that's only listed. */
/** Where a featured plugin's first screenshot comes from: its installed
 *  version's, else the store's release (`/api/plugin-listed-previews`). */
export function featurePreviewUrl(entry: StoreEntry): string {
  return (
    entry.installed?.previews[0]?.src ??
    `/api/plugin-listed-previews/${encodeURIComponent(entry.id)}`
  );
}

/**
 * What the directory puts forward (BARY-237): the store's start page, and on
 * a phone — which has no start page — above the list.
 */
export function FeaturedSection({ entries }: { entries: StoreEntry[] }) {
  const text = usePluginText();
  const featured = entries.filter((e) => e.listing?.featured).slice(0, 12);
  if (featured.length === 0) return null;
  return (
    <FeaturedCarousel
      names={featured.map((entry) => entry.name)}
      head={
        <>
          <h2>{text.t("featuredTitle")}</h2>
          <span>{text.t("featuredSub")}</span>
        </>
      }
    >
      {featured.map((entry) => {
        const version =
          entry.installed?.version ??
          preferredVersion(entry.listing?.versions ?? []);
        return (
          <Link
            key={entry.id}
            href={storeHref({ plugin: entry.id })}
            className={styles.featureCard}
            data-hue={tileHue(entry.id)}
          >
            <FeaturePreview src={featurePreviewUrl(entry)} />
            <span className={styles.featureLogo}>
              <PluginTile id={entry.id} name={entry.name} size="hero" />
            </span>
            <span className={styles.featureHead}>
              <span className={styles.featureName}>{entry.name}</span>
              <span className={styles.itemSub}>
                {entry.author}
                {version && ` · v${version}`}
              </span>
            </span>
            <span className={styles.featureText}>{entry.description}</span>
            <span className={styles.featureFoot}>
              <PluginBadges kind={entry.kind} levels={entry.levels} size="md" />
              <CardState entry={entry} />
            </span>
          </Link>
        );
      })}
    </FeaturedCarousel>
  );
}

/**
 * A featured plugin's first screenshot, fading in from the right of its
 * card. Asked for once mounted, so the load is always seen; a plugin
 * without a screenshot (a 404) leaves the card as it is.
 */
function FeaturePreview({ src }: { src: string }) {
  const [state, setState] = useState<"idle" | "loading" | "shown" | "none">(
    "idle",
  );
  useEffect(() => setState("loading"), []);
  if (state === "idle" || state === "none") return null;
  return (
    // biome-ignore lint/performance/noImgElement: a picture Barynt serves itself, behind a card
    <img
      className={styles.featurePreview}
      data-shown={state === "shown" || undefined}
      src={src}
      alt=""
      decoding="async"
      onLoad={() => setState("shown")}
      onError={() => setState("none")}
    />
  );
}

function CardState({ entry }: { entry: StoreEntry }) {
  const text = usePluginText();
  const state = entry.installed?.blocked
    ? "blocked"
    : entry.update
      ? "update"
      : entry.installed
        ? "installed"
        : null;
  if (!state) return null;
  return (
    <span className={styles.cardState} data-state={state}>
      {text.t(`cardState.${state}` as "cardState.installed")}
    </span>
  );
}
