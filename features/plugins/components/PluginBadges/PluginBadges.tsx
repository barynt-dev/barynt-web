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
  type BadgeIssue,
  parseBadges,
  pluginBadgeEntry,
} from "@/lib/plugins/badges";
import type { IssueDetail } from "@/types";
import { PluginFrame } from "../PluginFrame/PluginFrame";
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

/** An issue's chips from every plugin, the hidden ones left out — up to
 *  `max`, then "+N" with the rest in its tooltip. */
export function PluginBadgeChips({
  issueId,
  hidden,
  max = 3,
}: {
  issueId: string;
  hidden: string[];
  max?: number;
}) {
  const ctx = useContext(PluginBadgesContext);
  if (!ctx) return null;
  const hiddenSet = new Set(hidden);
  const chips = ctx.providers.flatMap((p) =>
    (ctx.badges[p.pluginId]?.[issueId] ?? [])
      .filter((b) => !hiddenSet.has(pluginBadgeEntry(p.pluginId, b.badge)))
      .map((b) => ({
        ...b,
        plugin: p.pluginName,
        key: `${p.pluginId}:${b.badge}:${b.text}`,
      })),
  );
  if (chips.length === 0) return null;
  const shown = chips.slice(0, max);
  const rest = chips.slice(max);
  return (
    <span className={styles.chips}>
      {shown.map((b) => (
        <span
          key={b.key}
          className={styles.chip}
          data-tone={b.tone ?? "neutral"}
          title={`${b.tooltip ?? b.text} · ${b.plugin}`}
        >
          {b.icon && <Icon icon={BADGE_ICONS[b.icon]} width={11} aria-hidden />}
          {b.text}
        </span>
      ))}
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
