import { notFound } from "next/navigation";
import { AdminPlugins } from "@/features/plugins/components/AdminPlugins/AdminPlugins";
import { getAdminPluginsView } from "@/features/plugins/queries";

export const dynamic = "force-dynamic";

/** The platform's plugins: sources, installed versions — `plugin.manage`. */
export default async function AdminPluginsPage() {
  const view = await getAdminPluginsView();
  if (!view) notFound();
  return <AdminPlugins {...view} />;
}
