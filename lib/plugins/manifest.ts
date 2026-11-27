// The plugin manifest (`manifest.json`): what a plugin is, where it works,
// what it asks for and what it adds. One schema, used by the installer, the
// store repository's CI and the plugin author's own tooling — so it has no
// dependency on the app (no Prisma, no `server-only`; the dashboard's widget
// rules it borrows are plain too).
//
// Strict on purpose: an unknown field is an error, not something to ignore.
// A plugin that declares more than Barynt understands should fail loudly
// instead of half-working.

import { z } from "zod";
import { pluginTemplateSchema } from "@/features/dashboard/widgets";
import { LINK_TRIGGERS } from "./link-rules";
import { compareSemver, isSemver } from "./semver";
import {
  eventCapability,
  isLocalServiceUrl,
  PLUGIN_EVENTS,
  SERVICE_ADDRESS_MODES,
  SERVICE_URL_MAX,
  type ServiceAddressMode,
} from "./service";
import { SETTING_TYPES } from "./settings";
import { translateManifest, translationIssues } from "./translate";

/** How a plugin runs. In-process code is Barynt's own and not a plugin kind. */
export const PLUGIN_KINDS = ["declarative", "sandbox", "service"] as const;
export type PluginKind = (typeof PLUGIN_KINDS)[number];

/** Where a plugin can be switched on. Issues are surfaces inside a project. */
export const PLUGIN_LEVELS = ["workspace", "project"] as const;
export type PluginLevel = (typeof PLUGIN_LEVELS)[number];

/**
 * What a plugin may ask for. `resource:action` like the API key scopes; the
 * `ui:*` ones say which slot it fills. A closed list — a plugin cannot invent
 * a capability.
 */
