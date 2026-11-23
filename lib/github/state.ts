import { openSecret, sealSecret } from "@/lib/secret-box";

// What Barynt hands GitHub as `state` and gets back (BARY-238): who started
// it, for which plugin and place, and until when. Sealed, so it can neither
// be read nor made up — a callback without one Barynt sealed for this
// person, and still fresh, goes nowhere.

const PURPOSE = "github-state";

/** Starting to connect a workspace or project. */
export interface ConnectState {
  kind: "connect";
  userId: string;
  pluginId: string;
  workspaceId: string;
  projectId: string | null;
  /** The settings page to return to. */
  back: string;
}

/** Creating the instance's app (Admin → Plugins). */
export interface AppState {
  kind: "app";
  userId: string;
  back: string;
}

export type GitHubState = ConnectState | AppState;

/** Connecting takes a round at GitHub, perhaps an install: half an hour. */
export const STATE_TTL_SECONDS = 30 * 60;

export function sealState(
  state: GitHubState,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  return sealSecret(
    JSON.stringify({ ...state, exp: nowSeconds + STATE_TTL_SECONDS }),
    PURPOSE,
  );
}

/** The state, if Barynt sealed it, it's of `kind`, for `userId`, and fresh. */
export function openState<K extends GitHubState["kind"]>(
  sealed: string | null,
  kind: K,
  userId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Extract<GitHubState, { kind: K }> | null {
  if (!sealed) return null;
  const plain = openSecret(sealed, PURPOSE);
  if (!plain) return null;
  try {
    const data = JSON.parse(plain) as GitHubState & { exp?: number };
    if (data.kind !== kind || data.userId !== userId) return null;
    if (typeof data.exp !== "number" || data.exp < nowSeconds) return null;
    // Only a path of this app — never somewhere else.
    if (typeof data.back !== "string" || !/^\/(?!\/)/.test(data.back))
      return null;
    return data as Extract<GitHubState, { kind: K }>;
  } catch {
    return null;
  }
}

/** The installations a person may choose from, after signing in at GitHub
 *  — kept in a sealed cookie for the settings page, briefly. */
export interface InstallationChoice {
  userId: string;
  pluginId: string;
  scopeKey: string;
  installations: GitHubAccount[];
}

export interface GitHubAccount {
  id: string;
  account: string;
  accountType: string;
  avatar: string | null;
}

export const CHOICE_COOKIE = "barynt_github_choice";
export const CHOICE_TTL_SECONDS = 10 * 60;
const CHOICE_PURPOSE = "github-choice";

export function sealChoice(
  choice: InstallationChoice,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  return sealSecret(
    JSON.stringify({ ...choice, exp: nowSeconds + CHOICE_TTL_SECONDS }),
    CHOICE_PURPOSE,
  );
}

export function openChoice(
  sealed: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): InstallationChoice | null {
  if (!sealed) return null;
  const plain = openSecret(sealed, CHOICE_PURPOSE);
  if (!plain) return null;
  try {
    const data = JSON.parse(plain) as InstallationChoice & { exp?: number };
    if (typeof data.exp !== "number" || data.exp < nowSeconds) return null;
    return data;
  } catch {
    return null;
  }
}
