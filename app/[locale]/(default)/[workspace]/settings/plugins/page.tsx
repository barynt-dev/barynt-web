import { redirect } from "next/navigation";
import { pluginsPath } from "@/lib/nav";

/** The old plugin list — every plugin is in the plugins' area now
 *  (BARY-238). */
export default async function WorkspacePluginsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  redirect(pluginsPath(workspace));
}
