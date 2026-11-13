"use client";

import { Icon } from "@iconify/react";
import { useLocale } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PluginBadgeProvider } from "@/features/plugins/slots";
import {
  BADGE_BATCH,
  BADGE_ICONS,
  type Badge,
  type BadgeIcon,
  type BadgeIssue,
  parseBadges,
  pluginBadgeEntry,
  type RowPart,
} from "@/lib/plugins/badges";
import type { IssueDetail } from "@/types";
import { PluginFrame } from "../PluginFrame/PluginFrame";
import { focusPanelNext } from "./panelFocus";
import styles from "./pluginBadges.module.scss";

// Plugins' badges on a project's board cards and list rows (BARY-151). The
// project's layout provides them; the board or list says which issues it
// shows (`usePluginBadgeIssues`), and each plugin's one hidden frame gets
// them in batches and answers with chips — checked here (`parseBadges`)
// before a card draws them. "Display" hides a badge as `pb:<plugin>:<badge>`.

interface Ctx {
  providers: PluginBadgeProvider[];
  /** By plugin, then issue. */
  badges: Record<string, Record<string, Badge[]>>;
  show: (issues: IssueDetail[]) => void;
}

const PluginBadgesContext = createContext<Ctx | null>(null);

type Shown = Pick<
  IssueDetail,
  "id" | "key" | "title" | "priority" | "dueDate" | "created"
>;

export function PluginBadgesProvider({
  providers,
  prefix,
  workspaceId,
  projectId,
  children,
}: {
  providers: PluginBadgeProvider[];
  prefix: string;
  workspaceId: string;
  projectId: string;
  children: React.ReactNode;
}) {
  const [issues, setIssues] = useState<Shown[]>([]);
  const [badges, setBadges] = useState<Ctx["badges"]>({});
  const show = useCallback((list: IssueDetail[]) => {
    setIssues((current) => {
      const next = list.map(
        ({ id, key, title, priority, dueDate, created }) => ({
          id,
          key,
          title,
          priority,
          dueDate,
          created,
        }),
      );
      // The same issues again (a re-render): keep the state, ask nothing.
      return JSON.stringify(next) === JSON.stringify(current) ? current : next;
    });
  }, []);
  const value = useMemo(
    () => ({ providers, badges, show }),
    [providers, badges, show],
  );
  return (
    <PluginBadgesContext.Provider value={value}>
      {children}
      {issues.length > 0 &&
        providers.map((provider) => (
          <BadgeSource
            key={provider.pluginId}
            provider={provider}
            issues={issues}
            prefix={prefix}
            workspaceId={workspaceId}
            projectId={projectId}
            onBadges={(found) =>
              setBadges((all) => ({ ...all, [provider.pluginId]: found }))
            }
          />
        ))}
    </PluginBadgesContext.Provider>
  );
}

/** One plugin's hidden frame, asking for the issues in batches. */
function BadgeSource({
  provider,
  issues,
  prefix,
  workspaceId,
  projectId,
  onBadges,
}: {
  provider: PluginBadgeProvider;
  issues: Shown[];
  prefix: string;
  workspaceId: string;
  projectId: string;
  onBadges: (badges: Record<string, Badge[]>) => void;
}) {
  const locale = useLocale();
  // What it may see: id and reference; more with `issues:read`.
  const batches = useMemo(() => {
    const all: BadgeIssue[] = issues.map((i) => ({
      id: i.id,
      ref: `${prefix}-${i.key}`,
      ...(provider.canRead && {
        title: i.title,
        priority: i.priority,
        dueDate: i.dueDate === null ? null : new Date(i.dueDate).toISOString(),
        created: new Date(i.created).toISOString(),
      }),
    }));
    const out: BadgeIssue[][] = [];
    for (let i = 0; i < all.length; i += BADGE_BATCH)
      out.push(all.slice(i, i + BADGE_BATCH));
    return out;
  }, [issues, prefix, provider.canRead]);
  const [step, setStep] = useState(0);
  const [found, setFound] = useState<Record<string, Badge[]>>({});
  // New issues: start over, from a fresh sequence number.
  const [base, setBase] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new list of issues starts the batches over
  useEffect(() => {
    setStep(0);
    setFound({});
    setBase((b) => b + 1000);
  }, [batches]);
  const declared = useMemo(
    () => new Set(provider.badges.map((b) => b.id)),
    [provider.badges],
  );
  const request = useMemo(
    () =>
      step < batches.length
        ? { seq: base + step, issues: batches[step] }
        : null,
    [base, step, batches],
  );
  return (
    <PluginFrame
      pluginId={provider.pluginId}
      name={provider.pluginName}
      headless
      context={{
        slot: { kind: "badges", id: "badges" },
        workspaceId,
        projectId,
        locale,
      }}
      badgeRequest={request}
      onBadges={(seq, raw) => {
        if (!request || seq !== request.seq) return;
        const asked = new Set(request.issues.map((i) => i.id));
        const next = { ...found, ...parseBadges(raw, asked, declared) };
        setFound(next);
        onBadges(next);
        setStep((s) => s + 1);
      }}
    />
  );
}

