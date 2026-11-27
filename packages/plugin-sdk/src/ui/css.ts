// The UI kit's styles (BARY-204, BARY-206), all from Barynt's design tokens
// (`--barynt-*`), so they follow light and dark like Barynt does. Put into
// the frame once, by the first component used.

export const CSS = `
.bui-stack { display: flex; flex-direction: column; gap: var(--barynt-space-4); min-width: 0; }
.bui-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--barynt-space-2); min-width: 0; }
.bui-grid { display: grid; gap: var(--barynt-space-4); grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--bui-min, 12rem)), 1fr)); }
.bui-divider { width: 100%; height: 1px; margin: 0; border: 0; background: var(--barynt-color-border); }
.bui-card {
  --bui-card-pad: var(--barynt-space-4);
  display: flex; flex-direction: column; gap: var(--barynt-space-3); padding: var(--bui-card-pad);
  border: 1px solid var(--barynt-color-border); border-radius: var(--barynt-radius-lg);
  background: var(--barynt-color-surface-raised); min-width: 0;
}
.bui-card-more { margin: 0 calc(-1 * var(--bui-card-pad)) calc(-1 * var(--bui-card-pad)); border-top: 1px solid var(--barynt-color-border); }
.bui-card-more > summary {
  display: flex; align-items: center; gap: var(--barynt-space-2); padding: var(--barynt-space-2) var(--bui-card-pad);
  list-style: none; cursor: pointer; font-size: var(--barynt-font-size-xs); color: var(--barynt-color-text-subtle);
}
.bui-card-more > summary::-webkit-details-marker { display: none; }
.bui-card-more > summary:hover { color: var(--barynt-color-text); }
.bui-card-more > summary:focus-visible { outline: 2px solid var(--barynt-color-focus); outline-offset: -2px; }
.bui-card-more > summary > .bui-icon { margin-left: auto; transition: rotate var(--barynt-duration-fast); }
.bui-card-more[open] > summary > .bui-icon { rotate: 180deg; }
.bui-card-more-body { display: flex; flex-direction: column; gap: var(--barynt-space-2); padding: 0 var(--bui-card-pad) var(--bui-card-pad); }
.bui-stages { display: grid; grid-auto-columns: 1fr; grid-auto-flow: column; gap: var(--barynt-space-1); margin: 0; padding: 0; list-style: none; }
.bui-stage { --tone: var(--barynt-color-border); display: flex; flex-direction: column; gap: 0.3125rem; min-width: 0; font-size: var(--barynt-font-size-xxs); font-weight: var(--barynt-font-weight-medium); color: var(--barynt-color-text-subtle); }
.bui-stage-bar { height: 4px; border-radius: 2px; background: var(--tone); }
.bui-stage-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bui-stage[data-state="pending"] { opacity: 0.75; }
.bui-stage[data-state="success"] { --tone: var(--barynt-color-success); }
.bui-stage[data-state="running"] { --tone: var(--barynt-color-info); color: var(--tone); font-weight: var(--barynt-font-weight-semibold); }
.bui-stage[data-state="warning"] { --tone: var(--barynt-color-warning); color: var(--tone); font-weight: var(--barynt-font-weight-semibold); }
.bui-stage[data-state="danger"] { --tone: var(--barynt-color-danger); color: var(--tone); font-weight: var(--barynt-font-weight-semibold); }
.bui-label[data-hidden] { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.bui-log { position: relative; overflow: auto; margin: 0; padding: var(--barynt-space-2) 0; border-radius: var(--barynt-radius-md); background: var(--barynt-color-surface-sunken); font-family: var(--barynt-font-family-mono, ui-monospace, monospace); font-size: var(--barynt-font-size-xs); line-height: 1.6; color: var(--barynt-color-text); }
.bui-log:focus-visible { outline: 2px solid var(--barynt-color-focus); outline-offset: 1px; }
.bui-log-line { display: grid; grid-template-columns: 3rem minmax(0, 1fr); }
.bui-log-no { padding-right: var(--barynt-space-2); text-align: right; color: var(--barynt-color-text-subtle); opacity: 0.6; user-select: none; }
.bui-log-text { padding-right: var(--barynt-space-3); white-space: pre-wrap; overflow-wrap: anywhere; }
.bui-log-line[data-heading] .bui-log-text { font-weight: var(--barynt-font-weight-semibold); }
.bui-log-line[data-tone="muted"] .bui-log-text { color: var(--barynt-color-text-subtle); }
.bui-log-line[data-tone="warning"] { background: color-mix(in srgb, var(--barynt-color-warning) 12%, transparent); }
.bui-log-line[data-tone="warning"] .bui-log-text { color: var(--barynt-color-warning); }
.bui-log-line[data-tone="danger"] { background: color-mix(in srgb, var(--barynt-color-danger) 14%, transparent); }
.bui-log-line[data-tone="danger"] .bui-log-text { color: var(--barynt-color-danger); }
.bui-pipeline { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(5.75rem, 1fr); gap: 0.375rem; margin: 0; padding: 0; list-style: none; overflow-x: auto; scrollbar-width: thin; }
.bui-station { --tone: var(--barynt-color-border); position: relative; display: flex; min-width: 0; border: 1px solid var(--barynt-color-border); border-radius: var(--barynt-radius-md); }
.bui-station[data-state="success"] { --tone: var(--barynt-color-success); }
.bui-station[data-state="running"] { --tone: var(--barynt-color-info); }
.bui-station[data-state="warning"] { --tone: var(--barynt-color-warning); }
.bui-station[data-state="danger"] { --tone: var(--barynt-color-danger); }
.bui-station[data-state="pending"] { border-style: dashed; }
.bui-station[data-selected] { border-color: var(--barynt-color-focus); box-shadow: 0 0 0 1px var(--barynt-color-focus); }
.bui-station-main { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: stretch; gap: 0.1875rem; margin: 0; padding: var(--barynt-space-2); border: 0; border-radius: inherit; background: none; color: inherit; font: inherit; text-align: left; }
button.bui-station-main { cursor: pointer; }
button.bui-station-main:hover { background: var(--barynt-color-surface-hovered); }
button.bui-station-main:focus-visible { outline: 2px solid var(--barynt-color-focus); outline-offset: 1px; }
.bui-station-bar { height: 3px; margin-bottom: 0.25rem; border-radius: 2px; background: var(--tone); }
.bui-station[data-state="pending"] .bui-station-bar { opacity: 0.5; }
.bui-station-bar[data-segments] { display: flex; gap: 2px; background: none; }
.bui-station-bar[data-segments] > i { flex: 1; border-radius: 2px; background: var(--barynt-color-border); }
.bui-station-bar > i[data-state="success"] { background: var(--barynt-color-success); }
.bui-station-bar > i[data-state="running"] { background: var(--barynt-color-info); }
.bui-station-bar > i[data-state="warning"] { background: var(--barynt-color-warning); }
.bui-station-bar > i[data-state="danger"] { background: var(--barynt-color-danger); }
.bui-station[data-state="running"] .bui-station-bar:not([data-segments]), .bui-station-bar > i[data-state="running"] { animation: bui-pulse 1.4s ease-in-out infinite; }
@keyframes bui-pulse { 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) { .bui-station-bar, .bui-station-bar > i { animation: none !important; } }
.bui-station-count { flex: none; padding: 0 0.3125rem; border: 1px solid var(--barynt-color-border); border-radius: var(--barynt-radius-pill); font-size: var(--barynt-font-size-xxs); font-weight: var(--barynt-font-weight-medium); color: var(--barynt-color-text-subtle); }
.bui-station-label { display: flex; align-items: center; gap: 0.3125rem; min-width: 0; font-size: var(--barynt-font-size-sm); font-weight: var(--barynt-font-weight-semibold); color: var(--barynt-color-text); }
.bui-station-label > .bui-icon { flex: none; color: var(--barynt-color-text-subtle); }
.bui-station-label > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bui-station-status { display: flex; align-items: center; gap: 0.25rem; font-size: var(--barynt-font-size-xs); font-weight: var(--barynt-font-weight-medium); color: var(--tone); }
.bui-station[data-state="pending"] .bui-station-status { color: var(--barynt-color-text-subtle); }
.bui-station-meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--barynt-font-size-xxs); color: var(--barynt-color-text-subtle); }
.bui-station:has(.bui-station-link) :is(.bui-station-status, .bui-station-meta) { padding-right: 1.25rem; }
.bui-station > .bui-station-link { position: absolute; bottom: 0.3125rem; right: 0.3125rem; display: inline-flex; padding: 0.1875rem; border-radius: var(--barynt-radius-sm); color: var(--barynt-color-text-subtle); }
.bui-station-link:hover { color: var(--barynt-color-text); background: var(--barynt-color-surface-hovered); }
.bui-station-link:focus-visible { outline: 2px solid var(--barynt-color-focus); outline-offset: 1px; }
.bui-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--barynt-space-3); }
/* Its actions stay on one line beside the title; the title wraps instead. */
.bui-card-head > .bui-row { flex: none; flex-wrap: nowrap; }
.bui-card-head > div:first-child { min-width: 0; }
.bui-card-title { margin: 0; font-size: var(--barynt-font-size-base); font-weight: var(--barynt-font-weight-semibold); }
.bui-card-desc { margin: var(--barynt-space-1) 0 0; color: var(--barynt-color-text-subtle); font-size: var(--barynt-font-size-sm); }

.bui-heading { margin: 0; color: var(--barynt-color-text); font-weight: var(--barynt-font-weight-semibold); line-height: var(--barynt-line-height-tight); }
.bui-heading[data-level="1"] { font-size: var(--barynt-font-size-2xl); font-weight: var(--barynt-font-weight-bold); }
.bui-heading[data-level="2"] { font-size: var(--barynt-font-size-xl); }
.bui-heading[data-level="3"] { font-size: var(--barynt-font-size-lg); }
.bui-heading[data-level="4"] { font-size: var(--barynt-font-size-base); }
.bui-text { margin: 0; color: var(--barynt-color-text); font-size: var(--barynt-font-size-sm); }
.bui-text[data-size="xs"] { font-size: var(--barynt-font-size-xs); }
.bui-text[data-size="base"] { font-size: var(--barynt-font-size-base); }
.bui-text[data-size="lg"] { font-size: var(--barynt-font-size-lg); }
.bui-text[data-weight="medium"] { font-weight: var(--barynt-font-weight-medium); }
.bui-text[data-weight="semibold"] { font-weight: var(--barynt-font-weight-semibold); }
.bui-text[data-weight="bold"] { font-weight: var(--barynt-font-weight-bold); }
.bui-text[data-mono] { font-family: var(--barynt-font-family-mono); }
.bui-text[data-tone="subtle"] { color: var(--barynt-color-text-subtle); }
.bui-text[data-tone="primary"] { color: var(--barynt-color-primary); }
.bui-text[data-tone="success"] { color: var(--barynt-color-success); }
.bui-text[data-tone="warning"] { color: var(--barynt-color-warning); }
.bui-text[data-tone="danger"] { color: var(--barynt-color-danger); }
.bui-link { color: var(--barynt-color-primary); text-decoration: none; display: inline-flex; align-items: center; gap: 0.25em; }
.bui-link:hover { text-decoration: underline; }

.bui-icon { flex: none; display: inline-block; vertical-align: -0.15em; }

.bui-field { display: flex; flex-direction: column; gap: 0.375rem; min-width: 0; margin: 0; padding: 0; border: 0; }
.bui-label { font-size: var(--barynt-font-size-sm); font-weight: var(--barynt-font-weight-semibold); color: var(--barynt-color-text); padding: 0; }
.bui-hint { font-size: var(--barynt-font-size-xs); color: var(--barynt-color-text-subtle); }
.bui-input, .bui-textarea, .bui-select {
  box-sizing: border-box; width: 100%; min-height: var(--barynt-size-control); padding: 0 0.6875rem;
  color: var(--barynt-color-text); background: var(--barynt-color-surface-sunken);
  border: 1px solid var(--barynt-color-border); border-radius: var(--barynt-radius-sm);
  font: inherit; font-size: var(--barynt-font-size-base); outline: none;
  transition: border-color var(--barynt-duration-fast);
}
.bui-textarea { min-height: 6rem; padding: 0.5rem 0.6875rem; resize: vertical; }
.bui-input:focus, .bui-textarea:focus, .bui-select:focus { border-color: var(--barynt-color-focus); }
.bui-input::placeholder, .bui-textarea::placeholder { color: var(--barynt-color-text-subtle); }
:is(.bui-input, .bui-textarea, .bui-select, .bui-button, .bui-toggle, .bui-chip-toggle, .bui-segment):disabled { opacity: var(--barynt-opacity-disabled); cursor: default; }

.bui-switch { display: flex; align-items: center; justify-content: space-between; gap: var(--barynt-space-4); }
.bui-switch-text { display: flex; flex-direction: column; gap: var(--barynt-space-1); }
.bui-toggle {
  position: relative; flex: none; width: 2.5rem; height: 1.5rem; padding: 0;
  background: var(--barynt-color-surface-hovered); border: 1px solid var(--barynt-color-border-strong);
  border-radius: var(--barynt-radius-pill); cursor: pointer; transition: background var(--barynt-duration-normal);
}
.bui-toggle::after {
  content: ""; position: absolute; top: 50%; left: 0.1875rem; width: 1rem; height: 1rem;
  border-radius: 50%; background: var(--barynt-color-text-subtle);
  transform: translateY(-50%); transition: transform var(--barynt-duration-normal), background var(--barynt-duration-normal);
}
.bui-toggle[aria-checked="true"] { background: var(--barynt-color-primary); border-color: var(--barynt-color-primary); }
.bui-toggle[aria-checked="true"]::after { background: var(--barynt-color-primary-text); transform: translate(1rem, -50%); }

.bui-check { display: flex; align-items: flex-start; gap: var(--barynt-space-2); cursor: pointer; font-size: var(--barynt-font-size-base); }
.bui-check input { width: 1rem; height: 1rem; margin: 0.15rem 0 0; accent-color: var(--barynt-color-primary); flex: none; }
.bui-check-text { display: flex; flex-direction: column; gap: 0.125rem; }
.bui-options { display: flex; flex-direction: column; gap: var(--barynt-space-2); }

.bui-segments { display: inline-flex; flex-wrap: wrap; gap: 2px; padding: 2px; border: 1px solid var(--barynt-color-border); border-radius: var(--barynt-radius-md); background: var(--barynt-color-surface-sunken); max-width: 100%; }
.bui-segment {
  min-height: calc(var(--barynt-size-control) - 6px); padding: 0 var(--barynt-space-3); border: 0; border-radius: var(--barynt-radius-sm);
  background: none; color: var(--barynt-color-text-subtle); font: inherit; font-size: var(--barynt-font-size-sm); cursor: pointer;
}
.bui-segment[aria-checked="true"] { background: var(--barynt-color-surface-hovered); color: var(--barynt-color-text); font-weight: var(--barynt-font-weight-semibold); }

.bui-chips { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.bui-chip-toggle {
  display: inline-flex; align-items: center; gap: 0.375rem; min-height: 2rem; padding: 0 0.75rem;
  color: var(--barynt-color-text-subtle); background: var(--barynt-color-surface-sunken);
  border: 1px solid var(--barynt-color-border); border-radius: var(--barynt-radius-pill);
  font: inherit; font-size: var(--barynt-font-size-sm); cursor: pointer;
}
.bui-chip-toggle > .bui-icon { display: none; }
.bui-chip-toggle[aria-pressed="true"] { color: var(--barynt-color-primary-subtle-text); background: var(--barynt-color-primary-subtle); border-color: transparent; }
.bui-chip-toggle[aria-pressed="true"] > .bui-icon { display: inline-block; }

.bui-swatches { display: flex; flex-wrap: wrap; gap: var(--barynt-space-2); }
.bui-swatch {
  width: 1.75rem; height: 1.75rem; padding: 0; border-radius: 50%; border: 2px solid transparent;
  background: var(--swatch); cursor: pointer; box-shadow: inset 0 0 0 2px var(--barynt-color-surface);
}
.bui-swatch[aria-checked="true"] { border-color: var(--barynt-color-text); }

.bui-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem;
  min-height: var(--barynt-size-control); padding: 0 0.875rem; border-radius: var(--barynt-radius-sm);
  border: 1px solid transparent; font: inherit; font-size: var(--barynt-font-size-sm); font-weight: var(--barynt-font-weight-semibold);
  cursor: pointer; transition: filter var(--barynt-duration-fast), background var(--barynt-duration-fast);
}
.bui-button[data-size="sm"] { min-height: var(--barynt-size-control-sm); padding: 0 0.625rem; font-size: var(--barynt-font-size-xs); }
.bui-button[data-variant="primary"] { color: var(--barynt-color-primary-text); background: var(--barynt-color-primary); }
.bui-button[data-variant="secondary"] { color: var(--barynt-color-text); background: var(--barynt-color-surface-hovered); border-color: var(--barynt-color-border); }
.bui-button[data-variant="ghost"] { color: var(--barynt-color-text-subtle); background: none; }
.bui-button[data-variant="danger"] { color: var(--barynt-color-danger); background: none; border-color: var(--barynt-color-border); }
.bui-button:hover:not(:disabled) { filter: brightness(1.08); }
.bui-button[data-variant="ghost"]:hover:not(:disabled) { background: var(--barynt-color-surface-hovered); filter: none; }
.bui-button[aria-busy="true"] { cursor: progress; }
.bui-button[data-icon-only] { padding: 0; width: var(--barynt-size-control); }
.bui-button[data-icon-only][data-size="sm"] { width: var(--barynt-size-control-sm); }

:is(.bui-input, .bui-button, .bui-toggle, .bui-select, .bui-segment, .bui-chip-toggle, .bui-swatch, .bui-tab, .bui-link, .bui-tag-remove, .bui-list-remove, .bui-pick-option, .bui-accordion summary):focus-visible {
  outline: 2px solid var(--barynt-color-focus); outline-offset: 2px;
}

.bui-status { margin: 0; min-height: 1.25rem; font-size: var(--barynt-font-size-sm); color: var(--barynt-color-text-subtle); }
.bui-status[data-tone="success"] { color: var(--barynt-color-success); }
.bui-status[data-tone="error"] { color: var(--barynt-color-danger); }
.bui-status[data-tone="warning"] { color: var(--barynt-color-warning); }
.bui-status:empty { display: none; }

.bui-badge, .bui-tag {
  display: inline-flex; align-items: center; gap: 0.25rem; max-width: 100%; min-height: 1.375rem; padding: 0 0.5rem;
  border-radius: var(--barynt-radius-pill); font-size: var(--barynt-font-size-xs); font-weight: var(--barynt-font-weight-semibold);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: var(--barynt-color-text); background: var(--barynt-color-surface-hovered);
}
.bui-badge[data-tone="primary"] { color: var(--barynt-color-primary-subtle-text); background: var(--barynt-color-primary-subtle); }
.bui-badge[data-tone="info"] { color: var(--barynt-color-info); background: color-mix(in srgb, var(--barynt-color-info) 16%, transparent); }
.bui-badge[data-tone="success"] { color: var(--barynt-color-success); background: color-mix(in srgb, var(--barynt-color-success) 16%, transparent); }
.bui-badge[data-tone="warning"] { color: var(--barynt-color-warning); background: color-mix(in srgb, var(--barynt-color-warning) 16%, transparent); }
.bui-badge[data-tone="danger"] { color: var(--barynt-color-danger); background: color-mix(in srgb, var(--barynt-color-danger) 16%, transparent); }
.bui-tag { --tag: var(--barynt-color-text-subtle); color: var(--barynt-color-text); background: color-mix(in srgb, var(--tag) 18%, transparent); font-weight: var(--barynt-font-weight-medium); }
.bui-tag[data-label]::before { content: ""; width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--tag); flex: none; }
.bui-tag-remove { display: inline-grid; place-items: center; width: 1rem; height: 1rem; margin-right: -0.25rem; padding: 0; border: 0; border-radius: 50%; background: none; color: inherit; cursor: pointer; }
.bui-tag-remove:hover { background: color-mix(in srgb, var(--barynt-color-text) 12%, transparent); }

.bui-avatar {
  --av: var(--barynt-color-indigo); display: inline-grid; place-items: center; flex: none;
  width: 1.75rem; height: 1.75rem; border-radius: 50%; color: #fff; background: var(--av);
  font-size: 0.6875rem; font-weight: var(--barynt-font-weight-bold); letter-spacing: 0.02em; user-select: none;
}
.bui-avatar[data-size="sm"] { width: 1.375rem; height: 1.375rem; font-size: 0.5625rem; }
.bui-avatar[data-size="lg"] { width: 2.5rem; height: 2.5rem; font-size: var(--barynt-font-size-sm); }
.bui-note { display: flex; flex-direction: column; gap: 0.375rem; min-width: 0; padding: var(--barynt-space-2) 0.625rem; border-radius: var(--barynt-radius-md); background: var(--barynt-color-surface-sunken); }
/* Short of room the verdict moves under the name, rather than cutting it. */
.bui-note-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.375rem 0.5rem; min-width: 0; font-size: var(--barynt-font-size-sm); }
.bui-note-who { display: inline-flex; align-items: center; gap: 0.4375rem; min-width: 0; max-width: 100%; }
.bui-note-who > .bui-avatar { flex: none; }
.bui-note-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: var(--barynt-font-weight-semibold); }
.bui-note-tag { flex: none; padding: 0 0.3125rem; border: 1px solid var(--barynt-color-border); border-radius: var(--barynt-radius-sm); font-size: var(--barynt-font-size-xxs); font-weight: var(--barynt-font-weight-semibold); line-height: 1rem; color: var(--barynt-color-text-subtle); text-transform: uppercase; letter-spacing: 0.02em; }
.bui-note-head > .bui-badge { flex: none; }
.bui-note-text {
  display: flex; align-items: baseline; gap: 0.375rem; min-width: 0; padding: 0; border: 0; background: none; cursor: pointer;
  font: inherit; font-size: var(--barynt-font-size-xs); color: var(--barynt-color-text-subtle); text-align: left;
}
.bui-note-text > .bui-icon { flex: none; position: relative; top: 0.125rem; }
.bui-note-text > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bui-note-text[aria-expanded="true"] > span { white-space: pre-wrap; overflow-wrap: anywhere; color: var(--barynt-color-text); }
.bui-note-text:focus-visible { outline: 2px solid var(--barynt-color-focus); outline-offset: 2px; border-radius: var(--barynt-radius-sm); }
.bui-user { display: inline-flex; align-items: center; gap: var(--barynt-space-2); min-width: 0; }
.bui-user-text { display: flex; flex-direction: column; min-width: 0; }
.bui-user-name { font-size: var(--barynt-font-size-sm); font-weight: var(--barynt-font-weight-medium); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bui-user-meta { font-size: var(--barynt-font-size-xs); color: var(--barynt-color-text-subtle); }

.bui-dot { display: inline-flex; align-items: center; gap: 0.375rem; font-size: var(--barynt-font-size-sm); }
.bui-dot::before { content: ""; width: 0.625rem; height: 0.625rem; border-radius: 50%; flex: none; border: 2px solid var(--dot); background: var(--dot-fill, transparent); }
.bui-dot[data-category="backlog"] { --dot: var(--barynt-color-text-subtle); }
.bui-dot[data-category="unstarted"] { --dot: var(--barynt-color-border-strong); }
.bui-dot[data-category="started"] { --dot: var(--barynt-color-amber); --dot-fill: color-mix(in srgb, var(--barynt-color-amber) 45%, transparent); }
.bui-dot[data-category="completed"] { --dot: var(--barynt-color-success); --dot-fill: var(--barynt-color-success); }
.bui-dot[data-category="canceled"] { --dot: var(--barynt-color-text-subtle); --dot-fill: var(--barynt-color-text-subtle); }

.bui-spinner { display: inline-flex; align-items: center; gap: var(--barynt-space-2); color: var(--barynt-color-text-subtle); font-size: var(--barynt-font-size-sm); }
.bui-spinner .bui-icon { animation: bui-spin 0.8s linear infinite; }
@keyframes bui-spin { to { transform: rotate(360deg); } }
.bui-skeleton { display: flex; flex-direction: column; gap: var(--barynt-space-2); }
.bui-skeleton > span { height: 0.75rem; border-radius: var(--barynt-radius-sm); background: var(--barynt-color-surface-hovered); animation: bui-pulse 1.4s ease-in-out infinite; }
.bui-skeleton > span:last-child { width: 60%; }
@keyframes bui-pulse { 50% { opacity: 0.5; } }
@media (prefers-reduced-motion: reduce) { .bui-spinner .bui-icon, .bui-skeleton > span { animation: none; } }

.bui-empty-state { display: flex; flex-direction: column; align-items: center; gap: var(--barynt-space-2); padding: var(--barynt-space-8) var(--barynt-space-4); text-align: center; color: var(--barynt-color-text-subtle); }
.bui-empty-state > .bui-icon { color: var(--barynt-color-text-subtle); opacity: 0.8; }
.bui-empty-state strong { color: var(--barynt-color-text); font-size: var(--barynt-font-size-base); }
.bui-empty { padding: var(--barynt-space-4) 0; text-align: center; font-size: var(--barynt-font-size-sm); color: var(--barynt-color-text-subtle); }

.bui-notice {
  --tone: var(--barynt-color-info); display: flex; gap: var(--barynt-space-3); padding: var(--barynt-space-3) var(--barynt-space-4);
  border-radius: var(--barynt-radius-md); border: 1px solid color-mix(in srgb, var(--tone) 35%, transparent);
  background: color-mix(in srgb, var(--tone) 10%, transparent); font-size: var(--barynt-font-size-sm);
}
.bui-notice > .bui-icon { color: var(--tone); margin-top: 0.1rem; }
.bui-notice[data-tone="success"] { --tone: var(--barynt-color-success); }
.bui-notice[data-tone="warning"] { --tone: var(--barynt-color-warning); }
.bui-notice[data-tone="danger"] { --tone: var(--barynt-color-danger); }
.bui-notice[data-tone="neutral"] { --tone: var(--barynt-color-text-subtle); }
.bui-notice-body { display: flex; flex-direction: column; gap: var(--barynt-space-1); min-width: 0; }
.bui-notice-body strong { font-weight: var(--barynt-font-weight-semibold); }
.bui-notice[data-compact] { align-items: center; gap: var(--barynt-space-2); padding: var(--barynt-space-2) 0.625rem; border-color: transparent; color: var(--tone); }
.bui-notice[data-compact] > .bui-icon { margin-top: 0; }
/* Narrow, its words wrap in their own column; the action stays beside them. */
.bui-notice[data-compact] .bui-notice-body { flex: 1; flex-direction: row; align-items: center; gap: var(--barynt-space-2); }
.bui-notice[data-compact] .bui-notice-body > span { flex: 1; min-width: 0; }
.bui-notice[data-compact] .bui-notice-body > :last-child:not(span) { flex: none; color: inherit; font-weight: var(--barynt-font-weight-semibold); font-size: var(--barynt-font-size-xs); }

.bui-pick { position: relative; display: inline-flex; max-width: 100%; }
.bui-pick-panel {
  position: absolute; z-index: 5; top: calc(100% + 0.375rem); left: 0; display: flex; flex-direction: column; gap: 0.375rem;
  box-sizing: border-box; width: min(26rem, calc(100vw - 2rem)); padding: 0.375rem;
  border: 1px solid var(--barynt-color-border); border-radius: var(--barynt-radius-md);
  background: var(--barynt-color-surface-raised); box-shadow: var(--barynt-shadow-overlay);
}
.bui-pick-panel[hidden] { display: none; }
.bui-pick-search { min-height: var(--barynt-size-control-sm); font-size: var(--barynt-font-size-sm); }
.bui-pick-list { display: flex; flex-direction: column; max-height: 16rem; margin: 0; padding: 0; overflow-y: auto; list-style: none; }
.bui-pick-option {
  display: flex; align-items: center; gap: 0.625rem; min-height: 2.25rem; padding: 0.25rem 0.5rem;
  border-radius: var(--barynt-radius-sm); color: var(--barynt-color-text); font-size: var(--barynt-font-size-sm); cursor: pointer;
}
.bui-pick-option[aria-selected="true"] { background: var(--barynt-color-surface-hovered); }
.bui-pick-text { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.bui-pick-label, .bui-pick-hint { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bui-pick-hint { color: var(--barynt-color-text-subtle); font-size: var(--barynt-font-size-xs); }
.bui-pick-aside { display: inline-flex; flex: none; gap: 0.25rem; }
.bui-pick-empty { padding: 0.75rem 0.5rem; color: var(--barynt-color-text-subtle); font-size: var(--barynt-font-size-sm); }
@media (pointer: coarse) { .bui-pick-option { min-height: 2.75rem; } }

.bui-toasts { position: fixed; z-index: 10; right: var(--barynt-space-4); bottom: var(--barynt-space-4); display: flex; flex-direction: column; gap: var(--barynt-space-2); max-width: min(22rem, calc(100% - 2rem)); }
.bui-toast {
  display: flex; align-items: center; gap: var(--barynt-space-2); padding: var(--barynt-space-3) var(--barynt-space-4);
  border-radius: var(--barynt-radius-md); background: var(--barynt-color-surface-pressed); color: var(--barynt-color-text);
  box-shadow: var(--barynt-shadow-overlay); font-size: var(--barynt-font-size-sm);
}
.bui-toast[data-tone="success"] > .bui-icon { color: var(--barynt-color-success); }
.bui-toast[data-tone="danger"] > .bui-icon { color: var(--barynt-color-danger); }
.bui-toast[data-tone="warning"] > .bui-icon { color: var(--barynt-color-warning); }

[data-bui-tip] { position: relative; }
[data-bui-tip][data-bui-tip-align="end"]:is(:hover, :focus-visible)::after { left: auto; right: 0; transform: none; }
[data-bui-tip][data-bui-tip-align="start"]:is(:hover, :focus-visible)::after { left: 0; transform: none; }
[data-bui-tip][data-bui-tip-side="below"]:is(:hover, :focus-visible)::after { top: calc(100% + 6px); bottom: auto; }
/* The tip exists only while it shows: a hidden one past the frame's edge
   would still let the frame scroll sideways. */
[data-bui-tip]:is(:hover, :focus-visible)::after {
  content: attr(data-bui-tip); position: absolute; z-index: 5; left: 50%; bottom: calc(100% + 6px); transform: translateX(-50%);
  width: max-content; max-width: 16rem; padding: 0.3125rem 0.5rem; border-radius: var(--barynt-radius-sm);
  background: var(--barynt-color-surface-pressed); color: var(--barynt-color-text); box-shadow: var(--barynt-shadow-overlay);
  font-size: var(--barynt-font-size-xs); font-weight: var(--barynt-font-weight-medium); line-height: var(--barynt-line-height-tight);
  white-space: normal; pointer-events: none;
}
.bui-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

.bui-progress { display: flex; flex-direction: column; gap: 0.375rem; }
.bui-progress-head { display: flex; justify-content: space-between; font-size: var(--barynt-font-size-sm); color: var(--barynt-color-text-subtle); }
.bui-progress-track { height: 0.5rem; border-radius: var(--barynt-radius-pill); background: var(--barynt-color-surface-hovered); overflow: hidden; }
.bui-progress-fill { height: 100%; border-radius: inherit; background: var(--tone, var(--barynt-color-primary)); transition: width var(--barynt-duration-normal); }

.bui-kpi { display: flex; flex-direction: column; gap: var(--barynt-space-1); }
.bui-kpi-value { font-size: 2.5rem; font-weight: 650; line-height: 1; letter-spacing: -0.02em; color: var(--barynt-color-text); font-variant-numeric: tabular-nums; }
.bui-kpi-label { font-size: var(--barynt-font-size-sm); color: var(--barynt-color-text-subtle); }
.bui-kpi-trend { font-size: var(--barynt-font-size-xs); color: var(--barynt-color-text-subtle); }
.bui-kpi-trend[data-good="true"] { color: var(--barynt-color-success); }
.bui-kpi-trend[data-good="false"] { color: var(--barynt-color-danger); }
.bui-list { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.bui-list-item { display: flex; align-items: baseline; gap: 0.625rem; min-width: 0; padding: 0.4375rem 0; border-bottom: 1px solid var(--barynt-color-border); font-size: var(--barynt-font-size-sm); }
.bui-list-item:last-child { border-bottom: none; }
.bui-list-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--barynt-color-text); }
a.bui-list-title { text-decoration: none; }
a.bui-list-title:hover { text-decoration: underline; }
.bui-list-meta { flex: none; font-size: var(--barynt-font-size-xs); color: var(--barynt-color-text-subtle); }
.bui-list-item:has(.bui-list-remove, .bui-list-aside, .bui-list-icon) { align-items: center; }
.bui-list-icon { display: inline-flex; flex: none; color: var(--barynt-color-text-subtle); }
.bui-list-lead { display: inline-flex; flex: none; align-items: baseline; gap: 0.375rem; }
/* A row with a link opens it wherever it's clicked; its buttons stay its own. */
.bui-list-item:has(> a.bui-list-title) { position: relative; }
a.bui-list-title::after { content: ""; position: absolute; inset: 0; }
:is(.bui-list-aside, .bui-list-remove) { position: relative; z-index: 1; }
.bui-list-aside { display: inline-flex; flex: none; flex-wrap: wrap; justify-content: flex-end; gap: 0.25rem; }
.bui-list-remove {
  display: grid; place-items: center; flex: none; width: 1.75rem; height: 1.75rem; padding: 0; border: none;
  border-radius: var(--barynt-radius-sm); background: none; color: var(--barynt-color-text-subtle); cursor: pointer;
}
.bui-list-remove:hover { color: var(--barynt-color-danger); background: color-mix(in srgb, var(--barynt-color-danger) 12%, transparent); }
.bui-bars { display: flex; flex-direction: column; gap: var(--barynt-space-2); }
.bui-bar { display: grid; grid-template-columns: minmax(0, 7rem) 1fr auto; align-items: center; gap: 0.625rem; font-size: var(--barynt-font-size-sm); }
.bui-bar-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--barynt-color-text-subtle); }
.bui-bar-track { height: 0.5rem; border-radius: var(--barynt-radius-pill); background: var(--barynt-color-surface-hovered); overflow: hidden; }
.bui-bar-fill { display: block; height: 100%; border-radius: inherit; background: var(--bar, var(--barynt-color-primary)); }
.bui-bar-value { font-variant-numeric: tabular-nums; color: var(--barynt-color-text); }
.bui-ring { display: inline-flex; align-items: center; gap: var(--barynt-space-3); }
.bui-ring svg { flex: none; }
.bui-ring-track { stroke: var(--barynt-color-surface-hovered); }
.bui-ring-fill { stroke: var(--barynt-color-primary); transition: stroke-dashoffset 0.3s; }
.bui-ring-value { font-size: var(--barynt-font-size-2xl); font-weight: 650; color: var(--barynt-color-text); }
.bui-ring-label { font-size: var(--barynt-font-size-sm); color: var(--barynt-color-text-subtle); }

.bui-table-wrap { overflow-x: auto; border: 1px solid var(--barynt-color-border); border-radius: var(--barynt-radius-md); }
.bui-table { width: 100%; border-collapse: collapse; font-size: var(--barynt-font-size-sm); }
.bui-table caption { padding: var(--barynt-space-2) var(--barynt-space-3); text-align: start; font-weight: var(--barynt-font-weight-semibold); }
.bui-table th, .bui-table td { padding: 0.5rem 0.75rem; text-align: start; border-bottom: 1px solid var(--barynt-color-border); vertical-align: middle; }
.bui-table th { color: var(--barynt-color-text-subtle); font-size: var(--barynt-font-size-xs); font-weight: var(--barynt-font-weight-semibold); background: var(--barynt-color-surface-raised); white-space: nowrap; }
.bui-table tr:last-child td { border-bottom: 0; }
.bui-table tbody tr:hover td { background: var(--barynt-color-surface-raised); }
.bui-table [data-align="end"] { text-align: end; font-variant-numeric: tabular-nums; }
.bui-kv { display: grid; grid-template-columns: max-content 1fr; gap: var(--barynt-space-2) var(--barynt-space-4); margin: 0; font-size: var(--barynt-font-size-sm); }
.bui-kv dt { color: var(--barynt-color-text-subtle); }
.bui-kv dd { margin: 0; min-width: 0; }

.bui-tabs { display: flex; flex-direction: column; gap: var(--barynt-space-3); min-width: 0; }
.bui-tablist { display: flex; gap: var(--barynt-space-1); border-bottom: 1px solid var(--barynt-color-border); overflow-x: auto; }
.bui-tab {
  position: relative; padding: 0.5rem 0.75rem; border: 0; background: none; color: var(--barynt-color-text-subtle);
  font: inherit; font-size: var(--barynt-font-size-sm); font-weight: var(--barynt-font-weight-medium); cursor: pointer; white-space: nowrap;
}
.bui-tab[aria-selected="true"] { color: var(--barynt-color-text); }
.bui-tab[aria-selected="true"]::after { content: ""; position: absolute; left: 0.5rem; right: 0.5rem; bottom: -1px; height: 2px; border-radius: 2px; background: var(--barynt-color-primary); }
.bui-accordion { display: flex; flex-direction: column; border: 1px solid var(--barynt-color-border); border-radius: var(--barynt-radius-md); }
.bui-accordion details + details { border-top: 1px solid var(--barynt-color-border); }
.bui-accordion summary { display: flex; align-items: center; gap: var(--barynt-space-2); padding: 0.625rem 0.875rem; cursor: pointer; list-style: none; font-size: var(--barynt-font-size-sm); font-weight: var(--barynt-font-weight-semibold); }
.bui-accordion summary::-webkit-details-marker { display: none; }
.bui-accordion summary > .bui-icon { transition: transform var(--barynt-duration-fast); color: var(--barynt-color-text-subtle); }
.bui-accordion details[open] summary > .bui-icon { transform: rotate(90deg); }
.bui-accordion-body { padding: 0 0.875rem 0.875rem; font-size: var(--barynt-font-size-sm); }

.bui-dialog {
  width: min(28rem, calc(100% - 2rem)); padding: 0; border: 1px solid var(--barynt-color-border); border-radius: var(--barynt-radius-lg);
  background: var(--barynt-color-surface-overlay); color: var(--barynt-color-text); box-shadow: var(--barynt-shadow-overlay);
}
.bui-dialog::backdrop { background: color-mix(in srgb, var(--barynt-color-scrim) 55%, transparent); }
.bui-dialog-head { display: flex; align-items: center; justify-content: space-between; gap: var(--barynt-space-3); padding: var(--barynt-space-4) var(--barynt-space-4) 0; }
.bui-dialog-title { margin: 0; font-size: var(--barynt-font-size-base); font-weight: var(--barynt-font-weight-semibold); }
.bui-dialog-body { padding: var(--barynt-space-3) var(--barynt-space-4); font-size: var(--barynt-font-size-sm); color: var(--barynt-color-text-subtle); }
.bui-dialog-foot { display: flex; justify-content: flex-end; gap: var(--barynt-space-2); padding: 0 var(--barynt-space-4) var(--barynt-space-4); }

.bui-card[data-compact] { --bui-card-pad: var(--barynt-space-3); padding: var(--bui-card-pad); gap: var(--barynt-space-2); border-radius: var(--barynt-radius-md); }
.bui-card[data-tone] { border-color: color-mix(in srgb, var(--tone) 55%, transparent); }
.bui-card[data-tone="primary"] { --tone: var(--barynt-color-primary); }
.bui-card[data-tone="info"] { --tone: var(--barynt-color-info); }
.bui-card[data-tone="success"] { --tone: var(--barynt-color-success); }
.bui-card[data-tone="warning"] { --tone: var(--barynt-color-warning); }
.bui-card[data-tone="danger"] { --tone: var(--barynt-color-danger); }

.bui-section-head { display: flex; align-items: center; gap: var(--barynt-space-2); min-width: 0; font-size: var(--barynt-font-size-base); }
.bui-section-head > .bui-icon { color: var(--barynt-color-success); }
.bui-section-head[data-size="sm"] { gap: var(--barynt-space-1); font-size: var(--barynt-font-size-sm); }
.bui-section-head[data-size="sm"] > .bui-icon { color: var(--barynt-color-text-subtle); }
.bui-section-head[data-size="sm"] .bui-section-title { font-weight: var(--barynt-font-weight-medium); color: var(--barynt-color-text-subtle); }
.bui-section-title { flex: 1; min-width: 0; font-weight: var(--barynt-font-weight-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bui-fold > .bui-section-head { list-style: none; cursor: pointer; user-select: none; border-radius: var(--barynt-radius-sm); }
.bui-fold > .bui-section-head::-webkit-details-marker { display: none; }
.bui-fold > .bui-section-head:focus-visible { outline: 2px solid var(--barynt-color-primary); outline-offset: 2px; }
.bui-fold-chevron { flex: none; color: var(--barynt-color-text-subtle); transition: rotate 0.15s ease; }
.bui-fold:not([open]) .bui-fold-chevron { rotate: -90deg; }
.bui-fold-body { display: flex; flex-direction: column; gap: var(--barynt-space-2); padding-top: var(--barynt-space-2); }
@media (prefers-reduced-motion: reduce) { .bui-fold-chevron { transition: none; } }
.bui-section-meta { color: var(--barynt-color-text-subtle); font-family: var(--barynt-font-family-mono); font-size: var(--barynt-font-size-sm); }
.bui-section-status { font-size: var(--barynt-font-size-sm); font-weight: var(--barynt-font-weight-semibold); color: var(--barynt-color-text-subtle); }
.bui-section-status[data-tone="primary"] { color: var(--barynt-color-primary); }
.bui-section-status[data-tone="info"] { color: var(--barynt-color-info); }
.bui-section-status[data-tone="success"] { color: var(--barynt-color-success); }
.bui-section-status[data-tone="warning"] { color: var(--barynt-color-warning); }
.bui-section-status[data-tone="danger"] { color: var(--barynt-color-danger); }

.bui-copy {
  position: relative; display: flex; align-items: center; gap: var(--barynt-space-1); min-width: 0; min-height: var(--barynt-size-control);
  padding: 0 var(--barynt-space-1) 0 0; border-radius: var(--barynt-radius-md);
  /* A tint, not a surface: it shows on whatever it sits on — a page, a
     card, the issue's sidebar (which is the raised surface itself). */
  background: color-mix(in srgb, var(--barynt-color-text) 6%, transparent); color: var(--barynt-color-text-subtle);
}
.bui-copy-value {
  display: flex; flex: 1; align-items: center; gap: var(--barynt-space-2); min-width: 0; min-height: var(--barynt-size-control);
  padding: 0 var(--barynt-space-1) 0 var(--barynt-space-3); border: 0; border-radius: var(--barynt-radius-md);
  background: none; color: inherit; font: inherit; text-align: start; cursor: copy;
}
.bui-copy-value:hover .bui-copy-text { color: var(--barynt-color-primary); }
.bui-copy-value:focus-visible { outline: 2px solid var(--barynt-color-focus); outline-offset: -2px; }
.bui-copy-value > .bui-icon { flex: none; }
.bui-copy-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--barynt-font-family-mono); font-size: var(--barynt-font-size-sm); color: var(--barynt-color-text); }
.bui-menu {
  position: absolute; z-index: 6; top: calc(100% + 4px); right: 0; display: flex; flex-direction: column; min-width: 10rem; padding: var(--barynt-space-1);
  border-radius: var(--barynt-radius-md); background: var(--barynt-color-surface-overlay, var(--barynt-color-surface-raised)); box-shadow: var(--barynt-shadow-overlay);
}
.bui-menu-item {
  display: flex; align-items: center; gap: var(--barynt-space-2); padding: var(--barynt-space-2); border: 0; border-radius: var(--barynt-radius-sm);
  background: none; color: var(--barynt-color-text); font: inherit; font-size: var(--barynt-font-size-sm); text-align: start; cursor: pointer;
}
.bui-menu-item:hover { background: var(--barynt-color-surface-hovered); }
.bui-menu-item[data-danger] { color: var(--barynt-color-danger); }
.bui-copy-button { display: inline-grid; place-items: center; flex: none; width: 1.875rem; height: 1.875rem; border: 0; border-radius: var(--barynt-radius-sm); background: none; color: var(--barynt-color-text-subtle); cursor: pointer; }
.bui-copy-button:hover { background: var(--barynt-color-surface-hovered); color: var(--barynt-color-text); }
.bui-copy-button[data-danger]:hover { color: var(--barynt-color-danger); }
.bui-more-toggle {
  display: flex; align-items: center; justify-content: center; gap: var(--barynt-space-1); padding: var(--barynt-space-1);
  border-radius: var(--barynt-radius-sm); color: var(--barynt-color-tertiary); font-size: var(--barynt-font-size-xs);
  font-weight: var(--barynt-font-weight-medium); list-style: none; cursor: pointer; user-select: none;
}
.bui-more-toggle::-webkit-details-marker { display: none; }
.bui-more-toggle:hover { text-decoration: underline; }
.bui-more-toggle:focus-visible { outline: 2px solid var(--barynt-color-focus); outline-offset: 2px; }
.bui-more-toggle > .bui-icon { transition: rotate var(--barynt-duration-fast); }
.bui-more[open] > .bui-more-toggle > .bui-icon { rotate: 180deg; }
.bui-more-body { display: flex; flex-direction: column; gap: var(--barynt-space-2); padding-top: var(--barynt-space-2); }
.bui-section-title[data-fit] { flex: 0 1 auto; }
.bui-section-count {
  display: inline-flex; flex: none; align-items: center; height: 1.125rem; margin-right: auto; padding: 0 0.375rem;
  border: 1px solid var(--barynt-color-border); border-radius: var(--barynt-radius-pill); background: var(--barynt-color-surface-raised);
  color: var(--barynt-color-text-subtle); font-family: var(--barynt-font-family-mono); font-size: var(--barynt-font-size-xs); line-height: 1;
}
.bui-section-actions { display: inline-flex; flex: none; align-items: center; gap: var(--barynt-space-1); margin-left: auto; }
.bui-section-title + .bui-more-toggle {
  display: flex; align-items: center; justify-content: center; gap: var(--barynt-space-1); padding: var(--barynt-space-1);
  border-radius: var(--barynt-radius-sm); color: var(--barynt-color-tertiary); font-size: var(--barynt-font-size-xs);
  font-weight: var(--barynt-font-weight-medium); list-style: none; cursor: pointer; user-select: none;
}
.bui-more-toggle::-webkit-details-marker { display: none; }
.bui-more-toggle:hover { text-decoration: underline; }
.bui-more-toggle:focus-visible { outline: 2px solid var(--barynt-color-focus); outline-offset: 2px; }
.bui-more-toggle > .bui-icon { transition: rotate var(--barynt-duration-fast); }
.bui-more[open] > .bui-more-toggle > .bui-icon { rotate: 180deg; }
.bui-more-body { display: flex; flex-direction: column; gap: var(--barynt-space-2); padding-top: var(--barynt-space-2); }
.bui-section-title[data-fit] { flex: 0 1 auto; }
.bui-section-count {
  display: inline-flex; flex: none; align-items: center; height: 1.125rem; margin-right: auto; padding: 0 0.375rem;
  border: 1px solid var(--barynt-color-border); border-radius: var(--barynt-radius-pill); background: var(--barynt-color-surface-raised);
  color: var(--barynt-color-text-subtle); font-family: var(--barynt-font-family-mono); font-size: var(--barynt-font-size-xs); line-height: 1;
}
.bui-section-actions { margin-left: 0; }

.bui-steps { display: flex; flex-direction: column; gap: var(--barynt-space-2); margin: 0; padding: 0; list-style: none; }
.bui-step { display: flex; align-items: center; gap: var(--barynt-space-2); font-size: var(--barynt-font-size-base); }
.bui-step-mark { display: inline-grid; place-items: center; color: var(--barynt-color-text-subtle); }
.bui-step-mark[data-state="success"] { color: var(--barynt-color-success); }
.bui-step-mark[data-state="danger"] { color: var(--barynt-color-danger); }
.bui-step-mark[data-state="warning"] { color: var(--barynt-color-warning); }
.bui-step-mark[data-state="running"] { color: var(--barynt-color-primary); }
.bui-step-mark[data-state="running"] .bui-icon { animation: bui-spin 0.8s linear infinite; }
.bui-step-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bui-step-meta { color: var(--barynt-color-text-subtle); font-family: var(--barynt-font-family-mono); font-size: var(--barynt-font-size-sm); }

.bui-nav { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.bui-nav-item {
  display: flex; align-items: center; gap: var(--barynt-space-3); width: 100%; min-height: var(--barynt-size-control);
  padding: 0 var(--barynt-space-1); border: 0; border-radius: var(--barynt-radius-sm); background: none;
  color: var(--barynt-color-text); font: inherit; font-size: var(--barynt-font-size-base); text-align: start; text-decoration: none; cursor: pointer;
}
.bui-nav-item > .bui-icon:first-child { color: var(--barynt-color-text-subtle); }
.bui-nav-item > .bui-icon:last-child { margin-left: auto; color: var(--barynt-color-text-subtle); }
.bui-nav-item:hover:not(:disabled) { background: var(--barynt-color-surface-hovered); }
.bui-nav-item:disabled { cursor: default; }
.bui-nav-count { min-width: 1.25rem; font-variant-numeric: tabular-nums; }
.bui-nav-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.bui-diff { display: inline-flex; gap: var(--barynt-space-2); font-family: var(--barynt-font-family-mono); font-size: var(--barynt-font-size-sm); }
.bui-diff-added { color: var(--barynt-color-success); }
.bui-diff-removed { color: var(--barynt-color-danger); }

:is(.bui-copy-button, .bui-nav-item):focus-visible { outline: 2px solid var(--barynt-color-focus); outline-offset: 2px; }

@media (pointer: coarse) {
  .bui-input, .bui-select, .bui-button, .bui-segment, .bui-chip-toggle { min-height: var(--barynt-size-touch); }
}
`;
