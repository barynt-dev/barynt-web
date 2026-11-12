"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { Input } from "@/components/ui/atoms/Input/Input";
import type { SettingsNavItem } from "./SettingsNav";
import { type SettingsNavSection, searchSections } from "./searchSections";
import { OPEN_PARAM } from "./settingsView";

// The settings search (BARY-201): one query for the whole settings frame.
// Its field sits at the right of the scope tabs on a desktop and above the
// nav below that (`SettingsSearchField`, placed twice, shown once by CSS);
// the nav shows the hits (`useSettingsSearch`).

interface SettingsSearch {
  query: string;
  setQuery: (query: string) => void;
  /** The hits — every scope's sections (`index`) narrowed by the query. */
  hits: SettingsNavSection[];
  label: string;
  noHitsLabel: string;
}

const Context = createContext<SettingsSearch | null>(null);

/** Where a row leads: a scope's start page with `?open`, so a phone shows
 *  the page rather than the section list. */
export const settingsHref = (item: SettingsNavItem) =>
  item.start ? `${item.href}?${OPEN_PARAM}=1` : item.href;

export function SettingsSearchProvider({
  index,
  label,
  noHitsLabel,
  children,
}: {
  /** What the search looks through: one section per scope. */
  index: SettingsNavSection[];
  label: string;
  noHitsLabel: string;
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const hits = query.trim() ? searchSections(index, query) : [];
  return (
    <Context.Provider value={{ query, setQuery, hits, label, noHitsLabel }}>
      {children}
    </Context.Provider>
  );
}

/** The search, or `null` outside a provider. */
export const useSettingsSearch = () => useContext(Context);

/** The field: typing searches, Enter opens the first hit, Escape clears. */
export function SettingsSearchField({ className }: { className?: string }) {
  const search = useSettingsSearch();
  const router = useRouter();
  if (!search) return null;
  return (
    <Input
      variant="search"
      className={className}
      placeholder={search.label}
      aria-label={search.label}
      value={search.query}
      onChange={(e) => search.setQuery(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") search.setQuery("");
        const first = search.hits[0]?.items[0];
        if (e.key === "Enter" && first) {
          e.preventDefault();
          search.setQuery("");
          router.push(settingsHref(first));
        }
      }}
    />
  );
}
