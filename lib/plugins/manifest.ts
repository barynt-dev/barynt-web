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
import { compareSemver, isSemver } from "./semver";
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

const localId = z
  .string()
  .regex(LOCAL_ID_RE, "lower-case letters, digits and -");
const title = z.string().trim().min(1).max(60);
const icon = z
  .string()
  .regex(ICON_RE, 'expected "set:name", e.g. "lucide:clock"');

const entry = z.strictObject({ id: localId, title, icon: icon.optional() });

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

const contributesSchema = z.strictObject({
  navItems: z.array(entry).max(5).optional(),
  projectViews: z.array(entry).max(5).optional(),
  dashboardWidgets: z.array(entry).max(5).optional(),
  widgetTemplates: z.array(widgetTemplateSchema).max(10).optional(),
  widgetBlocks: z.array(blockSchema).max(10).optional(),
  issuePanels: z.array(entry).max(5).optional(),
  issueBadges: z.array(entry).max(5).optional(),
  actions: z.array(entry).max(20).optional(),
  fields: z.array(fieldSchema).max(20).optional(),
  settings: z.array(settingSchema).max(30).optional(),
  credentials: z.array(credentialSchema).max(10).optional(),
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
};

/** What each kind may contribute: no code, no browser surface for services.
 *  Widget templates are data Barynt draws, so every kind may bring them. */
const KIND_CONTRIBUTIONS: Record<PluginKind, readonly (keyof Contributes)[]> = {
  declarative: ["fields", "settings", "issueBadges", "widgetTemplates"],
  service: ["fields", "settings", "widgetTemplates"],
  sandbox: [
    "widgetTemplates",
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
    description: z.string().trim().min(1).max(300),
    license: z.string().trim().min(1).max(40),
    kind: z.enum(PLUGIN_KINDS),
    levels: z.array(z.enum(PLUGIN_LEVELS)).min(1).max(2),
    capabilities: z.array(z.enum(CAPABILITIES)).max(CAPABILITIES.length),
    network: z.array(z.string().regex(HOST_RE, "expected a host name")).max(10),
    contributes: contributesSchema.default({}),
    /** Screenshots for the store, in the order they're shown (BARY-199). */
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
      // `member` and `label` choose from the place's — Barynt fills those.
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
