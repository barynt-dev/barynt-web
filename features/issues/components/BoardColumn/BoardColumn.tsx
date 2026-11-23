"use client";
import { Icon } from "@iconify/react";
import React from "react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Button } from "@/components/ui/atoms/Button/Button";
import { BoardCard } from "@/features/issues/components/BoardCard/BoardCard";
import { CreateIssueModal } from "@/features/issues/components/CreateIssueModal/CreateIssueModal";
import { GroupIcon } from "@/features/issues/components/GroupIcon/GroupIcon";
import { type GroupDef, groupStartPatch } from "@/features/issues/group";
import type { IssueComposerData, IssueLookups } from "@/features/issues/types";
import { useModal } from "@/lib/context";
import { COMPACT_QUERY, useMediaQuery } from "@/lib/utils/useMediaQuery";
import type { IssueDetail } from "@/types";
import styles from "./boardColumn.module.scss";

interface BoardColumnProps {
  group: GroupDef;
  issues: IssueDetail[];
  /** Without a project there is no "New task" — see `Board`. */
  projectId?: string;
  /** The column just passes this through: the card names its project instead. */
  showProject?: boolean;
  lookups: IssueLookups;
  composer: IssueComposerData;
  /** This person's hidden card fields for this board (BARY-33). */
  hiddenCardFields: string[];
  newIssueLabel: string;
  isOver: boolean;
  dragging: string | null;
  dragOverCard: string | null;
  insertAbove: boolean;
  onColumnDragOver: (e: React.DragEvent) => void;
  onColumnDragLeave: (e: React.DragEvent) => void;
  onColumnDrop: (e: React.DragEvent) => void;
  onCardDragStart: (
    issue: IssueDetail,
    fromGroupId: string,
  ) => (e: React.DragEvent) => void;
  onCardDragEnd: () => void;
  /** Pressing a card with a mouse starts dragging it (`pointerDrag.ts`). */
  onCardPointerDown?: (
    issue: IssueDetail,
    fromGroupId: string,
  ) => (e: React.PointerEvent<HTMLElement>) => void;
  onCardDragOver: (cardId: string) => (e: React.DragEvent) => void;
  /** Whether this issue is currently shown in the side panel. */
  isCardActive: (issue: IssueDetail) => boolean;
  /** The keyboard cursor (j/k/arrows) — independent of `isCardActive`. */
  isCardFocused: (issue: IssueDetail) => boolean;
  onCardOpen: (issue: IssueDetail) => void;
  /** Ctrl/Cmd click and middle click on a card: full page in a new tab. */
  onCardOpenInNewTab: (issue: IssueDetail) => void;
  /** All columns of the board, for each card's "Move to…". */
  moveTargets?: GroupDef[];
  onCardMoveTo?: (
    issue: IssueDetail,
    groupId: string,
    fromGroupId: string,
  ) => void;
  /**
   * With swimlanes (BARY-173) a column splits: its `head` sits once above
   * every lane, and each lane draws a `cell` — only the cards of that
   * column in that lane. `column` is the plain board's whole column.
   */
  variant?: "column" | "head" | "cell";
  /** The lane a `cell` belongs to — read off the element by `Board`. */
  laneId?: string;
  /** Own width in pixels (`useColumnWidths`) — the default without one. */
  width?: number;
  /** The handle at the header's right edge that changes the width. */
  resize?: {
    label: string;
    "aria-valuenow": number;
    "aria-valuemin": number;
    "aria-valuemax": number;
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
    onDoubleClick: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
  };
  /** Moving the whole column by a handle in its header (BARY-165). */
  columnDrag?: {
    label: string;
    /** This column is the one being dragged — drawn as a placeholder. */
    dragging: boolean;
    /** Pressing the header starts it (`Board`, `pointerDrag.ts`). */
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  };
}

