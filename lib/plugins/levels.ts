import type { PluginLevel } from "@/lib/nav";

// Which of a plugin's levels opens first in the plugins' area (BARY-238).

interface Reach {
  personal: boolean;
  workspace: boolean;
  projects: { slug: string; on: boolean }[];
}

/** The project a plugin's project level opens on: one it's on in, else
 *  the first. */
export function defaultProject<P extends Reach["projects"][number]>(plugin: {
  projects: P[];
}): P | null {
  return plugin.projects.find((p) => p.on) ?? plugin.projects[0] ?? null;
}

/** Where a plugin opens: a project (most of what's set is there), else the
 *  workspace, else what's yours. `null` where there's nothing to set. */
export function defaultLevel(plugin: Reach): PluginLevel | null {
  const project = defaultProject(plugin);
  if (project) return { kind: "project", slug: project.slug };
  if (plugin.workspace) return { kind: "workspace" };
  if (plugin.personal) return { kind: "personal" };
  return null;
}
