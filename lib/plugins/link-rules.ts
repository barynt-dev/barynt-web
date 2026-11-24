// What a `link` hook's rules react to (BARY-227), and when a pull request
// counts as working on an issue rather than just naming it. No
// dependencies: the manifest's check and the browser read it too.

/**
 * What a rule reacts to. A pull request's way, in order: opened as a draft,
 * opened (or a draft marked ready), a review asked for, approved or changes
 * requested, merged — or closed without merging. Its branch's checks
 * failing (GitHub Actions and any other check). And the work deployed:
 * to a test environment (staging, a preview), or to production — as
 * GitHub marks the environment.
 */
export const LINK_TRIGGERS = [
  "pull_request.draft",
  "pull_request.opened",
  "pull_request.review_requested",
  "pull_request.approved",
  "pull_request.changes_requested",
  "pull_request.merged",
  "pull_request.closed",
  "checks.failed",
  "deployment.test",
  "deployment.production",
] as const;
export type LinkTrigger = (typeof LINK_TRIGGERS)[number];

/** The group a trigger belongs to on the settings page. */
export const linkTriggerGroup = (trigger: LinkTrigger) =>
  trigger.startsWith("checks.")
    ? "checks"
    : trigger.startsWith("deployment.")
      ? "deployment"
      : "pull_request";

export type LinkTriggerGroup = ReturnType<typeof linkTriggerGroup>;

/** Whether a target branch counts, by the place's list — empty: every one.
 *  `release/*` takes every branch below `release/`. */
export function baseMatches(base: string | null, bases: readonly string[]) {
  if (bases.length === 0) return true;
  if (!base) return false;
  return bases.some((b) =>
    b.endsWith("/*") ? base.startsWith(b.slice(0, -1)) : base === b,
  );
}

const KEY = "[A-Za-z][A-Za-z0-9]{0,9}[-_]\\d{1,7}";
const CLOSING = new RegExp(
  `\\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\b:?\\s+(${KEY}(?:(?:\\s*,\\s*|\\s+and\\s+)${KEY})*)`,
  "gi",
);

/**
 * The keys a text closes — `Fixes WEB-42`, `closes web-7, WEB-8 and
 * WEB-9` — as texts to look for issue keys in. A key named anywhere else
 * only links the pull request; a rule moves the issue only for these, or
 * for the key in the branch's name.
 */
export function closingMentions(text: string): string[] {
  return [...text.matchAll(CLOSING)].map((m) => m[1]);
}
