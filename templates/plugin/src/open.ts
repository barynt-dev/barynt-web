import type { Issue } from "@barynt/plugin-sdk";

/** The issues still to do: neither completed nor canceled. Kept apart
 *  from the view so a test checks it without a DOM. */
export function openIssues(issues: Issue[]): Issue[] {
  return issues.filter(
    (issue) =>
      issue.statusCategory !== "completed" &&
      issue.statusCategory !== "canceled",
  );
}
