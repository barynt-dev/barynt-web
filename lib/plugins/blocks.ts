// A plugin's building block in a custom widget (BARY-205). Drawn by Barynt
// by default: the plugin hands over what to show in one of a few fixed
// shapes, and Barynt draws it like its own blocks. This is that shape, and
// the check every block's data goes through on its way out of the sandbox —
// whatever the frame sends, only this reaches the page. No dependencies.

/** How many rows, bars a block shows at most. */
export const BLOCK_MAX_ITEMS = 20;
const TEXT_MAX = 200;

export type BlockData =
  | {
      kind: "kpi";
      value: string;
      label: string;
      trend?: { text: string; good?: boolean };
    }
  | {
      kind: "list";
      items: { title: string; meta?: string; href?: string }[];
      empty?: string;
    }
  | {
      kind: "bars";
      bars: { label: string; value: number; color?: string }[];
    }
  | { kind: "progress"; value: number; max: number; label?: string };

export const BLOCK_DATA_KINDS = ["kpi", "list", "bars", "progress"] as const;

const text = (v: unknown): string | null =>
  typeof v === "string" ? v.slice(0, TEXT_MAX) : null;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
/** A link out: `http(s)` only — nothing that runs. */
const link = (v: unknown): string | undefined => {
  if (typeof v !== "string" || v.length > 2000) return undefined;
  try {
    const url = new URL(v);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};
/** A colour Barynt draws with: a hex value or one of its tokens. */
const colour = (v: unknown): string | undefined =>
  typeof v === "string" && /^#[0-9a-f]{3,8}$|^var\(--[a-z0-9-]+\)$/i.test(v)
    ? v
    : undefined;

/**
 * What a block sent, as Barynt draws it — or `null` when it isn't one of
 * the shapes. Texts are cut to 200 characters, lists to `BLOCK_MAX_ITEMS`,
 * links to `http(s)`, colours to a hex value or a token; anything else in
 * there is dropped.
 */
export function parseBlockData(input: unknown): BlockData | null {
  if (!input || typeof input !== "object") return null;
  const d = input as Record<string, unknown>;
  switch (d.kind) {
    case "kpi": {
      const value =
        typeof d.value === "number" && Number.isFinite(d.value)
          ? String(d.value)
          : text(d.value);
      const label = text(d.label);
      if (value === null || label === null) return null;
      const t = d.trend as Record<string, unknown> | undefined;
      const trendText = t && typeof t === "object" ? text(t.text) : null;
      return {
        kind: "kpi",
        value,
        label,
        ...(trendText !== null && {
          trend: {
            text: trendText,
            ...(typeof t?.good === "boolean" && { good: t.good }),
          },
        }),
      };
    }
    case "list": {
      if (!Array.isArray(d.items)) return null;
      const items = d.items.slice(0, BLOCK_MAX_ITEMS).flatMap((raw) => {
        const i = (raw ?? {}) as Record<string, unknown>;
        const title = text(i.title);
        if (title === null) return [];
        const meta = text(i.meta);
        const href = link(i.href);
        return [
          { title, ...(meta !== null && { meta }), ...(href && { href }) },
        ];
      });
      const empty = text(d.empty);
      return { kind: "list", items, ...(empty !== null && { empty }) };
    }
    case "bars": {
      if (!Array.isArray(d.bars)) return null;
      const bars = d.bars.slice(0, BLOCK_MAX_ITEMS).flatMap((raw) => {
        const b = (raw ?? {}) as Record<string, unknown>;
        const label = text(b.label);
        const value = num(b.value);
        if (label === null || value === null) return [];
        const color = colour(b.color);
        return [{ label, value, ...(color && { color }) }];
      });
      return { kind: "bars", bars };
    }
    case "progress": {
      const value = num(d.value);
      const max = num(d.max) ?? 100;
      if (value === null || max <= 0) return null;
      const label = text(d.label);
      return {
        kind: "progress",
        value: Math.max(0, Math.min(value, max)),
        max,
        ...(label !== null && { label }),
      };
    }
    default:
      return null;
  }
}

/** A block's own settings, as the builder saves them. */
export type BlockSettingValues = Record<string, string | number | boolean>;
