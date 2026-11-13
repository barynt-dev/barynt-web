"use client";

import { Icon } from "@iconify/react";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { PluginFrame } from "@/features/plugins/components/PluginFrame/PluginFrame";
import { PluginTile } from "@/features/plugins/components/PluginStore/PluginTile";
import type { IssueDetail, IssuePluginPanel } from "@/types/issue";
import styles from "../issueDetail.module.scss";

/** As tall as its content, between these (px); past the top it scrolls. */
const PANEL_HEIGHT = { min: 48, max: 640 };

const storageKey = (p: IssuePluginPanel) =>
  `barynt:issue-panel:${p.pluginId}:${p.panelId}`;

/**
 * The panels plugins show in an issue (BARY-150), in the side panel, the
 * dialog, the page and the phone sheet alike. Each one folds; only an open
 * one has a frame — collapsed it costs nothing, and stays collapsed for this
 * person (`localStorage`). The frame grows to its content.
 */
export function IssuePluginPanels({
  issue,
  workspaceId,
}: {
  issue: IssueDetail;
  workspaceId: string;
}) {
  if (issue.pluginPanels.length === 0) return null;
  return (
    <>
      {issue.pluginPanels.map((panel) => (
        <PluginPanel
          key={`${panel.pluginId}:${panel.panelId}`}
          panel={panel}
          issue={issue}
          workspaceId={workspaceId}
        />
      ))}
    </>
  );
}

function PluginPanel({
  panel,
  issue,
  workspaceId,
}: {
  panel: IssuePluginPanel;
  issue: IssueDetail;
  workspaceId: string;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(true);
  // Read after mounting: the server has no `localStorage`, and the first
  // render has to match its HTML.
  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey(panel)) === "closed") setOpen(false);
    } catch {}
  }, [panel]);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      if (next) localStorage.removeItem(storageKey(panel));
      else localStorage.setItem(storageKey(panel), "closed");
    } catch {}
  };
  const bodyId = `plugin-panel-${panel.pluginId}-${panel.panelId}`;
  return (
    <section className={styles.section} data-plugin-panel>
      <header className={styles.sectionHead}>
        <button
          type="button"
          className={styles.pluginPanelToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={toggle}
        >
          <PluginTile id={panel.pluginId} name={panel.pluginName} size="sm" />
          <h3 className={styles.sectionTitle}>{panel.title}</h3>
          <span className={styles.pluginPanelFrom}>{panel.pluginName}</span>
          <Icon
            icon="lucide:chevron-down"
            width={15}
            className={styles.pluginPanelChevron}
            aria-hidden
          />
        </button>
      </header>
      <div id={bodyId} className={styles.pluginPanelBody} hidden={!open}>
        {open && (
          <PluginFrame
            // Another issue, another frame: the plugin reads its context once.
            key={issue.id}
            pluginId={panel.pluginId}
            name={panel.pluginName}
            autoHeight={PANEL_HEIGHT}
            context={{
              slot: { kind: "issuePanel", id: panel.panelId },
              workspaceId,
              projectId: issue.project,
              issueId: issue.id,
              locale,
            }}
          />
        )}
      </div>
    </section>
  );
}