export const CAPABILITIES = [
  "issues:read",
  "issues:write",
  "comments:read",
  "comments:write",
  "labels:read",
  "projects:read",
  "members:read",
  "fields:read",
  "fields:write",
  "storage:own",
  "notify:send",
  "events:issue",
  "events:comment",
  // BARY-212: a service hears about projects and people too.
  "events:project",
  "events:member",
  // BARY-215: another service (GitLab, GitHub) may call it through Barynt.
  "webhooks:receive",
  "ui:nav-item",
  "ui:project-view",
  "ui:dashboard-widget",
  "ui:issue-panel",
  "ui:issue-badge",
  "ui:action",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

/** Plugin ids Barynt keeps for itself. */
export const RESERVED_PLUGIN_IDS = ["barynt", "core", "system", "admin"];

const ID_RE = /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/;
/** An id local to a plugin (`timeline`, `open-mr`). */
const LOCAL_ID_RE = /^[a-z][a-z0-9-]{0,38}[a-z0-9]$|^[a-z]$/;
const HOST_RE =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const ICON_RE = /^[a-z0-9-]+:[a-z0-9-]+$/;
/** A preview image in a release: `preview-1.webp` … `preview-6.png`. Flat
 *  names, because release assets on GitHub can't have folders. */
export const PREVIEW_FILE_RE = /^preview-[1-6]\.(webp|png)$/;
/** How many preview images a plugin may show. */
export const MAX_PREVIEWS = 6;
/** A plugin's logo in a release (BARY-235): square, PNG or WebP. */
export const LOGO_FILE_RE = /^logo\.(webp|png)$/;

/** The languages a plugin can describe itself in — Barynt's own
 *  (`i18n/routing.ts`). `description` is English; `locales` adds others. */
export const PLUGIN_LOCALES = ["de", "en"] as const;
export type PluginLocale = (typeof PLUGIN_LOCALES)[number];

/** Texts in other languages (BARY-235): `{ de: { description } }`. */
export const localesSchema = z
  .partialRecord(
    z.enum(PLUGIN_LOCALES),
    z.strictObject({
      description: z.string().trim().min(1).max(300).optional(),
    }),
  )
  .optional();

/** How long a plugin's page text may be (BARY-237), per language. */
export const ABOUT_MAX = 5000;

/** The page text as a file of the release: `about.md`, or `about.de.md` for
 *  a language of its own. Flat names, like the previews. */
export const ABOUT_FILE_RE = /^about(\.(de|en))?\.md$/;
export type AboutFileName = `about${"" | ".de" | ".en"}.md`;
/** A page text file may be this big — `ABOUT_MAX` characters, each up to
 *  four bytes of UTF-8. */
export const ABOUT_FILE_MAX_BYTES = 4 * ABOUT_MAX;

const summary = z.string().trim().min(1).max(300);
const aboutText = z.string().trim().min(1).max(ABOUT_MAX);

/**
 * A manifest's description (BARY-237): `short`, what the store's cards and
 * lists show, and `about`, the plugin's page — Markdown, or the name of a
 * file in the release (`about.md`).
 */
const descriptionSchema = z.strictObject(
  { short: summary, about: aboutText.optional() },
  { error: "expected { short, about }" },
);

/** The same in another language — either text may be left to English. */
const localeDescriptionSchema = z
  .strictObject(
    { short: summary.optional(), about: aboutText.optional() },
    { error: "expected { short, about }" },
  )
  .refine((d) => d.short || d.about, "expected short, about or both");

/** A contribution's text in another language: its main text, or its texts
 *  by name — `lib/plugins/translate.ts` checks them against the item. */
const itemTextSchema = z.union([
  z.string().trim().min(1).max(300),
  z.record(z.string(), z.unknown()),
]);

/** A manifest's texts in other languages (BARY-235, BARY-237): its
 *  description, and the titles, labels and descriptions of what it
 *  contributes and of its previews, by id — `lib/plugins/translate.ts`. */
const manifestLocalesSchema = z
  .partialRecord(
    z.enum(PLUGIN_LOCALES),
    z.strictObject({
      description: localeDescriptionSchema.optional(),
      contributes: z
        .record(z.string(), z.record(z.string(), itemTextSchema))
        .optional(),
      previews: z.record(z.string(), z.string().trim().min(1)).optional(),
    }),
  )
  .optional();

/** A description as a manifest (`{ short, about }`) or a directory entry
 *  (the short text alone) has it. */
type Texts = string | { short?: string; about?: string };
type Described = {
  description: Texts;
  locales?: Partial<Record<string, { description?: Texts }>>;
};

const shortOf = (d: Texts | undefined) =>
  typeof d === "string" ? d : d?.short;
const aboutOf = (d: Texts | undefined) =>
  typeof d === "object" ? d.about : undefined;

/** The page text in the person's language, else the manifest's own — never
 *  a file name a release didn't resolve. */
export function localizedAbout(
  plugin: Partial<Described>,
  locale: string,
): string | null {
  const text =
    aboutOf(plugin.locales?.[locale]?.description) ??
    aboutOf(plugin.description) ??
    null;
  return text && !ABOUT_FILE_RE.test(text) ? text : null;
}

/** Every place a manifest names its page text, as [path, value]. */
function aboutSlots(raw: unknown): [string[], unknown][] {
  const at = (o: unknown, key: string) =>
    o && typeof o === "object"
      ? (o as Record<string, unknown>)[key]
      : undefined;
  const slots: [string[], unknown][] = [
    [["description", "about"], at(at(raw, "description"), "about")],
  ];
  const locales = at(raw, "locales");
  if (locales && typeof locales === "object")
    for (const [lang, texts] of Object.entries(locales))
      slots.push([
        ["locales", lang, "description", "about"],
        at(at(texts, "description"), "about"),
      ]);
  return slots;
}

/** The page text files a manifest names — read before it's checked, like
 *  the previews, since they're part of the release hash. */
export function aboutFiles(raw: unknown): AboutFileName[] {
  const names = aboutSlots(raw)
    .map(([, value]) => value)
    .filter(
      (v): v is AboutFileName => typeof v === "string" && ABOUT_FILE_RE.test(v),
    );
  return [...new Set(names)];
}

/**
 * The manifest with each page text file it names put in its place, so
 * everything after reads the text as if it were written there. A file has to
 * be there, UTF-8 and no longer than an inline text may be; what it may show
 * is `aboutDoc`'s business, as for any page text.
 */
export function withAboutFiles(
  manifest: PluginManifest,
  files: Partial<Record<string, Uint8Array>>,
): { ok: true; manifest: PluginManifest } | { ok: false; detail: string } {
  const out = structuredClone(manifest) as unknown as Record<string, unknown>;
  for (const [path, value] of aboutSlots(manifest)) {
    if (typeof value !== "string" || !ABOUT_FILE_RE.test(value)) continue;
    const bytes = files[value];
    if (!bytes) return { ok: false, detail: `${value}: not found` };
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim();
    } catch {
      return { ok: false, detail: `${value}: not UTF-8 text` };
    }
    if (!text) return { ok: false, detail: `${value}: empty` };
    if (text.length > ABOUT_MAX)
      return {
        ok: false,
        detail: `${value}: longer than ${ABOUT_MAX} characters`,
      };
    let parent = out;
    for (const key of path.slice(0, -1))
      parent = parent[key] as Record<string, unknown>;
    parent[path[path.length - 1] as string] = text;
  }
  return { ok: true, manifest: out as unknown as PluginManifest };
}

