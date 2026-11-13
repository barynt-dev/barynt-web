"use client";

import { Icon } from "@iconify/react";
import { useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { takePanelFocus } from "@/features/plugins/components/PluginBadges/panelFocus";
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
  placement,
}: {
  issue: IssueDetail;
  workspaceId: string;
  /** Which of them: the main column's, or the sidebar's (BARY-209). */
  placement: IssuePluginPanel["placement"];
}) {
  const panels = issue.pluginPanels.filter((p) => p.placement === placement);
  if (panels.length === 0) return null;
  return (
    <>
      {panels.map((panel) => (
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
  const section = useRef<HTMLElement>(null);
  // Read after mounting: the server has no `localStorage`, and the first
  // render has to match its HTML. A badge row's click (BARY-208) opens it
  // whatever was stored, and brings it into view.
  useEffect(() => {
    if (takePanelFocus(issue.id, panel.pluginId, panel.panelId)) {
      setOpen(true);
      const timer = window.setTimeout(
        () =>
          section.current?.scrollIntoView({
            block: "start",
            behavior: "smooth",
          }),
        150,
      );
      return () => window.clearTimeout(timer);
    }
    try {
      if (localStorage.getItem(storageKey(panel)) === "closed") setOpen(false);
    } catch {}
  }, [panel, issue.id]);
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
    <section
      ref={section}
      className={styles.section}
      data-plugin-panel
      data-placement={panel.placement}
    >
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
