import { redirect } from "next/navigation";
import { pluginStorePath } from "@/lib/nav";

/** The old plugin list — its place is the workspace's plugin store now
 *  (BARY-201); a switched-on plugin's settings have pages of their own. */
export default async function WorkspacePluginsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  redirect(pluginStorePath(workspace, {}));
}
