"use client";

import { Icon } from "@iconify/react";
import { useRef, useState } from "react";
import { Chip } from "@/components/ui/atoms/Chip/Chip";
import { Popover } from "@/components/ui/atoms/Popover/Popover";
import type { StoreEntry } from "@/features/plugins/queries";
import { PLUGIN_CATEGORIES } from "@/lib/plugins/directory";
import { PLUGIN_KINDS } from "@/lib/plugins/manifest";
import { usePluginText } from "../shared";
import styles from "./pluginStore.module.scss";

/** What the list can be narrowed to besides the search — each facet a set
 *  of values, a plugin passing when it has any of them (none set: all). */
export type StoreFacets = {
  category: string[];
  kind: string[];
  level: string[];
  source: string[];
};
export type StoreFacet = keyof StoreFacets;

export const NO_FACETS: StoreFacets = {
  category: [],
  kind: [],
  level: [],
  source: [],
};

const FACETS: StoreFacet[] = ["category", "kind", "level", "source"];

/** A plugin's values for each facet. */
function valuesOf(entry: StoreEntry, facet: StoreFacet): string[] {
  if (facet === "category") return entry.listing?.categories ?? [];
  if (facet === "kind") return [entry.kind];
  if (facet === "level") return entry.levels;
  return entry.listing ? [entry.listing.sourceName] : [];
}

export function matchesFacets(entry: StoreEntry, facets: StoreFacets) {
  return FACETS.every(
    (f) =>
      facets[f].length === 0 ||
      valuesOf(entry, f).some((v) => facets[f].includes(v)),
  );
}

export function activeFacets(facets: StoreFacets): number {
  return FACETS.reduce((n, f) => n + facets[f].length, 0);
}

/** The values each facet knows, in the order shown; sources are whatever
 *  the plugins name. */
const KNOWN: Partial<Record<StoreFacet, readonly string[]>> = {
  category: PLUGIN_CATEGORIES,
  kind: PLUGIN_KINDS,
  level: ["workspace", "project"],
};

/** The values a facet offers: those some plugin has. A value it doesn't
 *  know (a manifest that no longer reads) isn't offered. */
function offered(entries: StoreEntry[], facet: StoreFacet): string[] {
  const seen = new Set(entries.flatMap((e) => valuesOf(e, facet)));
  const known = KNOWN[facet];
  return known ? known.filter((v) => seen.has(v)) : [...seen].sort();
}

/** How a facet's value reads. */
export function useFacetLabel() {
  const text = usePluginText();
  return (facet: StoreFacet, value: string) =>
    facet === "category"
      ? text.t(`category.${value}` as "category.planning")
      : facet === "kind"
        ? text.t(`kind.${value}` as "kind.sandbox")
        : facet === "level"
          ? text.t(`level.${value}` as "level.project")
          : value;
}

/**
 * The button at the end of the search field and the menu it opens (a bottom
 * sheet on a phone): every facet with more than one value to choose from.
 */
export function StoreFilterButton({
  entries,
  facets,
  onChange,
}: {
  entries: StoreEntry[];
  facets: StoreFacets;
  onChange: (next: StoreFacets) => void;
}) {
  const text = usePluginText();
  const label = useFacetLabel();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const count = activeFacets(facets);
  // One value isn't a choice — unless it's already picked.
  const groups = FACETS.map((facet) => ({
    facet,
    values: offered(entries, facet),
  })).filter((g) => g.values.length > 1 || facets[g.facet].length > 0);

  const toggle = (facet: StoreFacet, value: string) =>
    onChange({
      ...facets,
      [facet]: facets[facet].includes(value)
        ? facets[facet].filter((v) => v !== value)
        : [...facets[facet], value],
    });

  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={styles.filterButton}
        data-active={count > 0 || undefined}
        aria-label={text.t("facets.title")}
        title={text.t("facets.title")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon icon="lucide:sliders-horizontal" width={15} aria-hidden />
        {count > 0 && <span className={styles.filterCount}>{count}</span>}
      </button>
      <Popover
        anchorRef={anchor}
        open={open}
        onClose={() => setOpen(false)}
        align="end"
        width={300}
        title={text.t("facets.title")}
      >
        <div className={styles.filterMenu}>
          {groups.length === 0 && (
            <p className={styles.filterNone}>{text.t("facets.none")}</p>
          )}
          {groups.map(({ facet, values }) => (
            <section key={facet} className={styles.filterGroup}>
              <h3>{text.t(`facets.${facet}`)}</h3>
              <div className={styles.filters}>
                {values.map((value) => (
                  <Chip
                    key={value}
                    type="filter"
                    selected={facets[facet].includes(value)}
                    onClick={() => toggle(facet, value)}
                  >
                    {label(facet, value)}
                  </Chip>
                ))}
              </div>
            </section>
          ))}
          {count > 0 && (
            <button
              type="button"
              className={styles.filterReset}
              onClick={() => onChange(NO_FACETS)}
            >
              {text.t("facets.reset")}
            </button>
          )}
        </div>
      </Popover>
    </>
  );
}

/** What's picked, as chips under the search field, each to take back. */
export function ActiveFacets({
  facets,
  onRemove,
}: {
  facets: StoreFacets;
  onRemove: (facet: StoreFacet, value: string) => void;
}) {
  const text = usePluginText();
  const label = useFacetLabel();
  if (activeFacets(facets) === 0) return null;
  const icon: Record<StoreFacet, string> = {
    category: "lucide:tag",
    kind: "lucide:box",
    level: "lucide:layers",
    source: "lucide:database",
  };
  return (
    <div className={styles.filters}>
      {FACETS.flatMap((facet) =>
        facets[facet].map((value) => (
          <Chip
            key={`${facet}:${value}`}
            type="input"
            selected
            icon={<Icon icon={icon[facet]} width={14} />}
            onRemove={() => onRemove(facet, value)}
            removeLabel={text.t("facets.remove", {
              name: label(facet, value),
            })}
          >
            {label(facet, value)}
          </Chip>
        )),
      )}
    </div>
  );
}