/**
 * Where a plugin points to (BARY-237). The first kinds are links with a
 * label, listed in the store's "Links" box; the brands show as a row of
 * icons below them.
 */
export const TEXT_LINK_KINDS = [
  "homepage",
  "docs",
  "changelog",
  "issues",
  "support",
  "privacy",
  "terms",
] as const;
export const BRAND_LINK_KINDS = [
  "github",
  "gitlab",
  "discord",
  "slack",
  "matrix",
  "mastodon",
  "bluesky",
  "x",
  "youtube",
  "linkedin",
] as const;
export const PLUGIN_LINK_KINDS = [...TEXT_LINK_KINDS, ...BRAND_LINK_KINDS];
export type PluginLinkKind = (typeof PLUGIN_LINK_KINDS)[number];
export const MAX_LINKS = 10;
export interface PluginLink {
  kind: PluginLinkKind;
  url: string;
  title?: string;
}

/** The short description in the person's language, else the plugin's own —
 *  of a manifest or a directory entry. */
export function localizedDescription(
  plugin: Pick<Described, "description" | "locales">,
  locale: string,
): string {
  return (
    shortOf(plugin.locales?.[locale]?.description) ??
    shortOf(plugin.description) ??
    ""
  );
}

const localId = z
  .string()
  .regex(LOCAL_ID_RE, "lower-case letters, digits and -");
const title = z.string().trim().min(1).max(60);
const icon = z
  .string()
  .regex(ICON_RE, 'expected "set:name", e.g. "lucide:clock"');

const entry = z.strictObject({ id: localId, title, icon: icon.optional() });

/** An action (BARY-152): where it shows — every place by default — and,
 *  for one that can't be undone, the question Barynt asks first. */
const actionEntry = entry.extend({
  where: z
    .array(z.enum(["issueMenu", "cardMenu", "commandPalette"]))
    // None: only its issue panel starts it (`runAction`, BARY-238).
    .max(3)
    .optional(),
  confirm: z.string().trim().min(1).max(120).optional(),
  danger: z.boolean().optional(),
});

/** An issue panel: in the issue's main column (default), or a section of
 *  the sidebar next to its fields (BARY-209). */
const panelEntry = entry.extend({
  placement: z.enum(["main", "sidebar"]).optional(),
  /** How tall it may grow (px) before it scrolls inside — without, it's
   *  as tall as its content and only the issue scrolls (BARY-238). */
  maxHeight: z.number().int().min(120).max(4000).optional(),
});

/** A dashboard widget made of Barynt's own blocks (BARY-203): no code, no
 *  frame — Barynt draws it like a custom widget. */
const widgetTemplateSchema = pluginTemplateSchema.extend({
  id: localId,
  title,
  description: z.string().trim().max(200).optional(),
});

