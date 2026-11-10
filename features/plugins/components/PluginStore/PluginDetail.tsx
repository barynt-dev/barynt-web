"use client";

import { Icon } from "@iconify/react";
import { useFormatter } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Button } from "@/components/ui/atoms/Button/Button";
import { NativeSelect } from "@/components/ui/atoms/NativeSelect/NativeSelect";
import { Tab, Tabs } from "@/components/ui/layout/Tabs/Tabs";
import type {
  InstalledPlugin,
  PluginPlace,
  StoreEntry,
} from "@/features/plugins/queries";
import { Link } from "@/i18n/navigation";
import { compareSemver } from "@/lib/plugins/semver";
import { ErrorLine, PluginBadges, usePluginText } from "../shared";
import { OriginLink } from "./dialogs";
import { type StoreActions, storeHref } from "./PluginStore";
import { PluginTile } from "./PluginTile";
import { PreviewGallery } from "./PreviewGallery";
import styles from "./pluginStore.module.scss";
import { STORE_TABS, type StoreTab } from "./tabs";
import { useRelease } from "./useRelease";

/** A plugin's page in the store: header with what can be done, then tabs. */
export function PluginDetail({
  entry,
  tab,
  places,
  actions,
}: {
  entry: StoreEntry;
  tab: StoreTab;
  places: PluginPlace[] | null;
  actions: StoreActions;
}) {
  const text = usePluginText();
  const installed = entry.installed;
  const listed = entry.listing?.versions ?? [];
  // A plugin that isn't installed only has what the release tells.
  const tabs: StoreTab[] = installed
    ? [...STORE_TABS]
    : ["overview", "capabilities"];
  const current = tabs.includes(tab) ? tab : "overview";
  const [version, setVersion] = useState(listed[0] ?? null);
  // What isn't stored comes from the release itself: the one picked to
  // install, or the update an installed plugin could get.
  const release = useRelease(
    entry.listing?.sourceId ?? null,
    entry.id,
    installed ? entry.update : version,
  );

  return (
    <article className={styles.detail}>
      <header className={styles.detailHead}>
        <PluginTile id={entry.id} name={entry.name} size="lg" />
        <div className={styles.headText}>
          <h2 className={styles.detailName}>{entry.name}</h2>
          <span className={styles.headMeta}>
            {entry.author}
            {installed?.version && <> · v{installed.version}</>}
          </span>
          <PluginBadges kind={entry.kind} levels={entry.levels} size="md" />
        </div>
        <div className={styles.headActions}>
          {installed ? (
            <>
              <Button
                variant="outline"
                icon={
                  <Icon
                    icon={
                      installed.blocked
                        ? "lucide:shield-check"
                        : "lucide:shield-ban"
                    }
                    width={15}
                  />
                }
                disabled={actions.pending}
                onClick={() => actions.block(entry, !installed.blocked)}
              >
                {installed.blocked ? text.t("unblock") : text.t("block")}
              </Button>
              {entry.update && !installed.blocked && (
                <Button
                  variant="primary"
                  icon={<Icon icon="lucide:package-check" width={15} />}
                  disabled={actions.pending}
                  onClick={() => actions.install(entry, entry.update as string)}
                >
                  {text.t("updateTo", { version: entry.update })}
                </Button>
              )}
              <Button
                variant="text"
                icon={<Icon icon="lucide:package-x" width={15} />}
                aria-label={text.t("uninstall")}
                title={text.t("uninstall")}
                disabled={actions.pending}
                onClick={() => actions.uninstall(entry)}
              />
            </>
          ) : (
            entry.listing &&
            version && (
              <>
                {listed.length > 1 && (
                  <NativeSelect
                    label={text.t("version")}
                    value={version}
                    onChange={setVersion}
                    items={listed.map((v, i) => ({
                      value: v,
                      label:
                        i === 0
                          ? text.t("versionNewest", { version: v })
                          : `v${v}`,
                    }))}
                  />
                )}
                <Button
                  variant="primary"
                  icon={<Icon icon="lucide:plus" width={15} />}
                  disabled={actions.pending}
                  onClick={() => actions.install(entry, version)}
                >
                  {text.t("install")}
                </Button>
              </>
            )
          )}
        </div>
      </header>

      <Tabs label={text.t("detailTabs")} className={styles.tabs}>
        {tabs.map((id) => (
          <Tab
            key={id}
            href={storeHref({ plugin: entry.id, tab: id })}
            active={current === id}
            icon={<Icon icon={TAB_ICONS[id]} width={15} />}
          >
            {text.t(`tab.${id}`)}
            {id === "capabilities" && installed && (
              <Badge className={styles.tabCount}>
                {installed.capabilities.length}
              </Badge>
            )}
            {id === "places" && installed && (
              <Badge className={styles.tabCount}>{installed.activations}</Badge>
            )}
          </Tab>
        ))}
      </Tabs>

      {current === "overview" && (
        <Overview entry={entry} version={version} release={release} />
      )}
      {current === "capabilities" && (
        <Capabilities
          entry={entry}
          version={version}
          release={release}
          actions={actions}
        />
      )}
      {current === "versions" && installed && (
        <Versions entry={entry} release={release} actions={actions} />
      )}
      {current === "places" && <Places places={places ?? []} />}
    </article>
  );
}

