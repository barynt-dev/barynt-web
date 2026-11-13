import "server-only";
import { cache } from "react";
import type {
  PluginBlockEntry,
  PluginWidgetEntry,
} from "@/features/dashboard/types";
import { pluginTemplateWidget } from "@/features/dashboard/widgets";
import { db } from "@/lib/db";
import { currentUserCanEnterWorkspace, hasPermission } from "@/lib/permissions";
import { activationScopeKey } from "@/lib/plugins/activation";
import { validateManifest } from "@/lib/plugins/manifest";
import { SLOTS, type SlotEntry, slotEntries } from "@/lib/plugins/slots";
import type { IssuePluginPanel } from "@/types/issue";

// Where sandboxed plugins show in the sidebar (BARY-148): their views and
// pages, for the workspace and each project the person can see. Read once
// per request; what the entries open is checked again there
// (`getPluginSlotView`, `/api/plugins/frame`).

export interface PluginNavEntry extends SlotEntry {
  pluginId: string;
  pluginName: string;
  /** Under `…/plugin/<pluginId>/` — `view/<id>` or `page/<id>`. */
  path: string;
}

export interface PluginNav {
  /** On in the workspace: views for the main group, pages for "Plugins". */
  workspace: PluginNavEntry[];
  /** On in a project, by project id: under the project. */
  projects: Record<string, PluginNavEntry[]>;
}

export const getPluginNav = cache(
  async (
    workspaceId: string,
    visibleProjectIds: readonly string[],
  ): Promise<PluginNav> => {
    const empty: PluginNav = { workspace: [], projects: {} };
    if (!(await currentUserCanEnterWorkspace(workspaceId))) return empty;
    const activations = await db.pluginActivation.findMany({
      where: { workspaceId, enabled: true },
      select: { pluginId: true, projectId: true, capabilities: true },
    });
    if (activations.length === 0) return empty;
    const rows = await db.plugin.findMany({
      where: {
        pluginId: { in: [...new Set(activations.map((a) => a.pluginId))] },
        status: "active",
      },
      select: { pluginId: true, manifest: true },
    });
    const manifests = new Map(
      rows.flatMap((r) => {
        const parsed = validateManifest(r.manifest);
        return parsed.ok ? [[r.pluginId, parsed.manifest] as const] : [];
      }),
    );

    const nav: PluginNav = { workspace: [], projects: {} };
    for (const a of activations) {
      const manifest = manifests.get(a.pluginId);
      if (!manifest) continue;
      if (a.projectId && !visibleProjectIds.includes(a.projectId)) continue;
      const entries = slotEntries(manifest, a.capabilities).map((e) => ({
        ...e,
        pluginId: a.pluginId,
        pluginName: manifest.name,
        path: `plugin/${a.pluginId}/${SLOTS[e.kind].path ?? e.kind}/${e.id}`,
      }));
      if (!a.projectId) nav.workspace.push(...entries);
      else
        nav.projects[a.projectId] = [
          ...(nav.projects[a.projectId] ?? []),
          ...entries,
        ];
    }
    const byName = (x: PluginNavEntry, y: PluginNavEntry) =>
      x.pluginName.localeCompare(y.pluginName) ||
      x.title.localeCompare(y.title);
    nav.workspace.sort(byName);
    for (const list of Object.values(nav.projects)) list.sort(byName);
    return nav;
  },
);

/** The widgets the plugins switched on in a place bring — what a
 *  dashboard's gallery offers there (BARY-149): the ones they draw, and
 *  their templates (BARY-203). Whether a drawn one still runs is checked
 *  again when it's drawn; a template, once added, is the dashboard's own. */
export async function getPluginWidgets(place: {
  workspaceId: string;
  projectId: string | null;
}): Promise<PluginWidgetEntry[]> {
  const activations = await db.pluginActivation.findMany({
    where: { scopeKey: activationScopeKey(place), enabled: true },
    select: { pluginId: true, capabilities: true },
  });
  if (activations.length === 0) return [];
  const rows = await db.plugin.findMany({
    where: {
      pluginId: { in: activations.map((a) => a.pluginId) },
      status: "active",
    },
    select: { pluginId: true, manifest: true },
  });
  return activations
    .flatMap((a): PluginWidgetEntry[] => {
      const row = rows.find((r) => r.pluginId === a.pluginId);
      const parsed = row ? validateManifest(row.manifest) : null;
      if (!parsed?.ok) return [];
      const { manifest } = parsed;
      const drawn = slotEntries(manifest, a.capabilities)
        .filter((e) => e.kind === "widget")
        .map((e) => ({
          pluginId: a.pluginId,
          pluginName: manifest.name,
          widgetId: e.id,
          title: e.title,
        }));
      const templates = a.capabilities.includes("ui:dashboard-widget")
        ? (manifest.contributes.widgetTemplates ?? []).map((t) => ({
            pluginId: a.pluginId,
            pluginName: manifest.name,
            widgetId: t.id,
            title: t.title,
            template: pluginTemplateWidget(t, t.title),
          }))
        : [];
      return [...drawn, ...templates];
    })
    .sort(
      (x, y) =>
        x.pluginName.localeCompare(y.pluginName) ||
        x.title.localeCompare(y.title),
    );
}

/** The building blocks the plugins switched on in a place bring — what a
 *  custom widget's builder offers there (BARY-205). Whether one still runs
 *  is checked again when it's drawn. */
