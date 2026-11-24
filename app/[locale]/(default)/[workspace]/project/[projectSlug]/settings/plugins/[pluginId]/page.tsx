import { redirect } from "next/navigation";
import { pluginPath, withQuery } from "@/lib/nav";

/** A plugin's project settings moved to the plugins' area (BARY-238). */
export default async function ProjectPluginSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; projectSlug: string; pluginId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspace, projectSlug, pluginId } = await params;
  redirect(
    withQuery(
      pluginPath(workspace, decodeURIComponent(pluginId), {
        kind: "project",
        slug: projectSlug,
      }),
      await searchParams,
    ),
  );
}
