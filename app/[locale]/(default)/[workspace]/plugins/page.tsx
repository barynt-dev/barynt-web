import { redirect } from "next/navigation";
import { PluginsOverview } from "@/features/plugins/components/PluginsOverview/PluginsOverview";
import { canUsePluginStore, getPluginsArea } from "@/features/plugins/queries";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { pluginStorePath } from "@/lib/nav";

export const dynamic = "force-dynamic";

/**
 * The plugins' start page (BARY-238): every plugin, where it's on and
 * what's set for it — and the way to the store. The store lived at this
 * address before: a link of then (`?plugin=`, `?category=`) goes there.
 */
export default async function PluginsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ plugin?: string; tab?: string; category?: string }>;
}) {
  const { workspace } = await params;
  const query = await searchParams;
  if (query.plugin || query.category || query.tab)
    redirect(pluginStorePath(workspace, query));
  setCurrentWorkspaceId(workspace);

  const [plugins, store] = await Promise.all([
    getWorkspaceProjects().then((projects) =>
      getPluginsArea(workspace, projects),
    ),
    canUsePluginStore(workspace),
  ]);
  return (
    <PluginsOverview
      workspaceId={workspace}
      plugins={plugins}
      storeHref={store ? pluginStorePath(workspace, {}) : null}
    />
  );
}
