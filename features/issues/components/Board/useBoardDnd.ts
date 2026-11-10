import { useOptimistic, useRef, useState, useTransition } from "react";
import { reorderIssue, updateIssue } from "@/features/issues/actions";
import {
  canMoveBetweenGroups,
  type GroupKey,
  groupField,
  groupIdOf,
  groupIdsOf,
  groupMovePatch,
  withMovePatch,
} from "@/features/issues/group";
import { rankBetween } from "@/features/issues/rank";
import {
  type SortKey,
  type SortLookups,
  sortByKey,
} from "@/features/issues/sort";
import type { IssuePatch } from "@/features/issues/types";
import type { FieldDefinition } from "@/lib/custom-fields";
import { markLocalMutation } from "@/lib/realtime/localMutation";
import type { Issue } from "@/types";

/**
 * Encapsulates board drag-and-drop: optimistic reordering across status
 * columns, rank calculation, and the transient hover/insert state needed
 * to render drop indicators.
 *
 * `sortKey` beyond "manual" (BARY-34) changes what `getColumnIssues` returns
 * (sorted by that key rather than by drag-and-drop rank) — dragging a card
 * still works and still changes its status/rank when dropped in another
 * column, but its position no longer visibly reflects where it's released
 * as long as a non-manual order is active.
 *
 * With swimlanes (`laneKey`, BARY-173) a drop target is a cell — a column
 * within a lane — and dropping sets both values: the column's and the
 * lane's. Without lanes, `laneId` is left out everywhere.
 */
