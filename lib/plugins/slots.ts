import type { Capability, PluginManifest } from "./manifest";

// The places a sandboxed plugin can fill in Barynt (BARY-148) — a fixed,
// versioned list: a plugin can't put anything anywhere else. Each slot names
// the manifest list that declares it, the capability it needs confirmed, and
// how it's addressed. Shared by the sidebar, the frame route and the runtime.

/** Bumped when a slot changes in a way a plugin would notice. */
export const SLOT_API_VERSION = 1;

export const SLOTS = {
  /** A view of its own: in a project under the project in the sidebar, in a
   *  workspace in the sidebar's main group. */
  projectView: {
    contributes: "projectViews",
    capability: "ui:project-view",
    path: "view",
  },
  /** A page with an entry in the sidebar's "Plugins" section — the
   *  workspace's, or under the project's. */
  page: {
    contributes: "navItems",
    capability: "ui:nav-item",
    path: "page",
  },
  /** A widget on a dashboard — the workspace's, a project's, a view's
   *  (BARY-149). Not a page of its own: no `path`. */
  widget: {
    contributes: "dashboardWidgets",
    capability: "ui:dashboard-widget",
    path: null,
  },
  /** A panel in an issue's detail — side panel, dialog, page, phone sheet
   *  (BARY-150). Not a page of its own. */
  issuePanel: {
    contributes: "issuePanels",
    capability: "ui:issue-panel",
    path: null,
  },
  /** A building block in a custom widget (BARY-205) — drawn there, either
   *  by Barynt from the plugin's data or in a frame of the plugin's. */
  block: {
    contributes: "widgetBlocks",
    capability: "ui:dashboard-widget",
    path: null,
  },
} as const satisfies Record<
  string,
  {
    contributes: keyof PluginManifest["contributes"];
    capability: Capability;
    path: string | null;
  }
>;

export type SlotKind = keyof typeof SLOTS;

export const isSlotKind = (kind: unknown): kind is SlotKind =>
  typeof kind === "string" && Object.hasOwn(SLOTS, kind);

/** A slot kind by the path segment it's addressed with (`view`, `page`);
 *  a widget or block has none — it's only ever on a dashboard. */
export function slotKindOfPath(path: string): SlotKind | null {
  for (const [kind, slot] of Object.entries(SLOTS))
    if (slot.path !== null && slot.path === path) return kind as SlotKind;
  return null;
}

export interface SlotEntry {
  kind: SlotKind;
  id: string;
  title: string;
  icon: string | null;
}

/** What a plugin fills where it runs: the entries of its manifest whose
 *  capability was confirmed there. */
export function slotEntries(
  manifest: PluginManifest,
  confirmed: readonly string[],
): SlotEntry[] {
  if (manifest.kind !== "sandbox") return [];
  return (Object.keys(SLOTS) as SlotKind[]).flatMap((kind) => {
    const slot = SLOTS[kind];
    if (!confirmed.includes(slot.capability)) return [];
    const list = manifest.contributes[slot.contributes] as
      | { id: string; title: string; icon?: string }[]
      | undefined;
    return (list ?? []).map((entry) => ({
      kind,
      id: entry.id,
      title: entry.title,
      icon: entry.icon ?? null,
    }));
  });
}

/** The id of a plugin's settings frame (`kind: "settings"`): `settings` for
 *  a page of its own (BARY-149), `section` for its part below Barynt's form
 *  (BARY-204). */
export const settingsSlotId = (page: true | "section") =>
  page === "section" ? "section" : "settings";
