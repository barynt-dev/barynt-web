"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import {
  BLOCK_TYPES,
  type BlockConfig,
  type BlockType,
  blockWidget,
  newBlock,
  shownBlocks,
  WIDGETS,
  type Widget,
  type WidgetBlock,
} from "@/features/dashboard/widgets";
import type { IssueFilter } from "@/features/issues/filter";
import { randomId } from "@/lib/utils/id";
import { usePluginBlocks } from "../Widget/pluginBlocks";
import { useWidgetTitle } from "../Widget/Widget";
import styles from "./blocksEditor.module.scss";
import { ElementsEditor } from "./ElementsEditor";
import { KindFields } from "./KindFields";
import { PluginBlockFields } from "./PluginBlockFields";

const pluginKey = (e: { pluginId: string; blockId: string }) =>
  `plugin:${e.pluginId}:${e.blockId}`;

/** At most this many blocks in one widget. */
const MAX_BLOCKS = 6;

interface Props {
  widget: Widget;
  onChange: (blocks: WidgetBlock[]) => void;
  editFilter: (
    filter: IssueFilter | undefined,
    save: (filter: IssueFilter | undefined) => void,
  ) => void;
  /** What's open: `<block>` or `<block>:<element>` — the preview marks it. */
  open: string | null;
  onOpen: (id: string | null) => void;
}

/**
 * A custom widget's building blocks (BARY-170): each one counts something
 * of its own (its kind's fields, its own filter on top of the widget's)
 * and carries its extras. Reorder with the arrows, ✕ to remove, a click
 * opens one.
 */
