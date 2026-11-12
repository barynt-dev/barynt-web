"use client";

import { Icon } from "@iconify/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Input } from "@/components/ui/atoms/Input/Input";
import type { SettingsNavItem } from "./SettingsNav";
import {
  preferSettings,
  type SettingsNavSection,
  searchSections,
} from "./searchSections";
import styles from "./settingsSearch.module.scss";
import { OPEN_PARAM } from "./settingsView";

// The settings search (BARY-201): one field for the whole settings frame —
// at the right of the scope tabs on a desktop, above the nav below that
// (`SettingsSearchField`, placed twice, shown once by CSS). Its hits open in
// a dropdown under the field: sections and single settings of every scope.
// A setting's hit leads to its page with `?setting=<label>`, and
// `SettingsFocus` scrolls to that setting there, marks it and focuses its
// control.

/** The query parameter naming the setting to show on arrival. */
export const SETTING_PARAM = "setting";

/** At most this many hits in the dropdown — the rest by typing more. */
const MAX_HITS = 12;

interface SettingsSearch {
  index: SettingsNavSection[];
  label: string;
  noHitsLabel: string;
}

const Context = createContext<SettingsSearch | null>(null);

/** Where a row leads: a scope's start page with `?open`, so a phone shows
 *  the page rather than the section list; a setting with `?setting`. */
export function settingsHref(item: SettingsNavItem): string {
  const params = new URLSearchParams();
  if (item.start) params.set(OPEN_PARAM, "1");
  if (item.focus) params.set(SETTING_PARAM, item.focus);
  const query = params.toString();
  return query ? `${item.href}?${query}` : item.href;
}

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
  return (
    <Context.Provider value={{ index, label, noHitsLabel }}>
      {children}
      <SettingsFocus />
    </Context.Provider>
  );
}

/** The field with its dropdown. Arrow keys move through the hits, Enter
 *  opens the marked one, Escape closes. Renders nothing outside a
 *  provider. */
export function SettingsSearchField() {
  const search = useContext(Context);
  const router = useRouter();
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // A click anywhere else closes the dropdown.
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  if (!search) return null;

  // The hits, cut down to `MAX_HITS` and flattened for the arrow keys.
  const groups: SettingsNavSection[] = [];
  let left = MAX_HITS;
  for (const section of query.trim()
    ? preferSettings(searchSections(search.index, query))
    : []) {
    if (left <= 0) break;
    const items = section.items.slice(0, left);
    left -= items.length;
    groups.push({ ...section, items });
  }
  const flat = groups.flatMap((g) => g.items);
  const shown = open && query.trim() !== "";

  const go = (item: SettingsNavItem) => {
    setQuery("");
    setOpen(false);
    router.push(settingsHref(item));
  };

  let n = -1;
  return (
    <div className={styles.box} ref={box}>
      <Input
        variant="search"
        placeholder={search.label}
        aria-label={search.label}
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={
          shown && flat[active] ? `${listId}-${active}` : undefined
        }
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            if (shown) setOpen(false);
            else setQuery("");
          } else if (e.key === "ArrowDown" && flat.length > 0) {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (i + 1) % flat.length);
          } else if (e.key === "ArrowUp" && flat.length > 0) {
            e.preventDefault();
            setActive((i) => (i - 1 + flat.length) % flat.length);
          } else if (e.key === "Enter" && flat[active]) {
            e.preventDefault();
            go(flat[active]);
          }
        }}
      />
      {shown && (
        <div className={styles.dropdown} id={listId} role="listbox">
          {flat.length === 0 && (
            <p className={styles.empty}>{search.noHitsLabel}</p>
          )}
          {groups.map((group) => (
            <div key={group.title}>
              <p className={styles.groupTitle}>{group.title}</p>
              {group.items.map((item) => {
                n += 1;
                const i = n;
                return (
                  <div
                    key={`${item.href}:${item.focus ?? ""}`}
                    id={`${listId}-${i}`}
                    role="option"
                    tabIndex={-1}
                    aria-selected={i === active}
                    className={styles.hit}
                    onPointerEnter={() => setActive(i)}
                    // Before the field loses focus, so the click lands.
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => go(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") go(item);
                    }}
                  >
                    <span className={styles.hitIcon}>
                      {item.leading ?? (
                        <Icon icon={item.icon} width={16} aria-hidden />
                      )}
                    </span>
                    <span className={styles.hitText}>
                      <span className={styles.hitLabel}>{item.label}</span>
                      {item.context && (
                        <span className={styles.hitContext}>
                          {item.context}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * On arrival with `?setting=<label>`: finds the setting on the page by its
 * label, scrolls it into view, marks it (`data-setting-focus`, a short
 * glow) and focuses its control — then drops the parameter from the
 * address. The page may still be streaming in, so it looks a few times.
 */
function SettingsFocus() {
  const params = useSearchParams();
  const pathname = usePathname();
  const label = params.get(SETTING_PARAM);

  useEffect(() => {
    if (!label) return;
    let tries = 0;
    let timer = 0;
    const look = () => {
      const target = findSetting(label);
      if (!target && tries++ < 20) {
        timer = window.setTimeout(look, 100);
        return;
      }
      const rest = new URLSearchParams(window.location.search);
      rest.delete(SETTING_PARAM);
      const query = rest.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${pathname}${query ? `?${query}` : ""}`,
      );
      if (!target) return;
      const { row, control } = target;
      row.scrollIntoView({ block: "center", behavior: "smooth" });
      row.removeAttribute("data-setting-focus");
      // Read a layout value so the glow restarts on the same row too.
      void row.offsetWidth;
      row.setAttribute("data-setting-focus", "");
      window.setTimeout(() => row.removeAttribute("data-setting-focus"), 2600);
      control?.focus({ preventScroll: true });
    };
    look();
    return () => window.clearTimeout(timer);
  }, [label, pathname]);

  return null;
}

/** The element on the settings page whose own text is `label` — a row's
 *  label, a field's label or a heading — with the row it stands for and
 *  that row's first control. */
function findSetting(
  label: string,
): { row: HTMLElement; control: HTMLElement | null } | null {
  const panel = document.querySelector<HTMLElement>("[data-settings-panel]");
  if (!panel) return null;
  const wanted = label.trim().toLocaleLowerCase();
  const candidates = panel.querySelectorAll<HTMLElement>(
    "h2, h3, h4, label, legend, span, p, th",
  );
  for (const el of candidates) {
    if (el.textContent?.trim().toLocaleLowerCase() !== wanted) continue;
    const row =
      el.closest<HTMLElement>("[role='row'], tr, fieldset, section") ??
      el.parentElement ??
      el;
    const forId = el instanceof HTMLLabelElement ? el.htmlFor : "";
    const control =
      (forId ? document.getElementById(forId) : null) ??
      row.querySelector<HTMLElement>(
        "input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [role='switch'], [tabindex='0']",
      );
    return { row, control };
  }
  return null;
}