export function BoardColumn({
  group,
  issues,
  projectId,
  showProject,
  lookups,
  composer,
  hiddenCardFields,
  newIssueLabel,
  isOver,
  dragging,
  dragOverCard,
  insertAbove,
  onColumnDragOver,
  onColumnDragLeave,
  onColumnDrop,
  onCardDragStart,
  onCardDragEnd,
  onCardPointerDown,
  onCardDragOver,
  isCardActive,
  isCardFocused,
  onCardOpen,
  onCardOpenInNewTab,
  moveTargets,
  onCardMoveTo,
  variant = "column",
  width,
  resize,
  laneId,
  columnDrag,
}: BoardColumnProps) {
  const { openModal } = useModal();
  const isDesktop = !useMediaQuery(COMPACT_QUERY);

  // Without `issue.create` in this project there is neither the plus in the
  // column header nor the row at the end of the column. The server has already
  // decided this (`creatableProjectIds`), it's just not rendered here. Without
  // a project the question doesn't even arise — across projects (V8) a
  // column grouped by project names one.
  const createProjectId =
    projectId ?? (group.key === "project" ? group.id : undefined);
  const canCreate =
    createProjectId !== undefined &&
    composer.creatableProjectIds.includes(createProjectId);
  // A new issue starts in the column it's created in — a priority column
  // presets the priority. Without a status column it starts in the
  // workspace's first workflow status, as the composer would.
  const { status, ...initialValues } = groupStartPatch(
    group.key,
    group.id,
    lookups.customFields,
  );
  const initialStatus =
    status ??
    composer.statuses.find((s) => s.isColumn)?.id ??
    composer.statuses[0]?.id ??
    "";

  function showCreateIssueModal() {
    if (createProjectId === undefined) return;
    openModal(({ close }) => (
      <CreateIssueModal
        projectId={createProjectId}
        initialStatus={initialStatus}
        initialValues={initialValues}
        data={composer}
        close={close}
      />
    ));
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop drop zone — no native HTML element represents this
    <div
      className={`${styles.col}${isOver ? ` ${styles.dragOver}` : ""}`}
      data-variant={variant === "column" ? undefined : variant}
      data-column-dragging={columnDrag?.dragging || undefined}
      // Read by `Board` to tell which column the phone's switcher is on and
      // to scroll to one.
      data-group-id={group.id}
      data-lane-id={laneId}
      style={
        width === undefined
          ? undefined
          : ({ "--col-w": `${width}px` } as React.CSSProperties)
      }
      onDragOver={onColumnDragOver}
      onDragLeave={onColumnDragLeave}
      onDrop={onColumnDrop}
    >
      {variant !== "cell" && (
        <div
          className={styles.colHeader}
          // The whole header grabs the column — title, count, anywhere —
          // not just the grip. With a mouse only (a desktop), like the grip
          // before; while dragging, the whole column follows the pointer.
          data-column-grab={(columnDrag && isDesktop) || undefined}
          title={columnDrag && isDesktop ? columnDrag.label : undefined}
          onPointerDown={isDesktop ? columnDrag?.onPointerDown : undefined}
        >
          {columnDrag && (
            // Just the hint that the column can be moved — the header
            // itself is what's dragged.
            <span className={styles.columnHandle} aria-hidden="true">
              <Icon icon="lucide:grip-vertical" width={13} />
            </span>
          )}
          <GroupIcon group={group} size={16} />
          <span className={styles.colTitle}>{group.label}</span>
          <Badge mono>{issues.length}</Badge>
          {canCreate && (
            <Button
              type="button"
              variant="ghost"
              className={`${styles.headerAdd}`}
              title={newIssueLabel}
              onClick={showCreateIssueModal}
              icon={<Icon icon="lucide:plus" width={15} />}
            />
          )}
        </div>
      )}

      {resize && (
        // A focusable separator is the ARIA pattern for a resize handle:
        // drag it, or arrow keys; a double click resets the width.
        // biome-ignore lint/a11y/useSemanticElements: an <hr> can't take focus or pointer drags — a focusable separator is the resize-handle pattern
        <div
          role="separator"
          aria-orientation="vertical"
          tabIndex={0}
          className={styles.resizeHandle}
          title={resize.label}
          aria-label={resize.label}
          aria-valuenow={resize["aria-valuenow"]}
          aria-valuemin={resize["aria-valuemin"]}
          aria-valuemax={resize["aria-valuemax"]}
          onPointerDown={resize.onPointerDown}
          onDoubleClick={resize.onDoubleClick}
          onKeyDown={resize.onKeyDown}
        />
      )}

      {variant !== "head" && (
        // `data-autoscroll`: the list a card held at its edge scrolls.
        <div className={styles.cards} data-autoscroll>
          {issues.map((issue) => {
            const isCardOver =
              dragOverCard === issue.id && dragging !== issue.id;
            return (
              <React.Fragment key={issue.id}>
                {isCardOver && insertAbove && (
                  <div className={styles.dropIndicator} />
                )}
                <BoardCard
                  issue={issue}
                  projectId={projectId}
                  showProject={showProject}
                  lookups={lookups}
                  hiddenCardFields={hiddenCardFields}
                  isDragging={dragging === issue.id}
                  isActive={isCardActive(issue)}
                  isFocused={isCardFocused(issue)}
                  onDragStart={onCardDragStart(issue, group.id)}
                  onDragEnd={onCardDragEnd}
                  onDragPointerDown={onCardPointerDown?.(issue, group.id)}
                  onDragOver={onCardDragOver(issue.id)}
                  onOpen={() => onCardOpen(issue)}
                  onOpenInNewTab={() => onCardOpenInNewTab(issue)}
                  moveTargets={moveTargets}
                  currentGroupId={group.id}
                  onMoveTo={
                    onCardMoveTo &&
                    ((groupId) => onCardMoveTo(issue, groupId, group.id))
                  }
                />
                {isCardOver && !insertAbove && (
                  <div className={styles.dropIndicator} />
                )}
              </React.Fragment>
            );
          })}
          {/* Right after the last card, so it follows the column's content
            instead of floating over the cards. Not in a swimlane cell — a
            row in every cell is a grid of dashed boxes; the column head's
            plus is there (BARY-173). */}
          {canCreate && variant === "column" && (
            <div className={styles.addSlot}>
              <button
                type="button"
                className={styles.addCard}
                title={newIssueLabel}
                onClick={showCreateIssueModal}
              >
                <Icon icon="lucide:plus" width={15} />
                <span>{newIssueLabel}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