/** The same kind of tabs as an issue view's (`AreaTabs`): icon, label, count. */
const TAB_ICONS: Record<StoreTab, string> = {
  overview: "lucide:layout-panel-top",
  capabilities: "lucide:key-round",
  versions: "lucide:history",
  places: "lucide:map-pin",
};

type Release = ReturnType<typeof useRelease>;

function Overview({
  entry,
  version,
  release,
}: {
  entry: StoreEntry;
  version: string | null;
  release: Release;
}) {
  const text = usePluginText();
  const installed = entry.installed;
  const previews = installed
    ? installed.previews
    : release.status === "ready"
      ? release.preview.previews
      : [];
  const capabilities = installed
    ? installed.capabilities
    : release.status === "ready"
      ? release.preview.capabilities
      : null;
  const network = installed
    ? installed.network
    : release.status === "ready"
      ? release.preview.network
      : [];
  const shownVersion = installed?.version ?? version;

  return (
    <div className={styles.overview}>
      <div className={styles.overviewMain}>
        {entry.update && installed && !installed.blocked && (
          <div className={styles.banner}>
            <Icon icon="lucide:sparkles" width={18} aria-hidden />
            <span>
              {text.t("updateBanner", { version: entry.update })}{" "}
              <ChangeSummary installed={installed} release={release} />{" "}
              <Link href={storeHref({ plugin: entry.id, tab: "capabilities" })}>
                {text.t("whatChanges")}
              </Link>
            </span>
          </div>
        )}
        {!installed && release.status === "loading" ? (
          <div className={styles.galleryLoading}>
            <Icon
              icon="lucide:loader-circle"
              width={18}
              className={styles.spin}
            />
            {text.t("checkingRelease")}
          </div>
        ) : (
          <PreviewGallery previews={previews} />
        )}
        {release.status === "error" && !installed && (
          <ErrorLine message={text.error(release.error)} />
        )}
        <section className={styles.about}>
          <h3>{text.t("aboutPlugin", { name: entry.name })}</h3>
          <p>{entry.description}</p>
        </section>
      </div>

      <aside className={styles.facts}>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>
            <Icon icon="lucide:key-round" width={14} aria-hidden />
            {text.t("asksFor")}
          </h3>
          {capabilities === null ? (
            <p className={styles.muted}>{text.t("checkingRelease")}</p>
          ) : capabilities.length === 0 ? (
            <p className={styles.muted}>{text.t("noCapabilities")}</p>
          ) : (
            <ul className={styles.capChips}>
              {capabilities.map((cap) => (
                <li key={cap}>{text.capability(cap)}</li>
              ))}
            </ul>
          )}
          {network.length > 0 && (
            <p className={styles.hostsLine}>
              <Icon icon="lucide:globe" width={14} aria-hidden />
              {text.t("callsHosts", { hosts: network.join(", ") })}
            </p>
          )}
          <Link
            href={storeHref({ plugin: entry.id, tab: "capabilities" })}
            className={styles.cardLink}
          >
            {text.t("allCapabilities")}
          </Link>
        </section>

        <section className={styles.card}>
          <h3 className={styles.cardTitle}>
            <Icon icon="lucide:shield" width={14} aria-hidden />
            {text.t("provenance")}
          </h3>
          <dl className={styles.factList}>
            <dt>{text.t("author")}</dt>
            <dd>{entry.author}</dd>
            {entry.listing && (
              <>
                <dt>{text.t("source")}</dt>
                <dd>{entry.listing.sourceName}</dd>
                {shownVersion && entry.listing.repoUrl && (
                  <>
                    <dt>{text.t("code")}</dt>
                    <dd>
                      <OriginLink
                        target={entry.listing}
                        version={shownVersion}
                      />
                    </dd>
                  </>
                )}
              </>
            )}
            <dt>{text.t("kindLabel")}</dt>
            <dd>{text.kind(entry.kind)}</dd>
            {entry.listing && entry.listing.categories.length > 0 && (
              <>
                <dt>
                  {text.t("categoriesLabel", {
                    count: entry.listing.categories.length,
                  })}
                </dt>
                <dd className={styles.categories}>
                  {entry.listing.categories.map((c) => (
                    // Every plugin of the category, on the start page.
                    <Link
                      key={c}
                      href={storeHref({ category: c })}
                      className={styles.categoryLink}
                    >
                      {text.t(`category.${c}` as "category.planning")}
                    </Link>
                  ))}
                </dd>
              </>
            )}
            {installed && (
              <>
                <dt>{text.t("activeIn")}</dt>
                <dd>
                  {text.t("activations", { count: installed.activations })}
                </dd>
              </>
            )}
          </dl>
          <p className={styles.muted}>{text.t("provenanceNote")}</p>
        </section>
      </aside>
    </div>
  );
}

