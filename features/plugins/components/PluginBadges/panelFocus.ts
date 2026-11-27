// A badge row's click opens its issue at one of the plugin's panels
// (BARY-208). The card opens the issue as it always does; this only says
// which panel to show once it's there — taken once, within a few seconds.

let pending: {
  issueId: string;
  pluginId: string;
  panelId: string;
  section?: string;
  at: number;
} | null = null;

export function focusPanelNext(target: {
  issueId: string;
  pluginId: string;
  panelId: string;
  /** The part of the panel to show — the frame's `context.focus`. */
  section?: string;
}): void {
  pending = { ...target, at: Date.now() };
}

/** Whether this panel of this issue was asked for — with the part of it,
 *  if one was — and forgets it. */
export function takePanelFocus(
  issueId: string,
  pluginId: string,
  panelId: string,
): { section: string | null } | null {
  const hit =
    pending !== null &&
    pending.issueId === issueId &&
    pending.pluginId === pluginId &&
    pending.panelId === panelId &&
    Date.now() - pending.at < 10_000;
  const section = pending?.section ?? null;
  if (hit) pending = null;
  return hit ? { section } : null;
}