export function BlocksEditor({
  widget,
  onChange,
  editFilter,
  open,
  onOpen,
}: Props) {
  const t = useTranslations("widgets");
  const titleOf = useWidgetTitle();
  const pluginBlocks = usePluginBlocks();
  /** A plugin block's entry — while its plugin runs here. */
  const entryOf = (block: WidgetBlock) =>
    block.type === "pluginBlock"
      ? pluginBlocks.find(
          (e) =>
            e.pluginId === block.config.pluginId &&
            e.blockId === block.config.pluginBlock,
        )
      : undefined;
  const blocks = widget.config.blocks ?? [];
  const shown = new Set(shownBlocks(widget).map((b) => b.id));
  const [openBlock, openElement] = (open ?? "").split(":");

  const update = (id: string, patch: Partial<BlockConfig>) =>
    onChange(
      blocks.map((b) =>
        b.id === id ? { ...b, config: { ...b.config, ...patch } } : b,
      ),
    );
  const remove = (id: string) => {
    if (openBlock === id) onOpen(null);
    onChange(blocks.filter((b) => b.id !== id));
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  const add = (type: BlockType, config: Partial<BlockConfig> = {}) => {
    const fresh = newBlock(type, randomId().slice(0, 8));
    const block = { ...fresh, config: { ...fresh.config, ...config } };
    onChange([...blocks, block]);
    onOpen(block.id);
  };
  /** A plugin's block (BARY-205), with its settings' defaults. */
  const addPluginBlock = (key: string) => {
    const entry = pluginBlocks.find((e) => pluginKey(e) === key);
    if (!entry) return;
    const pluginConfig = Object.fromEntries(
      entry.settings.flatMap((s) =>
        s.default === null ? [] : [[s.key, s.default] as const],
      ),
    );
    add("pluginBlock", {
      pluginId: entry.pluginId,
      pluginBlock: entry.blockId,
      pluginConfig,
    });
  };

  return (
    <div className={styles.list}>
      {blocks.map((block, i) => {
        const as = blockWidget(widget, block);
        const entry = entryOf(block);
        const isPlugin = block.type === "pluginBlock";
        const name = entry?.title ?? t(`type_${block.type}`);
        const isOpen = openBlock === block.id;
        const rules = block.config.filter?.rules.length ?? 0;
        return (
          <div
            key={block.id}
            className={styles.block}
            data-open={isOpen || undefined}
          >
            <div className={styles.head}>
              <button
                type="button"
                className={styles.toggle}
                aria-expanded={isOpen}
                aria-label={t("blockSettings", { name })}
                onClick={() => onOpen(isOpen ? null : block.id)}
              >
                <span
                  className={styles.icon}
                  data-accent={WIDGETS[block.type].accent}
                >
                  <Icon icon={WIDGETS[block.type].icon} width={15} />
                </span>
                <span className={styles.text}>
                  {name}
                  <small>
                    {!shown.has(block.id)
                      ? t("elHiddenFrom", { size: t("size_L") })
                      : isPlugin
                        ? t("pluginFrom", {
                            name:
                              entry?.pluginName ?? block.config.pluginId ?? "",
                          })
                        : titleOf({
                            ...as,
                            config: { ...as.config, title: "" },
                          })}
                    {rules > 0 && ` · ${t("filterCount", { count: rules })}`}
                  </small>
                </span>
                <Icon
                  icon="lucide:chevron-down"
                  width={15}
                  className={styles.chevron}
                />
              </button>
              {blocks.length > 1 && (
                <span className={styles.arrows}>
                  <button
                    type="button"
                    aria-label={t("moveUp")}
                    disabled={i === 0}
                    onClick={() => move(i, i - 1)}
                  >
                    <Icon icon="lucide:chevron-up" width={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={t("moveDown")}
                    disabled={i === blocks.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    <Icon icon="lucide:chevron-down" width={14} />
                  </button>
                </span>
              )}
              <button
                type="button"
                className={styles.remove}
                aria-label={t("blockRemove", { name })}
                title={t("blockRemove", { name })}
                onClick={() => remove(block.id)}
              >
                <Icon icon="lucide:x" width={14} />
              </button>
            </div>

            {isOpen && isPlugin && (
              <div className={styles.form}>
                <PluginBlockFields
                  entry={entry}
                  pluginId={block.config.pluginId ?? ""}
                  values={block.config.pluginConfig ?? {}}
                  onChange={(pluginConfig) =>
                    update(block.id, { pluginConfig })
                  }
                />
              </div>
            )}
            {isOpen && !isPlugin && (
              <div className={styles.form}>
                <KindFields
                  widget={as}
                  set={(patch) => update(block.id, patch as BlockConfig)}
                />
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>{t("blockFilter")}</span>
                  <button
                    type="button"
                    className={styles.chip}
                    onClick={() =>
                      editFilter(block.config.filter, (filter) =>
                        update(block.id, { filter }),
                      )
                    }
                  >
                    <Icon icon="lucide:filter" width={12} />
                    {rules
                      ? t("filterCount", { count: rules })
                      : t("filterAdd")}
                  </button>
                  <span className={styles.help}>{t("blockFilterHelp")}</span>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>{t("extras")}</span>
                  <ElementsEditor
                    // The block as a widget of its kind, without the
                    // widget's filter mixed in — the extras edit the block.
                    widget={{ ...as, config: block.config }}
                    onChange={(elements) =>
                      update(block.id, { elements, labels: undefined })
                    }
                    editFilter={editFilter}
                    open={openElement || null}
                    onOpen={(id) => onOpen(id ? `${block.id}:${id}` : block.id)}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {blocks.length === 0 && (
        <span className={styles.none}>{t("blocksNone")}</span>
      )}
      {blocks.length < MAX_BLOCKS && (
        <InlinePicker
          width={280}
          title={t("blockAdd")}
          trigger={
            <button type="button" className={styles.add}>
              <Icon icon="lucide:plus" width={14} />
              {t("blockAdd")}
            </button>
          }
        >
          {(close) => (
            <SelectMenu
              items={[
                ...BLOCK_TYPES.filter((type) => type !== "pluginBlock").map(
                  (type) => ({
                    value: type,
                    label: t(`type_${type}`),
                    hint: t(`blockHint_${type}`),
                    icon: <Icon icon={WIDGETS[type].icon} width={14} />,
                  }),
                ),
                // What the plugins switched on here bring (BARY-205).
                ...pluginBlocks.map((entry) => ({
                  value: pluginKey(entry),
                  label: entry.title,
                  hint: t("pluginFrom", { name: entry.pluginName }),
                  icon: <Icon icon="lucide:puzzle" width={14} />,
                })),
              ]}
              value={null}
              onPick={(value) => {
                const picked = String(value);
                if (picked.startsWith("plugin:")) addPluginBlock(picked);
                else add(picked as BlockType);
                close();
              }}
              onClose={close}
            />
          )}
        </InlinePicker>
      )}
    </div>
  );
}
