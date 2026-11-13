import { getPluginBadgeProviders } from "@/features/plugins/slots";
import { PluginBadgesProvider } from "./PluginBadges";

/**
 * Plugins' badges for a project's board and list (BARY-151): the plugins
 * on there that bring badges, for whoever sees the project. Nothing at all
 * — no provider, no frame — while none does.
 */
export async function ProjectPluginBadges({
  workspaceId,
  projectSlug,
  children,
}: {
  workspaceId: string;
  projectSlug: string;
  children: React.ReactNode;
}) {
  const found = await getPluginBadgeProviders({ workspaceId, projectSlug });
  if (!found || found.providers.length === 0) return children;
  return (
    <PluginBadgesProvider
      providers={found.providers}
      prefix={found.prefix}
      workspaceId={workspaceId}
      projectId={found.projectId}
    >
      {children}
    </PluginBadgesProvider>
  );
}
