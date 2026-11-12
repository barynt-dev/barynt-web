"use client";

import { Icon } from "@iconify/react";
import { usePluginText } from "../shared";
import styles from "./pluginStore.module.scss";

// How the store shows what a plugin may do — the capabilities tab and the
// install dialog share it, so both read the same: cards by what a capability
// touches, the network on its own, and an update's changes as + / − rows.

/** What a version may do and which servers it calls. */
export interface Permissions {
  capabilities: string[];
  network: string[];
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

/** A version's capabilities as cards by group, then its network. */
export function CapabilityCards({ capabilities, network }: Permissions) {
  const text = usePluginText();
  return (
    <div className={styles.capGrid}>
      {GROUPS.map((group) => {
        const caps = capabilities.filter(group.test);
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
        {network.length === 0 ? (
          <p className={styles.muted}>{text.t("noNetwork")}</p>
        ) : (
          <ul className={styles.capRows}>
            {network.map((host) => (
              <li key={host} className={styles.capRow}>
                <code className={styles.host}>{host}</code>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.muted}>{text.t("networkNote")}</p>
      </section>
    </div>
  );
}

/** What an update changes against the installed version. */
export interface Changes {
  added: string[];
  removed: string[];
  hostsAdded: string[];
  hostsRemoved: string[];
}

export function changesOf(now: Permissions, next: Permissions): Changes {
  return {
    added: next.capabilities.filter((c) => !now.capabilities.includes(c)),
    removed: now.capabilities.filter((c) => !next.capabilities.includes(c)),
    hostsAdded: next.network.filter((h) => !now.network.includes(h)),
    hostsRemoved: now.network.filter((h) => !next.network.includes(h)),
  };
}

/** Whether the update asks for anything the installed version didn't. */
export const asksMore = (c: Changes) =>
  c.added.length + c.hostsAdded.length > 0;

/** The changes as "May now / No longer / Now calls / No longer calls"
 *  rows — or, with none, that it's the same as `from`. */
export function ChangeRows({
  changes,
  from,
}: {
  changes: Changes;
  from: string;
}) {
  const text = usePluginText();
  const rows = (
    [
      ["added", "lucide:plus", changes.added.map(text.capability)],
      ["removed", "lucide:minus", changes.removed.map(text.capability)],
      ["hostsAdded", "lucide:globe", changes.hostsAdded],
      ["hostsRemoved", "lucide:globe-lock", changes.hostsRemoved],
    ] as const
  ).filter(([, , items]) => items.length > 0);
  if (rows.length === 0)
    return (
      <p className={styles.updateSame}>
        <Icon icon="lucide:circle-check" width={16} aria-hidden />
        {text.t("updateSame", { version: from })}
      </p>
    );
  return (
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
  );
}