const optionSchema = z.strictObject({
  id: localId,
  label: title,
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

const fieldSchema = z.strictObject({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  name: title,
  type: z.enum([
    "TEXT",
    "NUMBER",
    "DATE",
    "SELECT",
    "MULTI_SELECT",
    "CHECKBOX",
    "URL",
    "USER",
  ]),
  options: z.array(optionSchema).max(50).optional(),
});

/** A value a `text` setting offers: `label` names it, `hint` shows what
 *  it gives (an example). */
const suggestionSchema = z.strictObject({
  id: localId,
  value: z.string().trim().min(1).max(500),
  label: title,
  hint: z.string().trim().max(120).optional(),
});

const settingSchema = z.strictObject({
  key: z.string().regex(/^[a-z][a-zA-Z0-9_]{0,39}$/),
  type: z.enum(SETTING_TYPES),
  label: title,
  description: z.string().max(300).optional(),
  /** The heading it's shown under: settings in a row with the same group
   *  share one. */
  group: title.optional(),
  /** The icon beside its group's heading — the first in the group wins. */
  groupIcon: icon.optional(),
  default: z
    .union([
      z.string().max(500),
      z.number(),
      z.boolean(),
      z.array(z.string().max(40)).max(50),
    ])
    .optional(),
  options: z.array(optionSchema).max(50).optional(),
  /** A `text` setting's ready-made values, offered in a menu beside the
   *  field — still free to type over. */
  suggestions: z.array(suggestionSchema).max(10).optional(),
});

/** A building block for custom widgets (BARY-205): Barynt draws the data
 *  the plugin hands over (`draw: "barynt"`, the default), or the plugin
 *  draws it in a frame of its own (`"plugin"`). Its settings are set per
 *  block in the widget's builder. */
const blockSchema = z.strictObject({
  id: localId,
  title,
  icon: icon.optional(),
  description: z.string().trim().max(200).optional(),
  draw: z.enum(["barynt", "plugin"]).optional(),
  settings: z
    .array(
      settingSchema.extend({
        type: z.enum(["text", "number", "boolean", "select"]),
      }),
    )
    .max(10)
    .optional(),
});

/** Where a credential is kept: once for the workspace, once per project,
 *  or each person their own (BARY-147). */
export const CREDENTIAL_LEVELS = ["workspace", "project", "user"] as const;
export type CredentialLevel = (typeof CREDENTIAL_LEVELS)[number];

/**
 * A secret the plugin needs for one of its hosts — an access token, say.
 * Barynt keeps it sealed and adds it to requests to `host` itself, as the
 * `header` with `{value}` in `format` replaced; the plugin never sees it.
 */
const credentialSchema = z.strictObject({
  key: z.string().regex(/^[a-z][a-zA-Z0-9_]{0,39}$/),
  label: title,
  description: z.string().max(300).optional(),
  level: z.enum(CREDENTIAL_LEVELS),
  host: z.string().regex(HOST_RE, "expected a host name"),
  header: z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9-]{0,63}$/, "expected a header name")
    .default("Authorization"),
  format: z
    .string()
    .max(100)
    .refine((f) => f.includes("{value}"), 'must contain "{value}"')
    .default("Bearer {value}"),
});

/** A webhook another service sends it through Barynt (BARY-215). */
const inboundHookSchema = z.strictObject({
  id: localId,
  title,
  /** Who calls — decides how Barynt checks the call. */
  provider: z.enum(["gitlab", "github", "generic"]),
  /** `forward` to the plugin's server, or `link`: Barynt reads the call
   *  itself and keeps what it says on the issues it names (BARY-226). */
  handle: z.enum(["forward", "link"]),
  /** What a `link` hook may do with an issue (BARY-227): each project picks
   *  the status to set, or leaves the rule off. */
  rules: z
    .array(z.strictObject({ id: localId, title, on: z.enum(LINK_TRIGGERS) }))
    .max(10)
    .optional(),
  /** A `link` hook's deployments without an environment (BARY-238): the
   *  key of a `json` setting whose `workflows` list names the workflows a
   *  run of counts as a deployment — `{ workflow, environment, branch?,
   *  production? }`. */
  workflowDeployments: z
    .string()
    .regex(/^[a-z][a-zA-Z0-9_]{0,39}$/)
    .optional(),
});

/** An account at another service the plugin works with (BARY-238): Barynt
 *  connects a workspace or project to it — for GitHub through the
 *  instance's GitHub App — keeps the token and adds it itself. */
export const CONNECTION_PROVIDERS = ["github"] as const;
export type ConnectionProvider = (typeof CONNECTION_PROVIDERS)[number];
/** The host a provider's API answers on — it must be in `network`. */
export const CONNECTION_HOSTS: Record<ConnectionProvider, string> = {
  github: "api.github.com",
};

const connectionSchema = z.strictObject({
  id: localId,
  title,
  provider: z.enum(CONNECTION_PROVIDERS),
});

/** A plugin's filters in the filter menu's rows, at most — the rest are
 *  the advanced editor's (BARY-238). */
export const MAIN_FILTERS_MAX = 3;

/** A dotted path into an entry — `state`, `runs.name`. */
const entryPath = z
  .string()
  .regex(
    /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*){0,4}$/,
    "a dotted path, e.g. runs.name",
  );
const whenValue = z.union([
  z.string().max(100),
  z.number(),
  z.boolean(),
  z.null(),
]);

/** One of a filter's options: its conditions on an entry (BARY-238). */
const filterOptionSchema = z.strictObject({
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9_-]{0,39}$/, "lower-case letters, digits, _ and -"),
  label: title,
  when: z
    .record(entryPath, z.union([whenValue, z.array(whenValue).max(10)]))
    .refine((w) => Object.keys(w).length <= 5, "at most 5 conditions")
    .optional(),
  absent: z.boolean().optional(),
});

/**
 * A filter for the issues' filter menu (BARY-238): which of the plugin's
 * entries it looks at (`kind`), and its options — each with conditions —
 * or the values of one field as options. Data only: Barynt matches it.
 */
