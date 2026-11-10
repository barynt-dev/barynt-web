// The rules of a plugin's life (BARY-142): which version counts, what an
// activation still needs, where a rollback goes. No database here — the
// actions in `features/plugins` read rows and ask these questions.

import type { PluginLevel } from "./manifest";
import { compareSemver } from "./semver";

/** A stored version, as these rules need it. */
export interface VersionRow {
  version: string;
  status: "active" | "superseded" | "blocked";
}

/**
 * Whether what someone confirmed is exactly what is asked for — no more, no
 * less, order aside. The server checks this itself: a client that skips the
 * dialog (or shows a stale one) can't install or activate on its own say-so.
 */
export function confirmsExactly(
  asked: readonly string[],
  confirmed: readonly string[],
): boolean {
  const a = new Set(asked);
  const c = new Set(confirmed);
  return a.size === c.size && [...a].every((x) => c.has(x));
}

/** What a plugin asks for beyond what an activation confirmed — after an
 *  update, the new capabilities that wait for a fresh confirmation. */
export function pendingCapabilities(
  asked: readonly string[],
  confirmed: readonly string[],
): string[] {
  const c = new Set(confirmed);
  return asked.filter((x) => !c.has(x));
}

export type ActivationState =
  /** Runs, with what was confirmed. */
  | "active"
  /** Switched off here; settings and storage stay. */
  | "disabled"
  /** The installed version asks for more than was confirmed: until someone
   *  confirms again, it runs with what was confirmed before. */
  | "needsConfirmation"
  /** Blocked by the platform admin — runs nowhere. */
  | "blocked"
  /** No version installed (uninstalled, data kept). */
  | "notInstalled";

/** Where an activation stands against the plugin's installed versions. */
export function activationState(
  activation: { enabled: boolean; capabilities: readonly string[] },
  versions: readonly VersionRow[],
  activeCapabilities: readonly string[] | null,
): ActivationState {
  if (versions.some((v) => v.status === "blocked")) return "blocked";
  if (!versions.some((v) => v.status === "active") || !activeCapabilities)
    return "notInstalled";
  if (!activation.enabled) return "disabled";
  return pendingCapabilities(activeCapabilities, activation.capabilities)
    .length > 0
    ? "needsConfirmation"
    : "active";
}

/** The version a rollback returns to: the newest superseded one below the
 *  active version — `null` when there's none. */
export function rollbackTarget(versions: readonly VersionRow[]): string | null {
  const active = versions.find((v) => v.status === "active");
  if (!active) return null;
  const older = versions
    .filter(
      (v) =>
        v.status === "superseded" &&
        compareSemver(v.version, active.version) < 0,
    )
    .sort((a, b) => compareSemver(b.version, a.version));
  return older[0]?.version ?? null;
}

/** The version unblocking brings back: the newest blocked one. */
export function unblockTarget(versions: readonly VersionRow[]): string | null {
  const blocked = versions
    .filter((v) => v.status === "blocked")
    .sort((a, b) => compareSemver(b.version, a.version));
  return blocked[0]?.version ?? null;
}

/** Whether a plugin may be switched on at this level — the manifest names
 *  the levels it works on. */
export function allowsLevel(
  levels: readonly PluginLevel[],
  scope: { projectId?: string | null },
): boolean {
  return levels.includes(scope.projectId ? "project" : "workspace");
}
