import { notFound } from "next/navigation";
import { PluginStore } from "@/features/plugins/components/PluginStore/PluginStore";
import {
  STORE_TABS,
  type StoreTab,
} from "@/features/plugins/components/PluginStore/tabs";
import {
  getPluginPlaces,
  getPluginStoreView,
} from "@/features/plugins/queries";

export const dynamic = "force-dynamic";

/**
 * The platform's plugin store (BARY-200): installed plugins next to what the
 * sources offer — `plugin.manage`. What's open is in the address:
 * `?plugin=<id>&tab=<tab>` or `?view=sources`.
 */
export default async function AdminPluginsPage({
  searchParams,
}: {
  searchParams: Promise<{ plugin?: string; tab?: string; view?: string }>;
}) {
  const params = await searchParams;
  const view = await getPluginStoreView();
  if (!view) notFound();
  const selected = view.entries.find((e) => e.id === params.plugin) ?? null;
  const tab: StoreTab = (STORE_TABS as readonly string[]).includes(
    params.tab ?? "",
  )
    ? (params.tab as StoreTab)
    : "overview";
  const places =
    selected?.installed && tab === "places"
      ? await getPluginPlaces(selected.id)
      : null;
  return (
    <PluginStore
      view={view}
      selected={selected}
      tab={tab}
      sourcesOpen={!selected && params.view === "sources"}
      places={places}
    />
  );
}