/** Capabilities by what they touch. */
const GROUPS: { id: string; icon: string; test: (cap: string) => boolean }[] = [
  {
    id: "data",
    icon: "lucide:database",
    test: (c) => !/^(ui|events|notify):/.test(c),
  },
  {
    id: "ui",
    icon: "lucide:layout-dashboard",
    test: (c) => c.startsWith("ui:"),
  },
  {
    id: "events",
    icon: "lucide:activity",
    test: (c) => /^(events|notify):/.test(c),
  },
];

/** What an update changes against the installed version. */
interface Changes {
  added: string[];
  removed: string[];
  hostsAdded: string[];
  hostsRemoved: string[];
}

function changesOf(
  installed: InstalledPlugin,
  next: { capabilities: string[]; network: string[] },
): Changes {
  return {
    added: next.capabilities.filter((c) => !installed.capabilities.includes(c)),
    removed: installed.capabilities.filter(
      (c) => !next.capabilities.includes(c),
    ),
    hostsAdded: next.network.filter((h) => !installed.network.includes(h)),
    hostsRemoved: installed.network.filter((h) => !next.network.includes(h)),
  };
}

/** One line: "asks for 1 new capability" — or that it asks for nothing new. */
function ChangeSummary({
  installed,
  release,
}: {
  installed: InstalledPlugin;
  release: Release;
}) {
  const text = usePluginText();
  if (release.status !== "ready") return null;
  const c = changesOf(installed, release.preview);
  const more = c.added.length + c.hostsAdded.length;
  return (
    <span className={styles.changeSummary} data-more={more > 0 || undefined}>
      {more > 0
        ? text.t("summaryMore", {
            caps: c.added.length,
            hosts: c.hostsAdded.length,
          })
        : text.t("summaryNothingNew")}
    </span>
  );
}

/**
 * The update at a glance: what it may newly do, what it no longer does,
 * which servers it calls now and what that means for the places it's on.
 * The button to take it is in the plugin's header, right above.
 */
