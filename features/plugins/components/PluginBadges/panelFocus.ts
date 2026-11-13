// A badge row's click opens its issue at one of the plugin's panels
// (BARY-208). The card opens the issue as it always does; this only says
// which panel to show once it's there — taken once, within a few seconds.

let pending: {
  issueId: string;
  pluginId: string;
  panelId: string;
  at: number;
} | null = null;

export function focusPanelNext(target: {
  issueId: string;
  pluginId: string;
  panelId: string;
}): void {
  pending = { ...target, at: Date.now() };
}

/** Whether this panel of this issue was asked for — and forgets it. */
export function takePanelFocus(
  issueId: string,
  pluginId: string,
  panelId: string,
): boolean {
  const hit =
    pending !== null &&
    pending.issueId === issueId &&
    pending.pluginId === pluginId &&
    pending.panelId === panelId &&
    Date.now() - pending.at < 10_000;
  if (hit) pending = null;
  return hit;
}
