import { redirect } from "next/navigation";
import { pluginPath } from "@/lib/nav";

/** What a plugin asks you for moved to the plugins' area (BARY-238). */
export default async function UserPluginPage({
  params,
}: {
  params: Promise<{ workspace: string; pluginId: string }>;
}) {
  const { workspace, pluginId } = await params;
  redirect(
    pluginPath(workspace, decodeURIComponent(pluginId), { kind: "personal" }),
  );
}
