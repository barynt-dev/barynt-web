import { notFound, redirect } from "next/navigation";
import { PluginLevels } from "@/features/plugins/components/PluginLevels/PluginLevels";
import { PluginSettings } from "@/features/plugins/components/PluginSettings/PluginSettings";
import { getPluginLevels } from "@/features/plugins/levels";
import { getPluginSettingsView } from "@/features/plugins/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { pluginPath } from "@/lib/nav";

export const dynamic = "force-dynamic";

/** A part of the page a plugin sent someone to — a plain id, else none. */
const focusOf = (focus: string | undefined) =>
  focus && /^[a-z0-9-]{1,40}$/.test(focus) ? focus : undefined;

/** A plugin's settings in the workspace (BARY-201, in the plugins' area
 *  since BARY-238) — `plugin.enable` here, and something to set. */
export default async function PluginWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; pluginId: string }>;
  searchParams: Promise<{ focus?: string }>;
}) {
  const { workspace, pluginId: raw } = await params;
  const pluginId = decodeURIComponent(raw);
  setCurrentWorkspaceId(workspace);
  const levels = await getPluginLevels(workspace, pluginId, {
    kind: "workspace",
  });
  if (!levels) redirect(pluginPath(workspace, pluginId));
  const scope = { workspaceId: workspace, projectId: null };
  const view = await getPluginSettingsView(scope, pluginId);
  if (!view) notFound();
  return (
    <PluginSettings
      view={view}
      focus={focusOf((await searchParams).focus)}
      scope={scope}
      subnav={
        <PluginLevels
          levels={levels.levels}
          active="workspace"
          subject={levels.subject}
        />
      }
    />
  );
}
