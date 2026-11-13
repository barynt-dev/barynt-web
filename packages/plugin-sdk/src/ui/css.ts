// The UI kit's styles (BARY-204, BARY-206), all from Barynt's design tokens
// (`--barynt-*`), so they follow light and dark like Barynt does. Put into
// the frame once, by the first component used.

export const CSS = `
.bui-stack { display: flex; flex-direction: column; gap: var(--barynt-space-4); min-width: 0; }
.bui-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--barynt-space-2); min-width: 0; }
.bui-grid { display: grid; gap: var(--barynt-space-4); grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--bui-min, 12rem)), 1fr)); }
.bui-divider { width: 100%; height: 1px; margin: 0; border: 0; background: var(--barynt-color-border); }
.bui-card {
  display: flex; flex-direction: column; gap: var(--barynt-space-3); padding: var(--barynt-space-4);
  border: 1px solid var(--barynt-color-border); border-radius: var(--barynt-radius-lg);
  background: var(--barynt-color-surface-raised); min-width: 0;
}
.bui-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--barynt-space-3); }
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

:is(.bui-input, .bui-button, .bui-toggle, .bui-select, .bui-segment, .bui-chip-toggle, .bui-swatch, .bui-tab, .bui-link, .bui-tag-remove, .bui-accordion summary):focus-visible {
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
[data-bui-tip]::after {
  content: attr(data-bui-tip); position: absolute; z-index: 5; left: 50%; bottom: calc(100% + 6px); transform: translateX(-50%);
  width: max-content; max-width: 16rem; padding: 0.3125rem 0.5rem; border-radius: var(--barynt-radius-sm);
  background: var(--barynt-color-surface-pressed); color: var(--barynt-color-text); box-shadow: var(--barynt-shadow-overlay);
  font-size: var(--barynt-font-size-xs); font-weight: var(--barynt-font-weight-medium); line-height: var(--barynt-line-height-tight);
  white-space: normal; pointer-events: none; opacity: 0; transition: opacity var(--barynt-duration-fast);
}
[data-bui-tip]:hover::after, [data-bui-tip]:focus-visible::after { opacity: 1; }
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

@media (pointer: coarse) {
  .bui-input, .bui-select, .bui-button, .bui-segment, .bui-chip-toggle { min-height: var(--barynt-size-touch); }
}
`;