function UpdateChanges({
  entry,
  installed,
  release,
  actions,
}: {
  entry: StoreEntry;
  installed: InstalledPlugin;
  release: Release;
  actions: StoreActions;
}) {
  const text = usePluginText();
  const update = entry.update as string;
  const c =
    release.status === "ready" ? changesOf(installed, release.preview) : null;
  const rows = c
    ? (
        [
          ["added", "lucide:plus", c.added.map(text.capability)],
          ["removed", "lucide:minus", c.removed.map(text.capability)],
          ["hostsAdded", "lucide:globe", c.hostsAdded],
          ["hostsRemoved", "lucide:globe-lock", c.hostsRemoved],
        ] as const
      ).filter(([, , items]) => items.length > 0)
    : [];
  const asksMore = !!c && c.added.length + c.hostsAdded.length > 0;

  return (
    <section className={styles.updateCard} aria-labelledby="update-changes">
      <header className={styles.updateHead}>
        <Icon icon="lucide:sparkles" width={18} aria-hidden />
        <h3 id="update-changes">
          {text.t("updateChangesTitle", { version: update })}
        </h3>
      </header>

      {release.status === "error" ? (
        <ErrorLine message={text.error(release.error)} />
      ) : !c ? (
        <p className={styles.muted}>
          <Icon
            icon="lucide:loader-circle"
            width={14}
            className={styles.spin}
          />{" "}
          {text.t("checkingRelease")}
        </p>
      ) : rows.length === 0 ? (
        <p className={styles.updateSame}>
          <Icon icon="lucide:circle-check" width={16} aria-hidden />
          {text.t("updateSame", { version: installed.version ?? "" })}
        </p>
      ) : (
        <dl className={styles.updateRows}>
          {rows.map(([kind, icon, items]) => (
            <div key={kind} className={styles.updateRow} data-kind={kind}>
              <dt>
                <Icon icon={icon} width={14} aria-hidden />
                {text.t(`updateRow.${kind}` as "updateRow.added")}
              </dt>
              <dd>
                {items.map((item) => (
                  <span key={item} className={styles.updateItem}>
                    {item}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {c && (
        <p className={styles.updateImpact}>
          <Icon icon="lucide:users" width={15} aria-hidden />
          {asksMore
            ? text.t("updateImpactMore", { count: installed.activations })
            : text.t("updateImpactSame")}
        </p>
      )}
    </section>
  );
}

function Capabilities({
  entry,
  version,
  release,
  actions,
}: {
  entry: StoreEntry;
  version: string | null;
  release: Release;
  actions: StoreActions;
}) {
  const text = usePluginText();
  const installed = entry.installed;
  // Installed: what it may do now, and on top what an update would change.
  // Not installed: what the picked version would be allowed.
  const shown = installed
    ? { capabilities: installed.capabilities, network: installed.network }
    : release.status === "ready"
      ? release.preview
      : null;
  const shownVersion = installed?.version ?? version;

  return (
    <div className={styles.capabilities}>
      {installed && entry.update && (
        <UpdateChanges
          entry={entry}
          installed={installed}
          release={release}
          actions={actions}
        />
      )}

      <header className={styles.capHead}>
        <h3>
          {text.t(installed ? "capsOfInstalled" : "capsOfVersion", {
            version: shownVersion ?? "",
          })}
        </h3>
        <p>{text.t("capabilitiesIntro")}</p>
      </header>

      {shown === null ? (
        release.status === "error" ? (
          <ErrorLine message={text.error(release.error)} />
        ) : (
          <p className={styles.muted}>
            <Icon
              icon="lucide:loader-circle"
              width={14}
              className={styles.spin}
            />{" "}
            {text.t("checkingRelease")}
          </p>
        )
      ) : (
        <div className={styles.capGrid}>
          {GROUPS.map((group) => {
            const caps = shown.capabilities.filter(group.test);
            if (caps.length === 0) return null;
            return (
              <section key={group.id} className={styles.card}>
                <h3 className={styles.cardTitle}>
                  <Icon icon={group.icon} width={14} aria-hidden />
                  {text.t(`capGroup.${group.id}` as "capGroup.data")}
                </h3>
                <ul className={styles.capRows}>
                  {caps.map((cap) => (
                    <li key={cap} className={styles.capRow}>
                      <span className={styles.capLabel}>
                        {text.capability(cap)}
                      </span>
                      <code>{cap}</code>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          <section className={styles.card} data-tone="warning">
            <h3 className={styles.cardTitle}>
              <Icon icon="lucide:globe" width={14} aria-hidden />
              {text.t("networkTitle")}
            </h3>
            {shown.network.length === 0 ? (
              <p className={styles.muted}>{text.t("noNetwork")}</p>
            ) : (
              <ul className={styles.capRows}>
                {shown.network.map((host) => (
                  <li key={host} className={styles.capRow}>
                    <code className={styles.host}>{host}</code>
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.muted}>{text.t("networkNote")}</p>
          </section>
        </div>
      )}

      {installed && (
        <p className={styles.footnote}>
          <Icon icon="lucide:users" width={16} aria-hidden />
          <span>
            {text.t("capsConfirmedIn", { count: installed.activations })}
          </span>
          <Link href={storeHref({ plugin: entry.id, tab: "places" })}>
            {text.t("whereItsOn")}
          </Link>
        </p>
      )}
    </div>
  );
}

function Versions({
  entry,
  release,
  actions,
}: {
  entry: StoreEntry;
  /** The update's release, for what it changes. */
  release: Release;
  actions: StoreActions;
}) {
  const text = usePluginText();
  const format = useFormatter();
  const installed = entry.installed;
  if (!installed) return null;
  const rows = new Map<
    string,
    { version: string; status: string | null; installedAt: Date | null }
  >();
  for (const v of installed.versions)
    rows.set(v.version, {
      version: v.version,
      status: v.status,
      installedAt: v.installedAt,
    });
  for (const v of entry.listing?.versions ?? [])
    if (!rows.has(v))
      rows.set(v, { version: v, status: null, installedAt: null });
  const list = [...rows.values()].sort((a, b) =>
    compareSemver(b.version, a.version),
  );
  const active = installed.version;

  return (
    <ol className={styles.timeline}>
      {list.map((row) => {
        const newer =
          !row.status && active && compareSemver(row.version, active) > 0;
        const kind = row.status ?? (newer ? "available" : "listed");
        const releaseUrl = entry.listing?.releaseUrls[row.version];
        return (
          <li key={row.version} className={styles.step} data-kind={kind}>
            <span className={styles.dot} aria-hidden />
            <div className={styles.stepBody}>
              <div className={styles.stepHead}>
                <span className={styles.stepVersion}>{row.version}</span>
                <Badge size="sm" mono={false} active={kind === "active"}>
                  {text.t(`versionState.${kind}` as "versionState.active")}
                </Badge>
                {row.installedAt && (
                  <span className={styles.muted}>
                    {text.t("installedOn", {
                      date: format.dateTime(row.installedAt, {
                        dateStyle: "medium",
                      }),
                    })}
                  </span>
                )}
                <span className={styles.stepActions}>
                  {releaseUrl && (
                    <a
                      href={releaseUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={styles.releaseLink}
                    >
                      <Icon
                        icon="lucide:external-link"
                        width={14}
                        aria-hidden
                      />
                      {text.t("releasePage")}
                    </a>
                  )}
                  {newer && !installed.blocked && (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={actions.pending}
                      onClick={() => actions.install(entry, row.version)}
                    >
                      {text.t("updateTo", { version: row.version })}
                    </Button>
                  )}
                  {row.status === "superseded" &&
                    installed.rollbackTo === row.version &&
                    !installed.blocked && (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Icon icon="lucide:undo-2" width={14} />}
                        disabled={actions.pending}
                        onClick={() => actions.rollback(entry)}
                      >
                        {text.t("rollbackTo", { version: row.version })}
                      </Button>
                    )}
                  {kind === "listed" && !installed.blocked && (
                    <Button
                      variant="text"
                      size="sm"
                      disabled={actions.pending}
                      onClick={() => actions.install(entry, row.version)}
                    >
                      {text.t("installOlder", { version: row.version })}
                    </Button>
                  )}
                </span>
              </div>
              {entry.listing?.notes[row.version] && (
                <ReleaseNotes text={entry.listing.notes[row.version]} />
              )}
              {row.version === entry.update && (
                <p className={styles.stepChanges}>
                  <ChangeSummary installed={installed} release={release} />{" "}
                  <Link
                    href={storeHref({ plugin: entry.id, tab: "capabilities" })}
                  >
                    {text.t("whatChanges")}
                  </Link>
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Lines this long and more are folded behind "All changes". */
const NOTES_FOLD = 4;

/**
 * A version's release notes from the directory: plain text, where `- ` or
 * `* ` lines become a list. Never markup — React escapes whatever it says.
 * Long notes show their first lines and fold the rest away.
 */
function ReleaseNotes({ text: notes }: { text: string }) {
  const text = usePluginText();
  const lines = notes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const blocks: (
    | { list: false; line: string }
    | { list: true; items: string[] }
  )[] = [];
  for (const line of lines) {
    const item = line.match(/^[-*]\s+(.*)$/);
    const last = blocks.at(-1);
    if (item && last?.list) last.items.push(item[1]);
    else if (item) blocks.push({ list: true, items: [item[1]] });
    else blocks.push({ list: false, line });
  }
  const render = (from: number, to: number) =>
    blocks.slice(from, to).map((b, i) =>
      b.list ? (
        // biome-ignore lint/suspicious/noArrayIndexKey: the notes don't reorder
        <ul key={from + i}>
          {b.items.map((item, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: as above
            <li key={j}>{item}</li>
          ))}
        </ul>
      ) : (
        // biome-ignore lint/suspicious/noArrayIndexKey: as above
        <p key={from + i}>{b.line}</p>
      ),
    );
  if (lines.length <= NOTES_FOLD)
    return <div className={styles.notes}>{render(0, blocks.length)}</div>;
  return (
    <details className={styles.notes}>
      <summary>
        <span className={styles.notesFirst}>
          {lines[0].replace(/^[-*]\s+/, "")}
        </span>
        <span className={styles.notesMore}>
          {text.t("notesMore", { count: lines.length - 1 })}
        </span>
        <span className={styles.notesLess}>{text.t("notesLess")}</span>
      </summary>
      {render(0, blocks.length)}
    </details>
  );
}

function Places({ places }: { places: PluginPlace[] }) {
  const text = usePluginText();
  const format = useFormatter();
  if (places.length === 0)
    return <p className={styles.listEmpty}>{text.t("nowhereOn")}</p>;
  return (
    <div className={styles.places}>
      <p className={styles.muted}>{text.t("placesIntro")}</p>
      {places.map((place) => (
        <section key={place.workspaceId} className={styles.place}>
          <header className={styles.placeHead}>
            <PluginTile id={place.workspaceId} name={place.workspaceName} />
            <strong>{place.workspaceName}</strong>
            <span className={styles.grant} data-on={place.granted || undefined}>
              {text.t(place.granted ? "grantOn" : "grantOff")}
            </span>
            {place.state && (
              <span className={styles.placeState} data-state={place.state}>
                {text.t(
                  `activationState.${place.state}` as "activationState.active",
                )}
              </span>
            )}
            <Link
              href={`/${place.workspaceSlug}/settings/plugins`}
              className={styles.placeLink}
            >
              {text.t("openWorkspaceSettings")}
            </Link>
          </header>
          {place.projects.length > 0 && (
            <ul className={styles.placeProjects}>
              {place.projects.map((p) => (
                <li key={p.projectId}>
                  <span className={styles.projectName}>{p.name}</span>
                  <span className={styles.placeState} data-state={p.state}>
                    {text.t(
                      `activationState.${p.state}` as "activationState.active",
                    )}
                  </span>
                  <span className={styles.muted}>
                    {p.by
                      ? text.t("switchedOnBy", {
                          name: p.by,
                          date: format.dateTime(p.at, { dateStyle: "medium" }),
                        })
                      : format.dateTime(p.at, { dateStyle: "medium" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