const filterSchema = z
  .strictObject({
    id: localId,
    title,
    icon: icon.optional(),
    kind: z
      .string()
      .regex(/^[a-z][a-z0-9_]{0,39}$/, "lower-case letters, digits and _"),
    // In the filter menu's rows, or only in the advanced editor (default).
    menu: z.enum(["main", "advanced"]).optional(),
    options: z.array(filterOptionSchema).min(1).max(20).optional(),
    values: z
      .strictObject({
        field: entryPath,
        // "#{number} {title}" — `{path}` from the entry.
        label: z.string().trim().min(1).max(80).optional(),
        when: z
          .record(entryPath, z.union([whenValue, z.array(whenValue).max(10)]))
          .refine((w) => Object.keys(w).length <= 5, "at most 5 conditions")
          .optional(),
      })
      .optional(),
  })
  .refine(
    (f) => f.options !== undefined || f.values !== undefined,
    "expected options, values or both",
  );

const contributesSchema = z.strictObject({
  navItems: z.array(entry).max(5).optional(),
  projectViews: z.array(entry).max(5).optional(),
  dashboardWidgets: z.array(entry).max(5).optional(),
  widgetTemplates: z.array(widgetTemplateSchema).max(10).optional(),
  widgetBlocks: z.array(blockSchema).max(10).optional(),
  issuePanels: z.array(panelEntry).max(5).optional(),
  issueBadges: z.array(entry).max(5).optional(),
  actions: z.array(actionEntry).max(20).optional(),
  fields: z.array(fieldSchema).max(20).optional(),
  settings: z.array(settingSchema).max(30).optional(),
  credentials: z.array(credentialSchema).max(10).optional(),
  inboundHooks: z.array(inboundHookSchema).max(5).optional(),
  connections: z.array(connectionSchema).max(3).optional(),
  filters: z
    .array(filterSchema)
    .max(10)
    .refine(
      (list) =>
        list.filter((f) => f.menu === "main").length <= MAIN_FILTERS_MAX,
      `at most ${MAIN_FILTERS_MAX} filters in the main menu`,
    )
    .optional(),
  /** Draws its settings itself, in its own frame, instead of Barynt's form
   *  of `settings` (BARY-149) — or, `"section"`, below that form (BARY-204).
   *  Saving still goes through Barynt, checked against `settings`. */
  settingsPage: z.union([z.boolean(), z.literal("section")]).optional(),
});

type Contributes = z.infer<typeof contributesSchema>;

/** Which capability each contribution needs. */
const CONTRIBUTION_CAPABILITY: Record<
  Exclude<
    keyof Contributes,
    "settings" | "credentials" | "settingsPage" | "connections" | "filters"
  >,
  Capability
> = {
  navItems: "ui:nav-item",
  projectViews: "ui:project-view",
  dashboardWidgets: "ui:dashboard-widget",
  widgetTemplates: "ui:dashboard-widget",
  widgetBlocks: "ui:dashboard-widget",
  issuePanels: "ui:issue-panel",
  issueBadges: "ui:issue-badge",
  actions: "ui:action",
  fields: "fields:write",
  inboundHooks: "webhooks:receive",
};

/** What each kind may contribute: no code, no browser surface for services.
 *  Widget templates are data Barynt draws, so every kind may bring them. */
const KIND_CONTRIBUTIONS: Record<PluginKind, readonly (keyof Contributes)[]> = {
  // Filters are data Barynt matches, like templates: every kind.
  declarative: [
    "fields",
    "settings",
    "issueBadges",
    "widgetTemplates",
    "filters",
  ],
  service: ["fields", "settings", "widgetTemplates", "inboundHooks", "filters"],
  sandbox: [
    "widgetTemplates",
    "inboundHooks",
    "credentials",
    "connections",
    "settingsPage",
    "navItems",
    "projectViews",
    "dashboardWidgets",
    "widgetBlocks",
    "issuePanels",
    "issueBadges",
    "actions",
    "fields",
    "settings",
    "filters",
  ],
};

