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
 * A manifest's description: the short text the store's cards show, and the
 * page text (BARY-237) — Markdown, or the name of a file in the release
 * (`about.md`). A plain string is the short text alone, as before.
 */
const descriptionSchema = z.union(
  [summary, z.strictObject({ short: summary, about: aboutText.optional() })],
  { error: "expected a text, or { short, about }" },
);
export type ManifestDescription = z.infer<typeof descriptionSchema>;

/** A manifest's texts in other languages. `about` beside the description is
 *  the older place of the page text, still read. A directory entry only has
 *  the short description. */
const manifestLocalesSchema = z
  .partialRecord(
    z.enum(PLUGIN_LOCALES),
    z.strictObject({
      description: descriptionSchema.optional(),
      about: aboutText.optional(),
    }),
  )
  .optional();

type Described = {
  description: ManifestDescription;
  about?: string;
  locales?: Partial<
    Record<string, { description?: ManifestDescription; about?: string }>
  >;
};

const shortOf = (d: ManifestDescription | undefined) =>
  typeof d === "string" ? d : d?.short;
const aboutOf = (d: ManifestDescription | undefined) =>
  typeof d === "object" ? d.about : undefined;

/** The page text in the person's language, else the manifest's own — never
 *  a file name a release didn't resolve. */
export function localizedAbout(
  plugin: Partial<Described>,
  locale: string,
): string | null {
  const own = plugin.locales?.[locale];
  const text =
    aboutOf(own?.description) ??
    own?.about ??
    aboutOf(plugin.description) ??
    plugin.about ??
    null;
  return text && !ABOUT_FILE_RE.test(text) ? text : null;
}

/** Every place a manifest names its page text, as [path, value]. */
function aboutSlots(raw: unknown): [(string | number)[], unknown][] {
  if (!raw || typeof raw !== "object") return [];
  const m = raw as Record<string, unknown>;
  const at = (o: unknown, key: string) =>
    o && typeof o === "object"
      ? (o as Record<string, unknown>)[key]
      : undefined;
  const slots: [(string | number)[], unknown][] = [
    [["description", "about"], at(m.description, "about")],
    [["about"], m.about],
  ];
  const locales = m.locales;
  if (locales && typeof locales === "object")
    for (const [lang, texts] of Object.entries(locales))
      slots.push(
        [
          ["locales", lang, "description", "about"],
          at(at(texts, "description"), "about"),
        ],
        [["locales", lang, "about"], at(texts, "about")],
      );
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
    .min(1)
    .max(3)
    .optional(),
  confirm: z.string().trim().min(1).max(120).optional(),
  danger: z.boolean().optional(),
});

/** An issue panel: in the issue's main column (default), or a section of
 *  the sidebar next to its fields (BARY-209). */
const panelEntry = entry.extend({
  placement: z.enum(["main", "sidebar"]).optional(),
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

const settingSchema = z.strictObject({
  key: z.string().regex(/^[a-z][a-zA-Z0-9_]{0,39}$/),
  type: z.enum(SETTING_TYPES),
  label: title,
  description: z.string().max(300).optional(),
  default: z
    .union([
      z.string().max(500),
      z.number(),
      z.boolean(),
      z.array(z.string().max(40)).max(50),
    ])
    .optional(),
  options: z.array(optionSchema).max(50).optional(),
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
});

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
  /** Draws its settings itself, in its own frame, instead of Barynt's form
   *  of `settings` (BARY-149) — or, `"section"`, below that form (BARY-204).
   *  Saving still goes through Barynt, checked against `settings`. */
  settingsPage: z.union([z.boolean(), z.literal("section")]).optional(),
});

type Contributes = z.infer<typeof contributesSchema>;

/** Which capability each contribution needs. */
const CONTRIBUTION_CAPABILITY: Record<
  Exclude<keyof Contributes, "settings" | "credentials" | "settingsPage">,
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
  declarative: ["fields", "settings", "issueBadges", "widgetTemplates"],
  service: ["fields", "settings", "widgetTemplates", "inboundHooks"],
  sandbox: [
    "widgetTemplates",
    "inboundHooks",
    "credentials",
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
    /** The short text, or `{ short, about }` with the page text (BARY-237). */
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
    /** Its description in other languages (BARY-235), and its page text
     *  (BARY-237). */
    locales: manifestLocalesSchema,
    /** Its page in the store (BARY-237), where it was before
     *  `description.about` — still read. Markdown, shown without links,
     *  images or HTML; those go in `links`. */
    about: aboutText.optional(),
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

    // One page text per language, in one place.
    if (typeof m.description === "object" && m.description.about && m.about)
      add(["about"], "the page text is already in description.about");
    for (const [lang, texts] of Object.entries(m.locales ?? {}))
      if (
        typeof texts?.description === "object" &&
        texts.description.about &&
        texts.about
      )
        add(
          ["locales", lang, "about"],
          "the page text is already in description.about",
        );

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
        key !== "settingsPage"
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
      if (
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

/** Validate a parsed `manifest.json`. Never throws. */
export function validateManifest(input: unknown): ManifestResult {
  const parsed = manifestSchema.safeParse(input);
  if (parsed.success) return { ok: true, manifest: parsed.data };
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