export async function getPluginBlocks(place: {
  workspaceId: string;
  projectId: string | null;
}): Promise<PluginBlockEntry[]> {
  const activations = await db.pluginActivation.findMany({
    where: { scopeKey: activationScopeKey(place), enabled: true },
    select: { pluginId: true, capabilities: true },
  });
  if (activations.length === 0) return [];
  const rows = await db.plugin.findMany({
    where: {
      pluginId: { in: activations.map((a) => a.pluginId) },
      status: "active",
    },
    select: { pluginId: true, manifest: true },
  });
  return activations
    .flatMap((a): PluginBlockEntry[] => {
      const row = rows.find((r) => r.pluginId === a.pluginId);
      const parsed = row ? validateManifest(row.manifest) : null;
      if (!parsed?.ok) return [];
      const { manifest } = parsed;
      const shown = new Set(
        slotEntries(manifest, a.capabilities)
          .filter((e) => e.kind === "block")
          .map((e) => e.id),
      );
      return (manifest.contributes.widgetBlocks ?? [])
        .filter((b) => shown.has(b.id))
        .map((b) => ({
          pluginId: a.pluginId,
          pluginName: manifest.name,
          blockId: b.id,
          title: b.title,
          description: b.description ?? null,
          draw: b.draw ?? "barynt",
          settings: (b.settings ?? []).map((x) => ({
            key: x.key,
            type: x.type,
            label: x.label,
            description: x.description ?? null,
            default:
              x.default === undefined || Array.isArray(x.default)
                ? null
                : x.default,
            options: (x.options ?? []).map((o) => ({
              id: o.id,
              label: o.label,
            })),
          })),
        }));
    })
    .sort(
      (x, y) =>
        x.pluginName.localeCompare(y.pluginName) ||
        x.title.localeCompare(y.title),
    );
}

/** The panels the plugins switched on in a project show in its issues
 *  (BARY-150), with their capability confirmed there. Read once per
 *  request; each panel's frame is checked again (`/api/plugins/frame`). */
export const getPluginIssuePanels = cache(
  async (place: {
    workspaceId: string;
    projectId: string;
  }): Promise<IssuePluginPanel[]> => {
    const activations = await db.pluginActivation.findMany({
      where: { scopeKey: activationScopeKey(place), enabled: true },
      select: { pluginId: true, capabilities: true },
    });
    if (activations.length === 0) return [];
    const rows = await db.plugin.findMany({
      where: {
        pluginId: { in: activations.map((a) => a.pluginId) },
        status: "active",
      },
      select: { pluginId: true, manifest: true },
    });
    return activations
      .flatMap((a): IssuePluginPanel[] => {
        const row = rows.find((r) => r.pluginId === a.pluginId);
        const parsed = row ? validateManifest(row.manifest) : null;
        if (!parsed?.ok) return [];
        return slotEntries(parsed.manifest, a.capabilities)
          .filter((e) => e.kind === "issuePanel")
          .map((e) => ({
            pluginId: a.pluginId,
            pluginName: parsed.manifest.name,
            panelId: e.id,
            title: e.title,
          }));
      })
      .sort(
        (x, y) =>
          x.pluginName.localeCompare(y.pluginName) ||
          x.title.localeCompare(y.title),
      );
  },
);

/** A plugin that puts badges on a project's cards and rows (BARY-151). */
export interface PluginBadgeProvider {
  pluginId: string;
  pluginName: string;
  /** Its `contributes.issueBadges` — what "Display" lets people hide. */
  badges: { id: string; title: string }[];
  /** `issues:read` confirmed: it gets title, priority and due date with
   *  each issue, not only id and reference. */
  canRead: boolean;
}

/** The plugins that put badges on a project's cards and rows, for someone
 *  who sees the project — with `ui:issue-badge` confirmed there. */
export const getPluginBadgeProviders = cache(
  async (place: {
    workspaceId: string;
    projectSlug: string;
  }): Promise<{
    projectId: string;
    prefix: string;
    providers: PluginBadgeProvider[];
  } | null> => {
    const project = await db.project.findFirst({
      where: { workspaceId: place.workspaceId, slug: place.projectSlug },
      select: { id: true, prefix: true },
    });
    if (!project) return null;
    if (!(await hasPermission("project.view", { projectId: project.id })))
      return null;
    const activations = await db.pluginActivation.findMany({
      where: {
        scopeKey: activationScopeKey({
          workspaceId: place.workspaceId,
          projectId: project.id,
        }),
        enabled: true,
      },
      select: { pluginId: true, capabilities: true },
    });
    const withBadges = activations.filter((a) =>
      a.capabilities.includes("ui:issue-badge"),
    );
    if (withBadges.length === 0)
      return { projectId: project.id, prefix: project.prefix, providers: [] };
    const rows = await db.plugin.findMany({
      where: {
        pluginId: { in: withBadges.map((a) => a.pluginId) },
        status: "active",
      },
      select: { pluginId: true, manifest: true },
    });
    const providers = withBadges.flatMap((a): PluginBadgeProvider[] => {
      const row = rows.find((r) => r.pluginId === a.pluginId);
      const parsed = row ? validateManifest(row.manifest) : null;
      if (!parsed?.ok || parsed.manifest.kind !== "sandbox") return [];
      const badges = parsed.manifest.contributes.issueBadges ?? [];
      if (badges.length === 0) return [];
      return [
        {
          pluginId: a.pluginId,
          pluginName: parsed.manifest.name,
          badges: badges.map((b) => ({ id: b.id, title: b.title })),
          canRead: a.capabilities.includes("issues:read"),
        },
      ];
    });
    return { projectId: project.id, prefix: project.prefix, providers };
  },
);