/** Tells the provider which issues the board or list shows. */
export function usePluginBadgeIssues(issues: IssueDetail[]): void {
  const ctx = useContext(PluginBadgesContext);
  useEffect(() => {
    ctx?.show(issues);
  }, [ctx?.show, issues]);
}

/** The badges "Display" can hide, as entries of `hiddenFields`. */
export function usePluginBadgeEntries(): {
  entry: string;
  title: string;
  pluginName: string;
}[] {
  const ctx = useContext(PluginBadgesContext);
  return (ctx?.providers ?? []).flatMap((p) =>
    p.badges.map((b) => ({
      entry: pluginBadgeEntry(p.pluginId, b.id),
      title: b.title,
      pluginName: p.pluginName,
    })),
  );
}

/** An issue's badges from every plugin, the hidden ones left out. */
function useIssueBadges(issueId: string, hidden: string[]) {
  const ctx = useContext(PluginBadgesContext);
  if (!ctx) return [];
  const hiddenSet = new Set(hidden);
  return ctx.providers.flatMap((p) =>
    (ctx.badges[p.pluginId]?.[issueId] ?? [])
      .filter((b) => !hiddenSet.has(pluginBadgeEntry(p.pluginId, b.badge)))
      .map((b, i) => ({
        ...b,
        plugin: p.pluginName,
        pluginId: p.pluginId,
        key: `${p.pluginId}:${b.badge}:${i}`,
      })),
  );
}

/** A row's first icon, groups opened — what it shows as a chip. */
function firstIcon(parts: RowPart[]): BadgeIcon | undefined {
  for (const p of parts) {
    if (p.type === "icon") return p.icon;
    if (p.type === "group") {
      const inner = firstIcon(p.children);
      if (inner) return inner;
    }
  }
  return undefined;
}

const STATUS_ICON = {
  success: "lucide:circle-check",
  danger: "lucide:circle-x",
  warning: "lucide:triangle-alert",
  pending: "lucide:clock",
} as const;

/**
 * An issue's chips from every plugin — up to `max`, then "+N" with the
 * rest in its tooltip. A row (BARY-207) shows as a chip too, its reference
 * first, unless `rows="skip"` — the card draws those across itself
 * (`PluginBadgeRows`).
 */
export function PluginBadgeChips({
  issueId,
  hidden,
  max = 3,
  rows = "compact",
}: {
  issueId: string;
  hidden: string[];
  max?: number;
  rows?: "compact" | "skip";
}) {
  const all = useIssueBadges(issueId, hidden);
  const chips = rows === "skip" ? all.filter((b) => b.kind !== "row") : all;
  if (chips.length === 0) return null;
  const shown = chips.slice(0, max);
  const rest = chips.slice(max);
  return (
    <span className={styles.chips}>
      {shown.map((b) => {
        // A row as a chip shows its first icon, if it has one.
        const icon = b.icon ?? firstIcon(b.parts ?? []);
        return (
          <span
            key={b.key}
            className={styles.chip}
            data-tone={b.tone ?? "neutral"}
            title={`${b.tooltip ?? b.text} · ${b.plugin}`}
          >
            {icon && <Icon icon={BADGE_ICONS[icon]} width={11} aria-hidden />}
            {b.text}
          </span>
        );
      })}
      {rest.length > 0 && (
        <span
          className={styles.chip}
          data-tone="neutral"
          title={rest.map((b) => b.text).join(", ")}
        >
          +{rest.length}
        </span>
      )}
    </span>
  );
}

/**
 * The rows plugins put across an issue's card (BARY-207, BARY-208), each
 * built from the parts the plugin chose — building blocks and free layout
 * alike — on one line, or two after a `break`. Barynt draws every part. A
 * row with a `panel` opens the issue at that panel of the plugin's.
 */
