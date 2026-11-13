"use client";

import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { WidgetData } from "@/features/dashboard/types";
import type { WidgetConfig } from "@/features/dashboard/widgets";
import { PluginFrame } from "@/features/plugins/components/PluginFrame/PluginFrame";
import type { BlockData } from "@/lib/plugins/blocks";
import styles from "../widget.module.scss";

/**
 * A plugin's building block in a custom widget (BARY-205). By default its
 * frame runs out of sight and hands over data, which Barynt draws like its
 * own blocks; with `draw: "plugin"` the frame itself takes the block's
 * place. While the plugin doesn't run here, a note — the widget's other
 * blocks stay.
 */
export function PluginBlockBody({
  data,
  config,
}: {
  data: Extract<WidgetData, { type: "pluginBlock" }>;
  /** The block's own settings, from the builder. */
  config: WidgetConfig["pluginConfig"];
}) {
  const t = useTranslations("widgets");
  const locale = useLocale();
  const [shown, setShown] = useState<BlockData | null>(null);
  if (!data.plugin)
    return (
      <div className={styles.pluginOff}>
        <Icon icon="lucide:puzzle" width={16} aria-hidden />
        <strong>{t("pluginBlockOff", { name: data.pluginId })}</strong>
        <span>{t("pluginBlockOffHint")}</span>
      </div>
    );
  const headless = data.plugin.draw === "barynt";
  return (
    <div className={styles.pluginBlock} data-draw={data.plugin.draw}>
      {headless &&
        (shown ? (
          <BlockDataView data={shown} />
        ) : (
          <span className={styles.sub}>{t("pluginBlockLoading")}</span>
        ))}
      <PluginFrame
        // New settings, a new frame: the plugin reads them once, on load.
        key={JSON.stringify(config ?? {})}
        pluginId={data.pluginId}
        name={data.plugin.name}
        headless={headless}
        onBlockData={setShown}
        context={{
          slot: { kind: "block", id: data.blockId },
          workspaceId: data.workspaceId,
          projectId: data.projectId,
          locale,
          config: config ?? {},
        }}
      />
    </div>
  );
}

/** A block's data, drawn like Barynt's own blocks. Text goes in as text. */
export function BlockDataView({ data }: { data: BlockData }) {
  switch (data.kind) {
    case "kpi":
      return (
        <div className={styles.kpiStack}>
          <div className={styles.big}>{data.value}</div>
          <div className={styles.sub}>
            {data.label}
            {data.trend && (
              <span
                className={styles.pbTrend}
                data-good={
                  data.trend.good === undefined
                    ? undefined
                    : String(data.trend.good)
                }
              >
                {" · "}
                {data.trend.text}
              </span>
            )}
          </div>
        </div>
      );
    case "progress": {
      const share = Math.round((data.value / data.max) * 100);
      return (
        <div className={styles.progress}>
          <div className={styles.big}>
            {share}
            <small>%</small>
          </div>
          <div className={styles.progressBar} role="presentation">
            <i style={{ width: `${share}%` }} />
          </div>
          {data.label && <div className={styles.sub}>{data.label}</div>}
        </div>
      );
    }
    case "list":
      return data.items.length === 0 ? (
        <span className={styles.sub}>{data.empty ?? "—"}</span>
      ) : (
        <ul className={styles.pbList}>
          {data.items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id of their own
            <li key={i}>
              {item.href ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
              ) : (
                <span>{item.title}</span>
              )}
              {item.meta && <small>{item.meta}</small>}
            </li>
          ))}
        </ul>
      );
    case "bars": {
      const max = Math.max(1, ...data.bars.map((b) => b.value));
      return (
        <ul className={styles.pbBars}>
          {data.bars.map((bar, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: bars have no id of their own
            <li key={i}>
              <span>{bar.label}</span>
              <span className={styles.pbTrack}>
                <i
                  style={{
                    width: `${(Math.max(0, bar.value) / max) * 100}%`,
                    ...(bar.color && { background: bar.color }),
                  }}
                />
              </span>
              <strong>{bar.value}</strong>
            </li>
          ))}
        </ul>
      );
    }
  }
}
