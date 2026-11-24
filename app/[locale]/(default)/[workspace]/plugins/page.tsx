import { redirect } from "next/navigation";
import { PluginsStart } from "@/features/plugins/components/PluginsStart/PluginsStart";
import { getPluginsArea } from "@/features/plugins/queries";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { pluginPath, pluginStorePath } from "@/lib/nav";

export const dynamic = "force-dynamic";

/**
 * The plugins' start (BARY-238): on a phone the list of them (the layout's
 * nav), everywhere else the first one. The store lived at this address
 * before: a link of then (`?plugin=`, `?category=`) goes there.
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
  const [first] = await getPluginsArea(workspace, await getWorkspaceProjects());
  // None: the layout has sent you on already.
  if (!first) return null;
  return <PluginsStart href={pluginPath(workspace, first.pluginId)} />;
}