export const manifestSchema = z
  .strictObject({
    id: z
      .string()
      .regex(ID_RE, "lower-case letters, digits and -, 3 to 40 characters"),
    name: title,
    version: z.string().refine(isSemver, "expected MAJOR.MINOR.PATCH"),
    minBaryntVersion: z.string().refine(isSemver, "expected MAJOR.MINOR.PATCH"),
    maxBaryntVersion: z
      .string()
      .refine(isSemver, "expected MAJOR.MINOR.PATCH")
      .optional(),
    author: z.string().trim().min(1).max(80),
    authorUrl: z
      .url({ protocol: /^https?$/ })
      .max(300)
      .optional(),
    /** `{ short, about }`: the short text and the page text (BARY-237). */
    description: descriptionSchema,
    license: z.string().trim().min(1).max(40),
    kind: z.enum(PLUGIN_KINDS),
    levels: z.array(z.enum(PLUGIN_LEVELS)).min(1).max(2),
    capabilities: z.array(z.enum(CAPABILITIES)).max(CAPABILITIES.length),
    network: z.array(z.string().regex(HOST_RE, "expected a host name")).max(10),
    contributes: contributesSchema.default({}),
    /** The plugin's own server and what it hears about (BARY-212): Barynt
     *  sends each event there, signed, and retries when it's down. */
    service: z
      .strictObject({
        /** Where it is: required for `fixed`; for the others only what the
         *  form suggests. */
        url: z
          .url({ protocol: /^https?$/ })
          .max(SERVICE_URL_MAX)
          .optional(),
        /** Who runs it and gives its address (BARY-223). */
        address: z.enum(SERVICE_ADDRESS_MODES).optional(),
        events: z.array(z.enum(PLUGIN_EVENTS)).min(1).max(PLUGIN_EVENTS.length),
      })
      .optional(),
    /** Screenshots for the store, in the order they're shown (BARY-199). */
    /** Its picture in Barynt — the store, the sidebar, its settings
     *  (BARY-235). A file in the release, like the previews. */
    logo: z
      .string()
      .regex(LOGO_FILE_RE, 'expected "logo.png" or "logo.webp"')
      .optional(),
    /** Its description in other languages (BARY-235, BARY-237). */
    locales: manifestLocalesSchema,
    /** Its homepage, docs, issue tracker, community (BARY-237). */
    links: z
      .array(
        z.strictObject({
          kind: z.enum(PLUGIN_LINK_KINDS),
          url: z.url({ protocol: /^https$/ }).max(500),
          /** A label of its own; else the kind's. */
          title: title.optional(),
        }),
      )
      .max(MAX_LINKS)
      .optional(),
    previews: z
      .array(
        z.strictObject({
          file: z
            .string()
            .regex(
              PREVIEW_FILE_RE,
              'expected "preview-1.webp" … "preview-6.png"',
            ),
          title,
        }),
      )
      .max(MAX_PREVIEWS)
      .optional(),
  })
  .superRefine((m, ctx) => {
    const add = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

    if (RESERVED_PLUGIN_IDS.includes(m.id))
      add(["id"], `"${m.id}" is reserved for Barynt`);

    for (const [lang, texts] of Object.entries(m.locales ?? {}))
      if (texts)
        for (const issue of translationIssues(m, texts))
          add(["locales", lang, ...issue.path], issue.message);

    if (
      m.maxBaryntVersion &&
      compareSemver(m.maxBaryntVersion, m.minBaryntVersion) < 0
    )
      add(["maxBaryntVersion"], "must not be lower than minBaryntVersion");

    if (new Set(m.capabilities).size !== m.capabilities.length)
      add(["capabilities"], "capabilities must be unique");
    if (new Set(m.levels).size !== m.levels.length)
      add(["levels"], "levels must be unique");
    if (new Set(m.network).size !== m.network.length)
      add(["network"], "hosts must be unique");

    if (
      m.previews &&
      new Set(m.previews.map((p) => p.file)).size !== m.previews.length
    )
      add(["previews"], "preview files must be unique");
    if (m.links && new Set(m.links.map((l) => l.url)).size !== m.links.length)
      add(["links"], "link addresses must be unique");

    if (m.service) {
      if (m.kind === "declarative")
        add(["service"], "a declarative plugin has no server");
      // Only a server the maker runs is in the manifest for good; the
      // others' address comes from whoever runs them.
      if (serviceAddressMode(m.service) === "fixed") {
        if (!m.service.url)
          add(["service", "url"], "a fixed server needs its address");
        else {
          const url = new URL(m.service.url);
          const local = isLocalServiceUrl(url);
          if (url.protocol !== "https:" && !local)
            add(["service", "url"], "a service must be reached over https");
          if (!local && !m.network.includes(url.hostname))
            add(["service", "url"], "the host must be in network");
        }
      }
      if (new Set(m.service.events).size !== m.service.events.length)
        add(["service", "events"], "events must be unique");
      m.service.events.forEach((event, i) => {
        const needed = eventCapability(event);
        if (!m.capabilities.includes(needed))
          add(["service", "events", i], `needs the capability ${needed}`);
      });
    }

    (m.contributes.inboundHooks ?? []).forEach((hook, i) => {
      if (hook.handle === "forward" && !m.service)
        add(
          ["contributes", "inboundHooks", i, "handle"],
          "forward needs a service to forward to",
        );
      if (hook.rules?.length) {
        if (hook.handle !== "link")
          add(
            ["contributes", "inboundHooks", i, "rules"],
            "only a link hook has rules",
          );
        if (new Set(hook.rules.map((r) => r.id)).size !== hook.rules.length)
          add(
            ["contributes", "inboundHooks", i, "rules"],
            "ids must be unique",
          );
        if (!m.capabilities.includes("issues:write"))
          add(
            ["contributes", "inboundHooks", i, "rules"],
            "needs the capability issues:write",
          );
      }
      if (hook.workflowDeployments !== undefined) {
        const setting = m.contributes.settings?.find(
          (x) => x.key === hook.workflowDeployments,
        );
        if (hook.handle !== "link" || setting?.type !== "json")
          add(
            ["contributes", "inboundHooks", i, "workflowDeployments"],
            "names a json setting of a link hook",
          );
      }
      // Barynt reads GitHub's calls; GitLab's come next.
      if (hook.handle === "link" && hook.provider !== "github")
        add(
          ["contributes", "inboundHooks", i, "handle"],
          `link reads github only, not ${hook.provider}`,
        );
    });

    if (m.kind === "declarative" && m.network.length > 0)
      add(
        ["network"],
        "a declarative plugin has no code and cannot call hosts",
      );

    const allowed = KIND_CONTRIBUTIONS[m.kind];
    for (const key of Object.keys(m.contributes) as (keyof Contributes)[]) {
      const list = m.contributes[key];
      if (typeof list === "boolean" || typeof list === "string") {
        if (list && !allowed.includes(key))
          add(["contributes", key], `a ${m.kind} plugin cannot have ${key}`);
        continue;
      }
      if (!list || list.length === 0) continue;

      if (!allowed.includes(key))
        add(
          ["contributes", key],
          `a ${m.kind} plugin cannot contribute ${key}`,
        );

      if (
        key !== "settings" &&
        key !== "credentials" &&
        key !== "settingsPage" &&
        key !== "connections" &&
        // Data Barynt matches against what the plugin keeps already — no
        // capability of its own.
        key !== "filters"
      ) {
        const needed = CONTRIBUTION_CAPABILITY[key];
        if (!m.capabilities.includes(needed))
          add(["contributes", key], `needs the capability ${needed}`);
      }

      const ids = (list as { id?: string; key?: string }[]).map(
        (e) => e.id ?? e.key,
      );
      if (new Set(ids).size !== ids.length)
        add(["contributes", key], "ids must be unique");
    }

    (m.contributes.credentials ?? []).forEach((c, i) => {
      if (!m.network.includes(c.host))
        add(
          ["contributes", "credentials", i, "host"],
          "the host must be in network",
        );
      if (c.level !== "user" && !m.levels.includes(c.level))
        add(
          ["contributes", "credentials", i, "level"],
          `the plugin has no ${c.level} level`,
        );
      if (/^(cookie|host|content-length|transfer-encoding)$/i.test(c.header))
        add(
          ["contributes", "credentials", i, "header"],
          "Barynt sets this header itself",
        );
    });

    const connections = m.contributes.connections ?? [];
    connections.forEach((c, i) => {
      if (!m.network.includes(CONNECTION_HOSTS[c.provider]))
        add(
          ["contributes", "connections", i, "provider"],
          `${CONNECTION_HOSTS[c.provider]} must be in network`,
        );
    });
    if (new Set(connections.map((c) => c.provider)).size !== connections.length)
      add(["contributes", "connections"], "one connection per provider");

    (m.contributes.widgetBlocks ?? []).forEach((b, i) => {
      (b.settings ?? []).forEach((setting, j) => {
        const path = ["contributes", "widgetBlocks", i, "settings", j];
        if (setting.type === "select" && !setting.options?.length)
          add([...path, "options"], "a select setting needs options");
        if (setting.type !== "select" && setting.options)
          add([...path, "options"], "only select settings have options");
      });
      const keys = (b.settings ?? []).map((x) => x.key);
      if (new Set(keys).size !== keys.length)
        add(
          ["contributes", "widgetBlocks", i, "settings"],
          "keys must be unique",
        );
    });

    const widgetIds = new Set(
      (m.contributes.dashboardWidgets ?? []).map((w) => w.id),
    );
    (m.contributes.widgetTemplates ?? []).forEach((t, i) => {
      if (widgetIds.has(t.id))
        add(
          ["contributes", "widgetTemplates", i, "id"],
          "already the id of one of dashboardWidgets",
        );
    });

    if (
      m.contributes.settingsPage &&
      (m.contributes.settings ?? []).length === 0
    )
      add(
        ["contributes", "settingsPage"],
        "needs settings to save — the page draws them, Barynt keeps them",
      );

    const fields = m.contributes.fields ?? [];
    fields.forEach((f, i) => {
      const hasOptions = f.type === "SELECT" || f.type === "MULTI_SELECT";
      if (hasOptions && !(f.options && f.options.length > 0))
        add(
          ["contributes", "fields", i, "options"],
          "a choice field needs options",
        );
      if (!hasOptions && f.options)
        add(
          ["contributes", "fields", i, "options"],
          "only choice fields have options",
        );
    });

    const settings = m.contributes.settings ?? [];
    settings.forEach((s, i) => {
      // `member`, `label` and `status` choose from the place's — Barynt fills
      // those.
      const ownOptions = s.type === "select" || s.type === "multiselect";
      if (ownOptions && !(s.options && s.options.length > 0))
        add(
          ["contributes", "settings", i, "options"],
          `a ${s.type} setting needs options`,
        );
      if (!ownOptions && s.options)
        add(
          ["contributes", "settings", i, "options"],
          "only select and multiselect settings have options",
        );
      if (s.groupIcon && !s.group)
        add(
          ["contributes", "settings", i, "groupIcon"],
          "a group icon needs a group",
        );
      if (s.suggestions && s.type !== "text")
        add(
          ["contributes", "settings", i, "suggestions"],
          "only text settings have suggestions",
        );
      if (
        s.suggestions &&
        new Set(s.suggestions.map((x) => x.id)).size !== s.suggestions.length
      )
        add(
          ["contributes", "settings", i, "suggestions"],
          "suggestion ids must be unique",
        );
      if (s.type === "repositories" && connections.length === 0)
        add(
          ["contributes", "settings", i, "type"],
          "a repositories setting needs a connection to list them from",
        );
      if (s.type === "repositories" && s.default !== undefined)
        add(
          ["contributes", "settings", i, "default"],
          "a repositories setting has no default",
        );
      if (
        s.type !== "repositories" &&
        Array.isArray(s.default) !== (s.type === "multiselect") &&
        s.default !== undefined
      )
        add(
          ["contributes", "settings", i, "default"],
          s.type === "multiselect"
            ? "a multiselect's default is a list of option ids"
            : "only a multiselect's default is a list",
        );
    });
  });

