import { redirect } from "next/navigation";
import { projectSettingsPath } from "@/lib/nav";

/** The old plugin list — a project's plugins are in its settings nav now,
 *  each with a page of its own (BARY-201). */
export default async function ProjectPluginsPage({
  params,
}: {
  params: Promise<{ workspace: string; projectSlug: string }>;
}) {
  const { workspace, projectSlug } = await params;
  redirect(projectSettingsPath(workspace, projectSlug, ""));
}
