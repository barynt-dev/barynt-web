// A plugin's filters (BARY-238): declared in its manifest
// (`contributes.filters`), matched by Barynt against what the plugin keeps
// on issues (`PluginIssueData`) — no plugin code runs. A filter looks at the
// entries of one `kind` ("pull_request", "checks"); each option says which
// of them count:
//
//   { "id": "approved", "label": "Approved",
//     "when": { "state": "open", "review": "approved" } }
//
// — an issue with such an entry is in. `absent: true` turns it round: an
// issue with none is ("No pull request"). Or the filter takes the values
// of one field as its options (`values: { field: "runs.name" }` — every
// workflow seen). Paths walk into objects with dots and through arrays.
// Pure: no DB, runs in tests.

/** What a condition compares with: one value, or any of a list. */
export type FilterWhen =
  | string
  | number
  | boolean
  | null
  | (string | number | boolean | null)[];

export interface PluginFilterOption {
  id: string;
  label: string;
  /** Conditions on an entry's fields, all of them — none: any entry. */
  when?: Record<string, FilterWhen>;
  /** Issues with no such entry, rather than with one. */
  absent?: boolean;
}

export interface PluginFilterDef {
  id: string;
  title: string;
  icon?: string;
  /** Which entries it looks at: their `kind`. */
  kind: string;
  /** Its options, each with its conditions … */
  options?: PluginFilterOption[];
  /** … and/or the values of a field, as found, as further options: of the
   *  entries meeting `when`, named by `label` — `{path}` filled in from
   *  the entry ("#{number} {title}"), the value itself without. */
  values?: {
    field: string;
    label?: string;
    when?: Record<string, FilterWhen>;
  };
}

/** A plugin's filter as the filter menu shows it: the rule's field
 *  (`pl:<plugin>:<filter>`), its name, and the options to pick from. */
export interface PluginFilterFacet {
  field: `pl:${string}:${string}`;
  pluginName: string;
  title: string;
  icon?: string;
  /** `found`: one of the values found, after its own options. */
  options: { id: string; label: string; found?: true }[];
}

/** An entry as stored: on which issue, and what. */
export interface FilterEntry {
  issueId: string;
  value: unknown;
}

/** Most options a filter built from values offers. */
export const FILTER_VALUES_MAX = 50;

/** The values at a dotted path — through arrays, flattened. Only plain
 *  values; objects at the end don't count. */
export function valuesAt(value: unknown, path: string): unknown[] {
  let current: unknown[] = [value];
  for (const step of path.split(".")) {
    current = current.flatMap((v) => {
      const list: unknown[] = Array.isArray(v) ? v.flat() : [v];
      return list.flatMap((x) =>
        x && typeof x === "object" && !Array.isArray(x) && step in x
          ? [(x as Record<string, unknown>)[step]]
          : [],
      );
    });
  }
  return current
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .filter((v) => v === null || typeof v !== "object");
}

/** Whether an entry meets every condition. A `null` wanted matches a
 *  field that's missing or null. */
function meets(value: unknown, when: Record<string, FilterWhen> = {}) {
  return Object.entries(when).every(([path, want]) => {
    const wanted = Array.isArray(want) ? want : [want];
    const found = valuesAt(value, path);
    if (found.length === 0) return wanted.includes(null);
    return found.some((v) => wanted.includes(v as never));
  });
}

const kindOf = (value: unknown) =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>).kind
    : undefined;

/** One part of a match, OR-ed with the others: these issues — or, with
 *  `except`, every issue but these. */
export interface MatchTerm {
  issueIds: string[];
  except: boolean;
}

/**
 * Which issues one of the options picked takes in: a term per option. An
 * option the filter doesn't have takes in nothing (a stale link narrows to
 * nothing of it rather than failing).
 */
export function matchTerms(
  def: PluginFilterDef,
  picked: string[],
  entries: FilterEntry[],
): MatchTerm[] {
  const own = entries.filter((e) => kindOf(e.value) === def.kind);
  const issuesWhere = (test: (value: unknown) => boolean) => [
    ...new Set(own.filter((e) => test(e.value)).map((e) => e.issueId)),
  ];
  return picked.flatMap((id): MatchTerm[] => {
    // Its own option first …
    const option = def.options?.find((o) => o.id === id);
    if (option)
      return [
        {
          issueIds: issuesWhere((v) => meets(v, option.when)),
          except: option.absent === true,
        },
      ];
    // … else one of the values.
    const values = def.values;
    if (!values) return [];
    return [
      {
        issueIds: issuesWhere(
          (v) =>
            meets(v, values.when) &&
            valuesAt(v, values.field).some((x) => String(x) === id),
        ),
        except: false,
      },
    ];
  });
}

/** A value's name: the template with `{path}` filled in from its entry. */
function labelOf(template: string | undefined, value: string, entry: unknown) {
  if (!template) return value;
  return template
    .replace(/\{([A-Za-z0-9_.]+)\}/g, (_, path: string) => {
      const found = valuesAt(entry, path)[0];
      return found === undefined || found === null ? "" : String(found);
    })
    .trim()
    .slice(0, 120);
}

/** The options to offer: its own first, then the values found (sorted
 *  by name, numbers as numbers, at most `FILTER_VALUES_MAX`). */
export function filterOptions(
  def: PluginFilterDef,
  entries: FilterEntry[],
): { id: string; label: string; found?: true }[] {
  const own = (def.options ?? []).map((o) => ({ id: o.id, label: o.label }));
  const values = def.values;
  if (!values) return own;
  const found = new Map<string, string>();
  for (const e of entries)
    if (kindOf(e.value) === def.kind && meets(e.value, values.when))
      for (const v of valuesAt(e.value, values.field)) {
        const id = v === null ? "" : String(v);
        if (id && !found.has(id) && !own.some((o) => o.id === id))
          found.set(id, labelOf(values.label, id, e.value) || id);
      }
  const listed = [...found]
    .map(([id, label]) => ({ id, label, found: true as const }))
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true }),
    )
    .slice(0, FILTER_VALUES_MAX);
  return [...own, ...listed];
}
