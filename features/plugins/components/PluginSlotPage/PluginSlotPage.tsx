import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { getPluginSlotView } from "@/features/plugins/runtime";
import { slotKindOfPath } from "@/lib/plugins/slots";
import { getSession } from "@/lib/session";
import { PluginFrame } from "../PluginFrame/PluginFrame";
import { PluginTile } from "../PluginStore/PluginTile";
import styles from "./pluginSlotPage.module.scss";

/**
 * A page a sandboxed plugin fills (BARY-148) — a view or a page of its own,
 * in a workspace or a project: the plugin's frame under a header that names
 * the plugin, so it's always clear what comes from one. `slotPath` is the
 * address segment (`view`, `page`); anything else is a 404.
 */
export async function PluginSlotPage({
  pluginId,
  slotPath,
  id,
  workspaceId,
  projectId,
}: {
  pluginId: string;
  slotPath: string;
  id: string;
  workspaceId: string;
  projectId: string | null;
}) {
  const kind = slotKindOfPath(slotPath);
  const session = await getSession();
  if (!kind || !session) notFound();
  const place = { pluginId, workspaceId, projectId };
  const slot = { kind, id };
  const [view, locale] = await Promise.all([
    getPluginSlotView(session.userId, place, slot),
    getLocale(),
  ]);
  if (!view) notFound();

  return (
    <div className={styles.page}>
      <PageHeader
        leading={<PluginTile id={pluginId} name={view.pluginName} />}
        title={view.title}
        description={view.pluginName}
      />
      <PluginFrame
        pluginId={pluginId}
        name={view.pluginName}
        context={{ slot, workspaceId, projectId, locale }}
      />
    </div>
  );
}
