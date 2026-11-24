import { redirect } from "next/navigation";
import { pluginPath, withQuery } from "@/lib/nav";

/** A plugin's workspace settings moved to the plugins' area (BARY-238). */
export default async function WorkspacePluginSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; pluginId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspace, pluginId } = await params;
  redirect(
    withQuery(
      pluginPath(workspace, decodeURIComponent(pluginId), {
        kind: "workspace",
      }),
      await searchParams,
    ),
  );
}