export function PluginBadgeRows({
  issueId,
  hidden,
}: {
  issueId: string;
  hidden: string[];
}) {
  const rows = useIssueBadges(issueId, hidden).filter((b) => b.kind === "row");
  if (rows.length === 0) return null;
  return (
    <div className={styles.rows}>
      {rows.map((b) => {
        const parts = b.parts ?? [];
        const cut = parts.findIndex((p) => p.type === "break");
        const lines =
          cut < 0 ? [parts] : [parts.slice(0, cut), parts.slice(cut + 1)];
        const panel = b.panel;
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: the card around it is the control; this only says which panel to show
          // biome-ignore lint/a11y/useKeyWithClickEvents: see above — the card opens on its own keys
          <div
            key={b.key}
            className={styles.row}
            data-tone={b.tone ?? "neutral"}
            data-panel={panel ? "" : undefined}
            title={`${b.tooltip ?? b.text} · ${b.plugin}`}
            onClick={
              panel
                ? () =>
                    focusPanelNext({
                      issueId,
                      pluginId: b.pluginId,
                      panelId: panel,
                    })
                : undefined
            }
          >
            {lines.map((line, l) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a row's two lines have no id
              <div key={l} className={styles.line}>
                {line.map((part, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: parts have no id; their order is what they are
                  <RowPartView key={i} part={part} />
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

const GAP = ["0", "0.25rem", "0.5rem", "0.75rem"];
const PAD = ["0", "0.125rem 0.375rem", "0.25rem 0.5rem"];

function RowPartView({ part }: { part: RowPart }) {
  const locale = useLocale();
  switch (part.type) {
    case "group":
      return (
        <span
          className={styles.group}
          data-direction={part.direction ?? "row"}
          data-align={part.align}
          data-justify={part.justify}
          data-grow={part.grow || undefined}
          data-background={part.background}
          data-border={part.border || undefined}
          data-radius={part.radius}
          style={{
            gap: GAP[part.gap ?? 1],
            padding: PAD[part.padding ?? 0],
          }}
        >
          {part.children.map((child, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: parts have no id; their order is what they are
            <RowPartView key={i} part={child} />
          ))}
        </span>
      );
    case "icon":
      return (
        <Icon
          icon={BADGE_ICONS[part.icon]}
          width={15}
          className={styles.partIcon}
          data-tone={part.tone}
          aria-hidden
        />
      );
    case "text":
      return (
        <span
          className={styles.partText}
          data-tone={part.tone}
          data-size={part.size}
          data-mono={part.mono || undefined}
          data-strong={part.strong || undefined}
          data-italic={part.italic || undefined}
        >
          {part.text}
        </span>
      );
    case "dot":
      return <span className={styles.dot} data-tone={part.tone ?? "neutral"} />;
    case "image":
      return (
        // biome-ignore lint/performance/noImgElement: a plugin's tiny data URL — nothing for next/image to optimize
        <img
          className={styles.image}
          src={part.src}
          alt={part.alt}
          width={part.width}
          height={part.height}
          data-rounded={part.rounded || undefined}
        />
      );
    case "chip":
      return (
        <span className={styles.chip} data-tone={part.tone ?? "neutral"}>
          {part.text}
        </span>
      );
    case "label":
      return (
        <span
          className={styles.label}
          style={
            {
              "--label": part.color.startsWith("#")
                ? part.color
                : `var(--${part.color})`,
            } as React.CSSProperties
          }
        >
          {part.name}
        </span>
      );
    case "avatar":
      // Initials to look at, the name for screen readers.
      return (
        <span className={styles.partAvatar} title={part.name}>
          <span aria-hidden>
            {part.name
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase() ?? "")
              .join("")}
          </span>
          <span className={styles.srOnly}>{part.name}</span>
        </span>
      );
    case "steps":
      return (
        <span
          className={styles.steps}
          role="img"
          aria-label={part.steps.join(", ")}
        >
          {part.steps.map((step, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: steps have no id; their order is what they are
            <i key={i} data-step={step} />
          ))}
        </span>
      );
    case "progress":
      return (
        <span
          className={styles.partProgress}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={part.max}
          aria-valuenow={part.value}
        >
          <i style={{ width: `${(part.value / part.max) * 100}%` }} />
        </span>
      );
    case "sparkline": {
      const min = Math.min(...part.values);
      const span = Math.max(...part.values) - min || 1;
      const step = 48 / (part.values.length - 1);
      const points = part.values
        .map(
          (v, i) =>
            `${(i * step).toFixed(1)},${(13 - ((v - min) / span) * 12).toFixed(1)}`,
        )
        .join(" ");
      return (
        <svg
          className={styles.sparkline}
          data-tone={part.tone}
          width={48}
          height={14}
          viewBox="0 0 48 14"
          role="img"
          aria-label={part.values.join(", ")}
        >
          <polyline points={points} fill="none" strokeWidth={1.5} />
        </svg>
      );
    }
    case "date": {
      const date = new Date(part.date);
      const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
      return (
        <time
          className={styles.partText}
          data-tone="subtle"
          dateTime={part.date}
        >
          {part.format === "short"
            ? date.toLocaleDateString(locale, {
                day: "numeric",
                month: "short",
              })
            : new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
                days,
                "day",
              )}
        </time>
      );
    }
    case "link":
      return (
        <a
          className={styles.link}
          href={part.href}
          target="_blank"
          rel="noopener noreferrer"
          // A link inside a card opens the address, not the issue.
          onClick={(e) => e.stopPropagation()}
        >
          {part.text}
        </a>
      );
    case "status":
      return (
        <Icon
          icon={STATUS_ICON[part.status]}
          width={15}
          className={styles.rowStatus}
          data-status={part.status}
          aria-label={part.status}
        />
      );
    case "spacer":
      return <span className={styles.spacer} />;
    case "break":
      return null;
  }
}
