// What a `link` hook's rules react to (BARY-227), and when a pull request
// counts as working on an issue rather than just naming it. No
// dependencies: the manifest's check and the browser read it too.

/** What a rule reacts to. A draft counts as opened once it's ready. */
export const LINK_TRIGGERS = [
  "pull_request.opened",
  "pull_request.merged",
] as const;
export type LinkTrigger = (typeof LINK_TRIGGERS)[number];

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
