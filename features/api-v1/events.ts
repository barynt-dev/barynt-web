import "server-only";
import {
  changesFor,
  issueChangeEvents,
  issueChanges,
} from "@/lib/webhooks/changes";
import {
  dispatchEvent,
  type EventContext,
  hasEventListeners,
} from "@/lib/webhooks/emit";
import { background } from "@/lib/webhooks/resources";
import {
  type ApiIssue,
  getCommentUnchecked,
  getIssueUnchecked,
} from "./queries";

// Issue and comment events (BARY-210), in the REST API's shapes — so a
// receiver reads the same fields it gets from `GET /api/v1/…`. Shared by
// the app's own actions and the `*ForUser` functions behind REST, MCP and
// plugins. Projects, labels and members: `lib/webhooks/resources.ts`.
//
// Like `emitEvent`, every `emit*` here is fire-and-forget: it's called
// after the change is written, returns at once and never throws — an
// event that can't go out never undoes or fails what happened.

// ─── Issues ──────────────────────────────────────────────────────────────────

export interface IssueTracker {
  /** Announces what changed since `trackIssue`, if anything did. */
  emit(ctx: EventContext): void;
}

/**
 * Takes an issue's snapshot before a change, so the event can say what
 * changed. `null` when nothing in the workspace listens — then there's no
 * snapshot to take, and the caller has nothing to announce.
 */
export async function trackIssue(
  issueId: string,
  workspaceId: string,
): Promise<IssueTracker | null> {
  try {
    if (!(await hasEventListeners(workspaceId))) return null;
    const before = await getIssueUnchecked(issueId);
    if (!before) return null;
    return {
      emit: (ctx) =>
        background(() => announceIssueChange(issueId, before, ctx)),
    };
  } catch {
    return null;
  }
}

async function announceIssueChange(
  issueId: string,
  before: ApiIssue,
  ctx: EventContext,
) {
  const after = await getIssueUnchecked(issueId);
  if (!after) return;
  const changes = issueChanges(before, after);
  for (const event of issueChangeEvents(changes))
    await dispatchEvent(event, after, ctx, {
      changes: changesFor(event, changes),
    });
}

/** `issue.created` — the issue as the API shows it. */
export function emitIssueCreated(issueId: string, ctx: EventContext): void {
  background(async () => {
    if (!(await hasEventListeners(ctx.workspaceId))) return;
    const issue = await getIssueUnchecked(issueId);
    if (issue) await dispatchEvent("issue.created", issue, ctx);
  });
}

// ─── Comments ────────────────────────────────────────────────────────────────

/** `comment.created` / `comment.updated` — read fresh in the background. */
export function emitCommentEvent(
  event: "comment.created" | "comment.updated",
  commentId: string,
  ctx: EventContext,
): void {
  background(async () => {
    if (!(await hasEventListeners(ctx.workspaceId))) return;
    const comment = await getCommentUnchecked(commentId);
    if (comment) await dispatchEvent(event, comment, ctx);
  });
}