export type PluginManifest = z.infer<typeof manifestSchema>;

export interface ManifestIssue {
  path: string;
  message: string;
}

export type ManifestResult =
  | { ok: true; manifest: PluginManifest }
  | { ok: false; errors: ManifestIssue[] };

/** Validate a parsed `manifest.json`. Never throws. With a `locale`, the
 *  manifest comes back with its texts in that language, as far as it has
 *  them (`translateManifest`) — for showing it, never for storing it. */
export function validateManifest(
  input: unknown,
  locale?: string,
): ManifestResult {
  const parsed = manifestSchema.safeParse(input);
  if (parsed.success)
    return {
      ok: true,
      manifest: locale ? translateManifest(parsed.data, locale) : parsed.data,
    };
  return {
    ok: false,
    errors: parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })),
  };
}

/**
 * Does this plugin run on this Barynt version? A plugin states the lowest
 * version it was built for, and optionally the highest it was tested on.
 */
export function isCompatible(
  manifest: Pick<PluginManifest, "minBaryntVersion" | "maxBaryntVersion">,
  baryntVersion: string,
): boolean {
  if (compareSemver(baryntVersion, manifest.minBaryntVersion) < 0) return false;
  if (
    manifest.maxBaryntVersion &&
    compareSemver(baryntVersion, manifest.maxBaryntVersion) > 0
  )
    return false;
  return true;
}

/** How a manifest's server is reached — `fixed` unless it says otherwise. */
export const serviceAddressMode = (service: {
  address?: ServiceAddressMode;
}): ServiceAddressMode => service.address ?? "fixed";