export function useBoardDnd<T extends Issue>(
  issues: T[],
  sortKey: SortKey,
  sortLookups: SortLookups,
  groupKey: GroupKey,
  laneKey: GroupKey | null = null,
  /** The custom fields a grouping (columns or lanes) can be by — needed to
   *  move between a field's values. */
  customFields: FieldDefinition[] = [],
) {
  const [, startTransition] = useTransition();

  // State only for rendering the drop indicator
  const [dragging, setDragging] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [dragOverCard, setDragOverCard] = useState<string | null>(null);
  const [insertAbove, setInsertAbove] = useState(false);

  // Refs for use inside event handlers — always up-to-date, no stale closure
  const dragIssueRef = useRef<T | null>(null);
  /** The group the card was picked up in — which value a move gives up. */
  const dragFromRef = useRef<string | null>(null);
  /** …and the lane, with swimlanes by a multi-choice field. */
  const dragFromLaneRef = useRef<string | null>(null);
  const dragOverCardRef = useRef<string | null>(null);
  const insertAboveRef = useRef(false);

  const [optimisticIssues, addOptimistic] = useOptimistic(
    issues,
    (
      state,
      { id, patch, rank }: { id: string; patch: IssuePatch; rank: number },
    ) =>
      state.map((i) =>
        i.id === id ? { ...withMovePatch(i, patch), rank } : i,
      ),
  );

  /** The cards of a column — or, with lanes and a `laneId`, of one cell. */
  const getColumnIssues = (groupId: string, laneId?: string) =>
    sortByKey(
      // A multi-choice card is in the column (and lane) of every value it has.
      optimisticIssues.filter(
        (i) =>
          groupIdsOf(i, groupKey).includes(groupId) &&
          (!laneKey ||
            laneId === undefined ||
            groupIdsOf(i, laneKey).includes(laneId)),
      ),
      sortKey,
      sortLookups,
    );

  /** One drop target: a column, or a column within a lane. */
  const cellKey = (groupId: string, laneId?: string) =>
    laneId === undefined ? groupId : `${groupId}\u0000${laneId}`;

  const clearDragState = () => {
    dragIssueRef.current = null;
    dragFromRef.current = null;
    dragFromLaneRef.current = null;
    dragOverCardRef.current = null;
    setDragging(null);
    setOverCol(null);
    setDragOverCard(null);
  };

  const onDragStart =
    (issue: T, fromGroupId?: string, fromLaneId?: string) =>
    (e: React.DragEvent) => {
      dragIssueRef.current = issue;
      dragFromRef.current = fromGroupId ?? null;
      dragFromLaneRef.current = fromLaneId ?? null;
      setDragging(issue.id);
      e.dataTransfer.effectAllowed = "move";
    };

  const onCardDragOver = (cardId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const above = e.clientY < rect.top + rect.height / 2;
    dragOverCardRef.current = cardId;
    insertAboveRef.current = above;
    setDragOverCard(cardId);
    setInsertAbove(above);
  };

  // Rank the dropped issue between its new neighbors (or at the column edge)
  const dropRank = (
    groupId: string,
    laneId: string | undefined,
    draggedId: string,
  ) => {
    const colIssues = getColumnIssues(groupId, laneId).filter(
      (i) => i.id !== draggedId,
    );
    const overCardId = dragOverCardRef.current;
    const overIdx = overCardId
      ? colIssues.findIndex((i) => i.id === overCardId)
      : -1;

    if (overIdx === -1)
      return rankBetween(colIssues[colIssues.length - 1] ?? null, null);

    const card = colIssues[overIdx];
    if (insertAboveRef.current)
      return rankBetween(colIssues[overIdx - 1] ?? null, card);
    return rankBetween(card, colIssues[overIdx + 1] ?? null);
  };

  /**
   * Puts `issue` into group `groupId` at `rank` — optimistically, then on the
   * server. Shared by the drop and by "Move to…" (`moveIssue`), so both do
   * exactly the same thing.
   */
  const commitMove = (
    issue: T,
    groupId: string,
    rank: number,
    laneId?: string,
    from: { groupId: string | null; laneId: string | null } = {
      groupId: null,
      laneId: null,
    },
  ) => {
    // Across projects a card stays in its own (V8) — dropped into another
    // project's column (or lane), it goes back.
    if (
      !canMoveBetweenGroups(groupKey) &&
      groupId !== groupIdOf(issue, groupKey)
    )
      return;
    const intoLane = laneKey !== null && laneId !== undefined;
    if (
      intoLane &&
      !canMoveBetweenGroups(laneKey) &&
      laneId !== groupIdOf(issue, laneKey)
    )
      return;
    // Column and lane together: "In Progress" in Lena's lane is status In
    // Progress *and* assigned to Lena. A multi-choice value swaps the one the
    // card was picked up in for the one it lands in (`groupMovePatch`).
    const columnPatch = groupMovePatch(
      issue,
      groupKey,
      from.groupId,
      groupId,
      groupField(groupKey, customFields),
    );
    const lanePatch = intoLane
      ? groupMovePatch(
          issue,
          laneKey,
          from.laneId,
          laneId,
          groupField(laneKey, customFields),
        )
      : {};
    const patch: IssuePatch = {
      ...columnPatch,
      ...lanePatch,
      ...(columnPatch.fieldValues || lanePatch.fieldValues
        ? {
            fieldValues: {
              ...columnPatch.fieldValues,
              ...lanePatch.fieldValues,
            },
          }
        : {}),
    };

    // No `router.refresh()` after the `await` — `reorderIssue` already
    // revalidates server-side (`revalidate()` in actions.ts), and Next
    // folds the freshly rendered RSC payload into the Server Action's own
    // response (see "Choosing a cache update" in Next's server-actions
    // guide). A second, explicit refresh on top of that raced the
    // transition's own settling against this optimistic update's revert —
    // the reproducible trigger behind BARY-25's "Maximum update depth
    // exceeded" on every board drag.
    startTransition(async () => {
      addOptimistic({ id: issue.id, patch, rank });
      // After the await, not before: `recordProjectChange` timestamps
      // itself on the server, which only ever runs *after* this request
      // reaches it — a baseline taken before sending the request is
      // therefore always older than that timestamp, never later, and
      // never actually suppresses anything (BARY-26). Taken here, after
      // the response comes back, it's guaranteed to be at or after the
      // server's own recording of this same action.
      await reorderIssue(issue.id, patch.status ?? issue.status, rank);
      // Every field but the status — from the column's grouping or the
      // lane's — goes through `updateIssue`; `reorderIssue` only knows
      // status and rank.
      const { status: _status, ...rest } = patch;
      const changed = Object.fromEntries(
        Object.entries(rest).filter(
          ([key, value]) => issue[key as keyof Issue] !== value,
        ),
      );
      if (Object.keys(changed).length > 0)
        await updateIssue(issue.id, changed as IssuePatch);
      markLocalMutation();
    });
  };

  /** "Move to…": the end of the target column, in the card's own lane —
   *  no dragging involved. `fromGroupId` is the column the card was in, for
   *  a multi-choice grouping where it sits in several. */
  const moveIssue = (issue: T, groupId: string, fromGroupId?: string) => {
    if (groupIdsOf(issue, groupKey).includes(groupId)) return;
    const laneId = laneKey ? groupIdOf(issue, laneKey) : undefined;
    const colIssues = getColumnIssues(groupId, laneId).filter(
      (i) => i.id !== issue.id,
    );
    commitMove(
      issue,
      groupId,
      rankBetween(colIssues[colIssues.length - 1] ?? null, null),
      laneId,
      { groupId: fromGroupId ?? null, laneId: laneId ?? null },
    );
  };

  const columnHandlers = (groupId: string, laneId?: string) => ({
    isOver: overCol === cellKey(groupId, laneId),
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setOverCol(cellKey(groupId, laneId));
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setOverCol(null);
        setDragOverCard(null);
        dragOverCardRef.current = null;
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const issue = dragIssueRef.current;
      if (!issue) return;

      const rank = dropRank(groupId, laneId, issue.id);
      const from = {
        groupId: dragFromRef.current,
        laneId: dragFromLaneRef.current,
      };
      clearDragState();
      commitMove(issue, groupId, rank, laneId, from);
    },
  });

  return {
    getColumnIssues,
    dragging,
    dragOverCard,
    insertAbove,
    onDragStart,
    onDragEnd: clearDragState,
    onCardDragOver,
    columnHandlers,
    moveIssue,
  };
}
