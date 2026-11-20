// src/tokens.ts
var TOKEN_NAMES = [
  "color.surface",
  "color.surface.sunken",
  "color.surface.raised",
  "color.surface.overlay",
  "color.surface.hovered",
  "color.surface.pressed",
  "color.text",
  "color.text.subtle",
  "color.text.inverse",
  "color.border",
  "color.border.strong",
  "color.focus",
  "color.primary",
  "color.primary.text",
  "color.primary.subtle",
  "color.primary.subtle.text",
  "color.secondary",
  "color.secondary.text",
  "color.secondary.subtle",
  "color.secondary.subtle.text",
  "color.danger",
  "color.danger.text",
  "color.danger.subtle",
  "color.danger.subtle.text",
  "color.warning",
  "color.success",
  "color.info",
  "color.blue",
  "color.teal",
  "color.green",
  "color.lime",
  "color.amber",
  "color.orange",
  "color.red",
  "color.purple",
  "color.indigo",
  "color.chart.1",
  "color.chart.2",
  "color.chart.3",
  "color.scrim",
  "font.family",
  "font.family.mono",
  "font.size.xxs",
  "font.size.xs",
  "font.size.sm",
  "font.size.base",
  "font.size.md",
  "font.size.lg",
  "font.size.xl",
  "font.size.2xl",
  "font.weight.regular",
  "font.weight.medium",
  "font.weight.semibold",
  "font.weight.bold",
  "line.height.tight",
  "line.height.normal",
  "line.height.loose",
  "space.0",
  "space.1",
  "space.2",
  "space.3",
  "space.4",
  "space.5",
  "space.6",
  "space.8",
  "space.10",
  "space.12",
  "radius.sm",
  "radius.md",
  "radius.lg",
  "radius.pill",
  "size.control",
  "size.control.sm",
  "size.touch",
  "shadow.card",
  "shadow.overlay",
  "opacity.disabled",
  "duration.fast",
  "duration.normal"
];
function token(name) {
  return `var(${tokenVariable(name)})`;
}
function tokenVariable(name) {
  return `--barynt-${name.replaceAll(".", "-")}`;
}
function tokenValue(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(tokenVariable(name)).trim();
}
function theme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
function onThemeChange(callback) {
  const listener = () => callback(theme());
  window.addEventListener("barynt:themechange", listener);
  return () => window.removeEventListener("barynt:themechange", listener);
}
// src/ui/css.ts
var CSS = `
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

.bui-card[data-compact] { padding: var(--barynt-space-3); gap: var(--barynt-space-2); border-radius: var(--barynt-radius-md); }
.bui-card[data-tone] { border-color: color-mix(in srgb, var(--tone) 55%, transparent); }
.bui-card[data-tone="primary"] { --tone: var(--barynt-color-primary); }
.bui-card[data-tone="info"] { --tone: var(--barynt-color-info); }
.bui-card[data-tone="success"] { --tone: var(--barynt-color-success); }
.bui-card[data-tone="warning"] { --tone: var(--barynt-color-warning); }
.bui-card[data-tone="danger"] { --tone: var(--barynt-color-danger); }

.bui-section-head { display: flex; align-items: center; gap: var(--barynt-space-2); min-width: 0; font-size: var(--barynt-font-size-base); }
.bui-section-head > .bui-icon { color: var(--barynt-color-success); }
.bui-section-title { flex: 1; min-width: 0; font-weight: var(--barynt-font-weight-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bui-section-meta { color: var(--barynt-color-text-subtle); font-family: var(--barynt-font-family-mono); font-size: var(--barynt-font-size-sm); }
.bui-section-status { font-size: var(--barynt-font-size-sm); font-weight: var(--barynt-font-weight-semibold); color: var(--barynt-color-text-subtle); }
.bui-section-status[data-tone="primary"] { color: var(--barynt-color-primary); }
.bui-section-status[data-tone="info"] { color: var(--barynt-color-info); }
.bui-section-status[data-tone="success"] { color: var(--barynt-color-success); }
.bui-section-status[data-tone="warning"] { color: var(--barynt-color-warning); }
.bui-section-status[data-tone="danger"] { color: var(--barynt-color-danger); }

.bui-copy {
  display: flex; align-items: center; gap: var(--barynt-space-2); min-width: 0; min-height: var(--barynt-size-control);
  padding: 0 var(--barynt-space-1) 0 var(--barynt-space-3); border-radius: var(--barynt-radius-md);
  background: var(--barynt-color-surface-raised); color: var(--barynt-color-text-subtle);
}
.bui-copy-value { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--barynt-font-family-mono); font-size: var(--barynt-font-size-sm); color: var(--barynt-color-text); }
.bui-copy-button { display: inline-grid; place-items: center; flex: none; width: 1.875rem; height: 1.875rem; border: 0; border-radius: var(--barynt-radius-sm); background: none; color: var(--barynt-color-text-subtle); cursor: pointer; }
.bui-copy-button:hover { background: var(--barynt-color-surface-hovered); color: var(--barynt-color-text); }

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

// src/ui/core.ts
var STYLE_ID = "barynt-ui";
function styled() {
  if (document.getElementById(STYLE_ID))
    return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
}
function append(parent, children) {
  for (const child of children) {
    if (child === false || child === null || child === undefined)
      continue;
    parent.appendChild(typeof child === "object" ? child : document.createTextNode(String(child)));
  }
}
function el(tag, className, ...children) {
  const node = document.createElement(tag);
  if (className)
    node.className = className;
  append(node, children);
  return node;
}
var lastId = 0;
var nextId = () => `bui-${++lastId}`;
function safeHref(href) {
  try {
    const url = new URL(href);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
var PALETTE = [
  "blue",
  "teal",
  "green",
  "lime",
  "amber",
  "orange",
  "red",
  "purple",
  "indigo"
];
function safeColor(color) {
  if (!color)
    return null;
  if (PALETTE.includes(color))
    return `var(--barynt-color-${color})`;
  if (/^#[0-9a-f]{3,8}$/i.test(color))
    return color;
  if (/^var\(--[a-z0-9-]+\)$/i.test(color))
    return color;
  return null;
}
function fieldShell(options, control, id = nextId()) {
  const wrap = el("div", "bui-field");
  const label = el("label", "bui-label", options.label);
  label.htmlFor = id;
  control.id = id;
  wrap.append(label, control);
  describe(wrap, control, id, options.hint);
  return wrap;
}
function describe(wrap, control, id, hint) {
  if (!hint)
    return;
  const node = el("span", "bui-hint", hint);
  node.id = `${id}-hint`;
  control.setAttribute("aria-describedby", node.id);
  wrap.append(node);
}
// src/ui/icons.ts
var ICONS = {
  check: [["path", { d: "M20 6L9 17l-5-5" }]],
  x: [["path", { d: "M18 6L6 18M6 6l12 12" }]],
  plus: [["path", { d: "M5 12h14m-7-7v14" }]],
  minus: [["path", { d: "M5 12h14" }]],
  "chevron-down": [["path", { d: "m6 9l6 6l6-6" }]],
  "chevron-right": [["path", { d: "m9 18l6-6l-6-6" }]],
  "chevron-left": [["path", { d: "m15 18l-6-6l6-6" }]],
  "chevron-up": [["path", { d: "m18 15l-6-6l-6 6" }]],
  "external-link": [
    [
      "path",
      {
        d: "M15 3h6v6m-11 5L21 3m-3 10v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
      }
    ]
  ],
  "triangle-alert": [
    [
      "path",
      {
        d: "m21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4m0 4h.01"
      }
    ]
  ],
  info: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M12 16v-4m0-4h.01" }]
  ],
  "circle-check": [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "m16 9l-5.5 5.5L8 12" }]
  ],
  "circle-x": [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "m15 9l-6 6m0-6l6 6" }]
  ],
  search: [
    ["path", { d: "m21 21l-4.34-4.34" }],
    ["circle", { cx: "11", cy: "11", r: "8" }]
  ],
  trash: [
    [
      "path",
      {
        d: "M10 11v6m4-6v6m5-11v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
      }
    ]
  ],
  pencil: [
    [
      "path",
      {
        d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497zM15 5l4 4"
      }
    ]
  ],
  "refresh-cw": [
    ["path", { d: "M3 12a9 9 0 0 1 9-9a9.75 9.75 0 0 1 6.74 2.74L21 8" }],
    [
      "path",
      { d: "M21 3v5h-5m5 4a9 9 0 0 1-9 9a9.75 9.75 0 0 1-6.74-2.74L3 16" }
    ],
    ["path", { d: "M8 16H3v5" }]
  ],
  clock: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M12 6v6l4 2" }]
  ],
  user: [
    ["path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" }],
    ["circle", { cx: "12", cy: "7", r: "4" }]
  ],
  users: [
    [
      "path",
      {
        d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3.128a4 4 0 0 1 0 7.744M22 21v-2a4 4 0 0 0-3-3.87"
      }
    ],
    ["circle", { cx: "9", cy: "7", r: "4" }]
  ],
  calendar: [
    ["path", { d: "M8 2v3m8-3v3" }],
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }],
    ["path", { d: "M3 9h18" }]
  ],
  link: [
    [
      "path",
      { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }
    ],
    [
      "path",
      { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }
    ]
  ],
  copy: [
    ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2" }],
    ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" }]
  ],
  ellipsis: [
    ["circle", { cx: "12", cy: "12", r: "1" }],
    ["circle", { cx: "19", cy: "12", r: "1" }],
    ["circle", { cx: "5", cy: "12", r: "1" }]
  ],
  filter: [["path", { d: "M22 3H2l8 9.46V19l4 2v-8.54z" }]],
  star: [
    [
      "path",
      {
        d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.12 2.12 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.12 2.12 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16z"
      }
    ]
  ],
  settings: [
    [
      "path",
      {
        d: "M9.671 4.136a2.34 2.34 0 0 1 4.659 0a2.34 2.34 0 0 0 3.319 1.915a2.34 2.34 0 0 1 2.33 4.033a2.34 2.34 0 0 0 0 3.831a2.34 2.34 0 0 1-2.33 4.033a2.34 2.34 0 0 0-3.319 1.915a2.34 2.34 0 0 1-4.659 0a2.34 2.34 0 0 0-3.32-1.915a2.34 2.34 0 0 1-2.33-4.033a2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"
      }
    ],
    ["circle", { cx: "12", cy: "12", r: "3" }]
  ],
  "git-pull-request": [
    ["circle", { cx: "18", cy: "18", r: "3" }],
    ["circle", { cx: "6", cy: "6", r: "3" }],
    ["path", { d: "M13 6h3a2 2 0 0 1 2 2v7M6 9v12" }]
  ],
  "git-branch": [
    ["path", { d: "M15 6a9 9 0 0 0-9 9V3" }],
    ["circle", { cx: "18", cy: "6", r: "3" }],
    ["circle", { cx: "6", cy: "18", r: "3" }]
  ],
  "message-square": [
    [
      "path",
      {
        d: "M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"
      }
    ]
  ],
  tag: [
    [
      "path",
      {
        d: "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"
      }
    ],
    ["circle", { cx: "7.5", cy: "7.5", r: ".5" }]
  ],
  folder: [
    [
      "path",
      {
        d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
      }
    ]
  ],
  file: [
    [
      "path",
      {
        d: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"
      }
    ],
    ["path", { d: "M14 2v5a1 1 0 0 0 1 1h5" }]
  ],
  bell: [
    [
      "path",
      {
        d: "M10.268 21a2 2 0 0 0 3.464 0m-10.47-5.674A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"
      }
    ]
  ],
  eye: [
    [
      "path",
      {
        d: "M2.062 12.348a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 19.876 0a1 1 0 0 1 0 .696a10.75 10.75 0 0 1-19.876 0"
      }
    ],
    ["circle", { cx: "12", cy: "12", r: "3" }]
  ],
  lock: [
    ["rect", { width: "18", height: "11", x: "3", y: "11", rx: "2", ry: "2" }],
    ["path", { d: "M7 11V7a5 5 0 0 1 10 0v4" }]
  ],
  circle: [["circle", { cx: "12", cy: "12", r: "10" }]],
  "circle-dot": [
    ["circle", { cx: "12", cy: "12", r: "1" }],
    ["circle", { cx: "12", cy: "12", r: "10" }]
  ],
  "arrow-up": [["path", { d: "m5 12l7-7l7 7m-7 7V5" }]],
  "arrow-down": [["path", { d: "M12 5v14m7-7l-7 7l-7-7" }]],
  "arrow-right": [["path", { d: "M5 12h14m-7-7l7 7l-7 7" }]],
  "loader-circle": [["path", { d: "M21 12a9 9 0 1 1-6.219-8.56" }]],
  sparkles: [
    [
      "path",
      {
        d: "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594zM20 2v4m2-2h-4"
      }
    ],
    ["circle", { cx: "4", cy: "20", r: "2" }]
  ],
  zap: [
    [
      "path",
      {
        d: "M15.914 4a1.5 1.5 0 0 0-2.474-1.561l-9 9A1.5 1.5 0 0 0 5.5 14h4.002a.5.5 0 0 1 .471.666L8.086 20a1.5 1.5 0 0 0 2.475 1.56l9-9A1.5 1.5 0 0 0 18.5 10h-3.997a.5.5 0 0 1-.472-.667z"
      }
    ]
  ],
  flag: [
    [
      "path",
      {
        d: "M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"
      }
    ]
  ],
  inbox: [
    ["path", { d: "M22 12h-6l-2 3h-4l-2-3H2" }],
    [
      "path",
      {
        d: "M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11"
      }
    ]
  ],
  "git-commit-horizontal": [
    ["circle", { cx: "12", cy: "12", r: "3" }],
    ["path", { d: "M3 12h6m6 0h6" }]
  ],
  rocket: [
    [
      "path",
      {
        d: "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"
      }
    ],
    [
      "path",
      {
        d: "M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"
      }
    ],
    ["path", { d: "M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05" }]
  ],
  "circle-dashed": [
    [
      "path",
      {
        d: "M10.1 2.182a10 10 0 0 1 3.8 0m0 19.636a10 10 0 0 1-3.8 0m7.509-18.097a10 10 0 0 1 2.69 2.7M2.182 13.9a10 10 0 0 1 0-3.8m18.097 7.509a10 10 0 0 1-2.7 2.69M21.818 10.1a10 10 0 0 1 0 3.8M3.721 6.391a10 10 0 0 1 2.7-2.69m-.03 16.578a10 10 0 0 1-2.69-2.7"
      }
    ]
  ],
  play: [
    [
      "path",
      {
        d: "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"
      }
    ]
  ],
  package: [
    [
      "path",
      {
        d: "M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73zm1 .27V12"
      }
    ],
    ["path", { d: "M3.29 7L12 12l8.71-5M7.5 4.27l9 5.15" }]
  ],
  terminal: [["path", { d: "M12 19h8M4 17l6-6l-6-6" }]]
};

// src/ui/display.ts
var SVG = "http://www.w3.org/2000/svg";
function icon(name, options = {}) {
  styled();
  const size = String(options.size ?? 16);
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "bui-icon");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  if (options.label) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", options.label);
  } else
    svg.setAttribute("aria-hidden", "true");
  for (const [tag, attrs] of ICONS[name] ?? []) {
    const shape = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs))
      shape.setAttribute(k, v);
    svg.append(shape);
  }
  return svg;
}
function heading(options) {
  styled();
  const level = options.level ?? 2;
  const node = el(`h${level}`, "bui-heading", options.text);
  node.dataset.level = String(level);
  return node;
}
function text(options) {
  styled();
  const node = el(options.inline ? "span" : "p", "bui-text", options.text);
  if (options.tone && options.tone !== "default")
    node.dataset.tone = options.tone;
  if (options.size && options.size !== "sm")
    node.dataset.size = options.size;
  if (options.weight && options.weight !== "regular")
    node.dataset.weight = options.weight;
  if (options.mono)
    node.dataset.mono = "";
  return node;
}
function link(options) {
  styled();
  const href = safeHref(options.href);
  if (!href)
    return el("span", "bui-text", options.text);
  const a = el("a", "bui-link", options.text);
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}
function stack(...children) {
  styled();
  return el("div", "bui-stack", ...children);
}
function row(...children) {
  styled();
  return el("div", "bui-row", ...children);
}
function grid(options) {
  styled();
  const node = el("div", "bui-grid", ...options.children);
  if (options.minWidth && /^\d+(\.\d+)?(rem|px|em|%)$/.test(options.minWidth))
    node.style.setProperty("--bui-min", options.minWidth);
  return node;
}
function divider() {
  styled();
  return el("hr", "bui-divider");
}
function card(options) {
  styled();
  const node = el("section", "bui-card");
  if (options.tone && options.tone !== "neutral")
    node.dataset.tone = options.tone;
  if (options.compact)
    node.dataset.compact = "";
  if (options.title || options.actions) {
    const head = el("div", "bui-card-head");
    const titles = el("div");
    if (options.title) {
      const id = nextId();
      const title = el("h3", "bui-card-title", options.title);
      title.id = id;
      node.setAttribute("aria-labelledby", id);
      titles.append(title);
    }
    if (options.description)
      titles.append(el("p", "bui-card-desc", options.description));
    head.append(titles);
    if (options.actions)
      head.append(el("div", "bui-row", ...options.actions));
    node.append(head);
  }
  append(node, options.children ?? []);
  return node;
}
function badge(options) {
  styled();
  const node = el("span", "bui-badge", options.text);
  if (options.tone && options.tone !== "neutral")
    node.dataset.tone = options.tone;
  return node;
}
function tag(options) {
  styled();
  const node = el("span", "bui-tag", options.text);
  const colour = safeColor(options.color);
  if (colour)
    node.style.setProperty("--tag", colour);
  if (options.onRemove) {
    const remove = el("button", "bui-tag-remove", icon("x", { size: 12 }));
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${options.text}`);
    const onRemove = options.onRemove;
    remove.addEventListener("click", () => onRemove());
    node.append(remove);
  }
  return node;
}
function labelChip(options) {
  const node = tag({ text: options.name, color: options.color });
  node.dataset.label = "";
  return node;
}
function avatar(options) {
  styled();
  const initials = options.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
  const node = el("span", "bui-avatar", initials);
  node.setAttribute("aria-hidden", "true");
  const colour = safeColor(options.color);
  if (colour)
    node.style.setProperty("--av", colour);
  if (options.size && options.size !== "md")
    node.dataset.size = options.size;
  return node;
}
function user(options) {
  styled();
  const textBox = el("span", "bui-user-text", el("span", "bui-user-name", options.name));
  if (options.meta)
    textBox.append(el("span", "bui-user-meta", options.meta));
  return el("span", "bui-user", avatar({ name: options.name, color: options.color }), textBox);
}
function statusDot(options) {
  styled();
  const node = el("span", "bui-dot", options.label);
  node.dataset.category = options.category;
  return node;
}
function tooltip(target, text) {
  styled();
  target.dataset.buiTip = text;
  const note = el("span", "bui-sr", text);
  note.id = nextId();
  target.append(note);
  target.setAttribute("aria-describedby", note.id);
  return target;
}
function spinner(options = {}) {
  styled();
  const node = el("span", "bui-spinner", icon("loader-circle", { size: 16 }));
  node.setAttribute("role", "status");
  if (options.label)
    node.append(options.label);
  else
    node.setAttribute("aria-label", "Loading");
  return node;
}
function skeleton(options = {}) {
  styled();
  const node = el("div", "bui-skeleton");
  node.setAttribute("aria-hidden", "true");
  for (let i = 0;i < Math.max(1, Math.min(options.lines ?? 3, 12)); i++)
    node.append(el("span"));
  return node;
}
function emptyState(options) {
  styled();
  return el("div", "bui-empty-state", icon(options.icon ?? "inbox", { size: 28 }), el("strong", undefined, options.title), options.text && el("span", undefined, options.text), options.action);
}
var TONE_ICON = {
  neutral: "info",
  primary: "info",
  info: "info",
  success: "circle-check",
  warning: "triangle-alert",
  danger: "circle-x"
};
function notice(options) {
  styled();
  const tone = options.tone ?? "info";
  const node = el("div", "bui-notice", icon(TONE_ICON[tone], { size: 16 }), el("div", "bui-notice-body", options.title && el("strong", undefined, options.title), el("span", undefined, options.text), options.action));
  node.dataset.tone = tone;
  node.setAttribute("role", tone === "danger" ? "alert" : "status");
  return node;
}
function toast(message, options = {}) {
  styled();
  let host = document.querySelector(".bui-toasts");
  if (!host) {
    host = el("div", "bui-toasts");
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    document.body.append(host);
  }
  const tone = options.tone ?? "neutral";
  const node = el("div", "bui-toast", icon(TONE_ICON[tone], { size: 16 }), message);
  node.dataset.tone = tone;
  host.append(node);
  setTimeout(() => node.remove(), Math.max(1000, options.duration ?? 4000));
}
function status() {
  styled();
  const node = el("p", "bui-status");
  node.setAttribute("role", "status");
  return {
    el: node,
    set(textValue, tone = "info") {
      node.textContent = textValue;
      node.dataset.tone = tone;
    },
    clear() {
      node.textContent = "";
      delete node.dataset.tone;
    }
  };
}
function progressBar(options) {
  styled();
  const max = options.max ?? 100;
  const share = max > 0 ? Math.max(0, Math.min(1, options.value / max)) : 0;
  const percent = `${Math.round(share * 100)}%`;
  const node = el("div", "bui-progress");
  if (options.label)
    node.append(el("div", "bui-progress-head", el("span", undefined, options.label), el("span", undefined, percent)));
  const fill = el("div", "bui-progress-fill");
  fill.style.width = percent;
  if (options.tone && options.tone !== "primary" && options.tone !== "neutral")
    fill.style.setProperty("--tone", `var(--barynt-color-${options.tone === "danger" ? "danger" : options.tone})`);
  const track = el("div", "bui-progress-track", fill);
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", String(max));
  track.setAttribute("aria-valuenow", String(options.value));
  if (options.label)
    track.setAttribute("aria-label", options.label);
  node.append(track);
  return node;
}
function kpi(options) {
  styled();
  const node = el("div", "bui-kpi", el("span", "bui-kpi-value", String(options.value)), el("span", "bui-kpi-label", options.label));
  if (options.trend) {
    const trend = el("span", "bui-kpi-trend", options.trend.text);
    if (options.trend.good !== undefined)
      trend.dataset.good = String(options.trend.good);
    node.append(trend);
  }
  return node;
}
function list(options) {
  styled();
  if (options.items.length === 0)
    return el("p", "bui-empty", options.empty ?? "Nothing here.");
  const node = el("ul", "bui-list");
  for (const item of options.items) {
    const line = el("li", "bui-list-item");
    const href = item.href ? safeHref(item.href) : null;
    if (href) {
      const a = el("a", "bui-list-title", item.title);
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      line.append(a);
    } else
      line.append(el("span", "bui-list-title", item.title));
    if (item.meta)
      line.append(el("span", "bui-list-meta", item.meta));
    node.append(line);
  }
  return node;
}
function barChart(options) {
  styled();
  const node = el("div", "bui-bars");
  const max = options.max ?? Math.max(1, ...options.bars.map((b) => b.value));
  for (const bar of options.bars) {
    const fill = el("span", "bui-bar-fill");
    fill.style.width = `${Math.max(0, Math.min(100, bar.value / max * 100))}%`;
    const colour = safeColor(bar.color);
    if (colour)
      fill.style.setProperty("--bar", colour);
    const line = el("div", "bui-bar", el("span", "bui-bar-label", bar.label), el("span", "bui-bar-track", fill), el("span", "bui-bar-value", String(bar.value)));
    line.setAttribute("aria-label", `${bar.label}: ${bar.value}`);
    node.append(line);
  }
  return node;
}
function progressRing(options) {
  styled();
  const max = options.max ?? 100;
  const share = max > 0 ? Math.max(0, Math.min(1, options.value / max)) : 0;
  const size = options.size ?? 64;
  const stroke = Math.max(4, size / 9);
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("aria-hidden", "true");
  for (const part of ["track", "fill"]) {
    const circle = document.createElementNS(SVG, "circle");
    circle.setAttribute("class", `bui-ring-${part}`);
    circle.setAttribute("cx", String(size / 2));
    circle.setAttribute("cy", String(size / 2));
    circle.setAttribute("r", String(radius));
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke-width", String(stroke));
    if (part === "fill") {
      circle.setAttribute("stroke-linecap", "round");
      circle.setAttribute("stroke-dasharray", String(length));
      circle.setAttribute("stroke-dashoffset", String(length * (1 - share)));
      circle.setAttribute("transform", `rotate(-90 ${size / 2} ${size / 2})`);
    }
    svg.append(circle);
  }
  const percent = `${Math.round(share * 100)}%`;
  const textBox = el("span", "bui-kpi", el("span", "bui-ring-value", percent));
  if (options.label)
    textBox.append(el("span", "bui-ring-label", options.label));
  const node = el("div", "bui-ring");
  node.setAttribute("role", "img");
  node.setAttribute("aria-label", options.label ? `${options.label}: ${percent}` : percent);
  node.append(svg, textBox);
  return node;
}
var STEP_ICON = {
  success: "circle-check",
  danger: "circle-x",
  warning: "triangle-alert",
  running: "loader-circle",
  pending: "circle-dashed"
};
function sectionHeader(options) {
  styled();
  const node = el("div", "bui-section-head", options.icon && icon(options.icon, { size: 16 }), el("span", "bui-section-title", options.title));
  if (options.status) {
    const s = el("span", "bui-section-status", options.status.text);
    s.dataset.tone = options.status.tone ?? "neutral";
    node.append(s);
  } else if (options.meta)
    node.append(el("span", "bui-section-meta", options.meta));
  return node;
}
function copyField(options) {
  styled();
  const node = el("div", "bui-copy", options.icon && icon(options.icon, { size: 15 }), el("span", "bui-copy-value", options.value));
  const copy = el("button", "bui-copy-button", icon("copy", { size: 15 }));
  copy.type = "button";
  copy.setAttribute("aria-label", options.label ?? `Copy ${options.value}`);
  copy.dataset.buiTip = "Copy";
  copy.addEventListener("click", async () => {
    let done = false;
    try {
      await navigator.clipboard.writeText(options.value);
      done = true;
    } catch {
      const area = el("textarea");
      area.value = options.value;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      done = document.execCommand("copy");
      area.remove();
    }
    if (!done)
      return;
    copy.replaceChildren(icon("check", { size: 15 }));
    copy.dataset.buiTip = "Copied";
    setTimeout(() => {
      copy.replaceChildren(icon("copy", { size: 15 }));
      copy.dataset.buiTip = "Copy";
    }, 1500);
  });
  node.append(copy);
  const href = options.href ? safeHref(options.href) : null;
  if (href) {
    const open = el("a", "bui-copy-button", icon("external-link", { size: 15 }));
    open.href = href;
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    open.setAttribute("aria-label", "Open");
    open.dataset.buiTip = "Open";
    node.append(open);
  }
  return node;
}
function stepList(options) {
  styled();
  const node = el("ul", "bui-steps");
  for (const step of options.steps) {
    const mark = el("span", "bui-step-mark", icon(STEP_ICON[step.state], { size: 15 }));
    mark.dataset.state = step.state;
    const item = el("li", "bui-step", mark, el("span", "bui-step-label", step.label), step.meta && el("span", "bui-step-meta", step.meta));
    item.setAttribute("aria-label", `${step.label}: ${step.state}`);
    node.append(item);
  }
  return node;
}
function navList(options) {
  styled();
  const node = el("ul", "bui-nav");
  for (const item of options.items) {
    const href = item.href ? safeHref(item.href) : null;
    const inner = [
      item.icon && icon(item.icon, { size: 16 }),
      item.count !== undefined && el("span", "bui-nav-count", String(item.count)),
      el("span", "bui-nav-label", item.label),
      icon("chevron-right", { size: 16 })
    ];
    let control;
    if (href) {
      const a = el("a", "bui-nav-item", ...inner);
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      control = a;
    } else {
      const b = el("button", "bui-nav-item", ...inner);
      b.type = "button";
      if (item.onClick) {
        const onClick = item.onClick;
        b.addEventListener("click", () => onClick());
      } else
        b.disabled = true;
      control = b;
    }
    node.append(el("li", undefined, control));
  }
  return node;
}
function diffStat(options) {
  styled();
  const node = el("span", "bui-diff", el("span", "bui-diff-added", `+${options.added}`), el("span", "bui-diff-removed", `−${options.removed}`));
  node.setAttribute("aria-label", `${options.added} lines added, ${options.removed} removed`);
  return node;
}

// src/ui/data.ts
function table(options) {
  styled();
  if (options.rows.length === 0)
    return el("p", "bui-empty", options.empty ?? "Nothing here.");
  const t = el("table", "bui-table");
  if (options.caption)
    t.append(el("caption", undefined, options.caption));
  const head = el("tr");
  for (const c of options.columns) {
    const th = el("th", undefined, c.label);
    th.scope = "col";
    if (c.align === "end")
      th.dataset.align = "end";
    head.append(th);
  }
  t.append(el("thead", undefined, head));
  const body = el("tbody");
  for (const r of options.rows) {
    const tr = el("tr");
    for (const c of options.columns) {
      const td = el("td");
      append(td, [r[c.key]]);
      if (c.align === "end")
        td.dataset.align = "end";
      tr.append(td);
    }
    body.append(tr);
  }
  t.append(body);
  return el("div", "bui-table-wrap", t);
}
function keyValue(options) {
  styled();
  const dl = el("dl", "bui-kv");
  for (const item of options.items)
    dl.append(el("dt", undefined, item.label), el("dd", undefined, item.value));
  return dl;
}
function tabs(options) {
  styled();
  const root = el("div", "bui-tabs");
  const listEl = el("div", "bui-tablist");
  listEl.setAttribute("role", "tablist");
  if (options.label)
    listEl.setAttribute("aria-label", options.label);
  const prefix = nextId();
  const drawn = new Set;
  let current = options.value ?? options.tabs[0]?.id ?? "";
  const panels = new Map;
  const buttons = options.tabs.map((tab) => {
    const b = el("button", "bui-tab", tab.label);
    b.type = "button";
    b.id = `${prefix}-tab-${tab.id}`;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-controls", `${prefix}-panel-${tab.id}`);
    b.dataset.tab = tab.id;
    b.addEventListener("click", () => open(tab.id, true));
    listEl.append(b);
    const panel = el("div");
    panel.id = `${prefix}-panel-${tab.id}`;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", b.id);
    panel.tabIndex = 0;
    panels.set(tab.id, panel);
    return b;
  });
  const open = (id, tell) => {
    current = id;
    for (const b of buttons) {
      const on = b.dataset.tab === id;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    }
    for (const tab of options.tabs) {
      const panel = panels.get(tab.id);
      if (!panel)
        continue;
      panel.hidden = tab.id !== id;
      if (tab.id === id && !drawn.has(id)) {
        drawn.add(id);
        append(panel, [
          typeof tab.content === "function" ? tab.content() : tab.content
        ]);
      }
    }
    if (tell)
      options.onChange?.(id);
  };
  listEl.addEventListener("keydown", (event) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step)
      return;
    event.preventDefault();
    const i = buttons.findIndex((b) => b.dataset.tab === current);
    const next = buttons[(i + step + buttons.length) % buttons.length];
    open(next.dataset.tab ?? "", true);
    next.focus();
  });
  root.append(listEl, ...panels.values());
  open(current, false);
  return root;
}
function accordion(options) {
  styled();
  const root = el("div", "bui-accordion");
  for (const item of options.items) {
    const details = el("details", undefined, el("summary", undefined, icon("chevron-right", { size: 14 }), item.title), el("div", "bui-accordion-body", item.content));
    details.open = item.open ?? false;
    root.append(details);
  }
  return root;
}
// src/ui/inputs.ts
function fieldOf(wrap, get, set, controls) {
  return {
    el: wrap,
    get value() {
      return get();
    },
    set value(v) {
      set(v);
    },
    get disabled() {
      return controls()[0]?.disabled ?? false;
    },
    set disabled(v) {
      for (const c of controls())
        c.disabled = v;
    },
    focus: () => controls()[0]?.focus()
  };
}
function textControl(control, options) {
  styled();
  control.value = options.value ?? "";
  if (options.onInput) {
    const onInput = options.onInput;
    control.addEventListener("input", () => onInput(control.value));
  }
  return fieldOf(fieldShell(options, control), () => control.value, (v) => {
    control.value = v;
  }, () => [control]);
}
function textField(options) {
  const input = el("input", "bui-input");
  input.type = options.type ?? "text";
  if (options.placeholder)
    input.placeholder = options.placeholder;
  if (options.onEnter) {
    const onEnter = options.onEnter;
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        onEnter();
      }
    });
  }
  return textControl(input, options);
}
function textArea(options) {
  const area = el("textarea", "bui-textarea");
  area.rows = options.rows ?? 4;
  if (options.placeholder)
    area.placeholder = options.placeholder;
  return textControl(area, options);
}
function dateField(options) {
  const input = el("input", "bui-input");
  input.type = "date";
  if (options.min)
    input.min = options.min;
  if (options.max)
    input.max = options.max;
  if (options.onChange) {
    const onChange = options.onChange;
    input.addEventListener("change", () => onChange(input.value));
  }
  return textControl(input, options);
}
function select(options) {
  styled();
  const control = el("select", "bui-select");
  for (const option of options.options) {
    const node = el("option", undefined, option.label);
    node.value = option.value;
    control.append(node);
  }
  if (options.value !== undefined)
    control.value = options.value;
  if (options.onChange) {
    const onChange = options.onChange;
    control.addEventListener("change", () => onChange(control.value));
  }
  return fieldOf(fieldShell(options, control), () => control.value, (v) => {
    control.value = v;
  }, () => [control]);
}
function toggle(options) {
  styled();
  const id = nextId();
  const wrap = el("div", "bui-switch");
  const text = el("span", "bui-switch-text");
  const label = el("label", "bui-label", options.label);
  label.htmlFor = id;
  text.append(label);
  const button = el("button", "bui-toggle");
  button.type = "button";
  button.id = id;
  button.setAttribute("role", "switch");
  let checked = options.checked ?? false;
  const show = () => button.setAttribute("aria-checked", String(checked));
  show();
  describe(text, button, id, options.hint);
  button.addEventListener("click", () => {
    checked = !checked;
    show();
    options.onChange?.(checked);
  });
  wrap.append(text, button);
  return fieldOf(wrap, () => checked, (v) => {
    checked = v;
    show();
  }, () => [button]);
}
function checkbox(options) {
  styled();
  const id = nextId();
  const wrap = el("label", "bui-check");
  const input = el("input");
  input.type = "checkbox";
  input.id = id;
  input.checked = options.checked ?? false;
  const text = el("span", "bui-check-text", options.label);
  wrap.append(input, text);
  describe(text, input, id, options.hint);
  if (options.onChange) {
    const onChange = options.onChange;
    input.addEventListener("change", () => onChange(input.checked));
  }
  return fieldOf(wrap, () => input.checked, (v) => {
    input.checked = v;
  }, () => [input]);
}
function group(options, inner) {
  const wrap = el("fieldset", "bui-field");
  wrap.append(el("legend", "bui-label", options.label), inner);
  if (options.hint)
    wrap.append(el("span", "bui-hint", options.hint));
  return wrap;
}
function radioGroup(options) {
  styled();
  const name = nextId();
  const list = el("div", "bui-options");
  const inputs = options.options.map((option) => {
    const row = el("label", "bui-check");
    const input = el("input");
    input.type = "radio";
    input.name = name;
    input.value = option.value;
    input.checked = option.value === options.value;
    const text = el("span", "bui-check-text", option.label);
    if (option.hint)
      text.append(el("span", "bui-hint", option.hint));
    row.append(input, text);
    list.append(row);
    input.addEventListener("change", () => {
      if (input.checked)
        options.onChange?.(input.value);
    });
    return input;
  });
  return fieldOf(group(options, list), () => inputs.find((i) => i.checked)?.value ?? "", (v) => {
    for (const i of inputs)
      i.checked = i.value === v;
  }, () => inputs);
}
function segmentedControl(options) {
  styled();
  const bar = el("div", "bui-segments");
  bar.setAttribute("role", "radiogroup");
  bar.setAttribute("aria-label", options.label);
  let value = options.value ?? options.options[0]?.value ?? "";
  const buttons = options.options.map((option) => {
    const b = el("button", "bui-segment", option.label);
    b.type = "button";
    b.setAttribute("role", "radio");
    b.dataset.value = option.value;
    b.addEventListener("click", () => choose(option.value, true));
    bar.append(b);
    return b;
  });
  const show = () => {
    for (const b of buttons) {
      const on = b.dataset.value === value;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    }
  };
  const choose = (v, tell) => {
    value = v;
    show();
    if (tell)
      options.onChange?.(v);
  };
  bar.addEventListener("keydown", (event) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step)
      return;
    event.preventDefault();
    const i = buttons.findIndex((b) => b.dataset.value === value);
    const next = buttons[(i + step + buttons.length) % buttons.length];
    choose(next.dataset.value ?? "", true);
    next.focus();
  });
  show();
  const wrap = el("div", "bui-field");
  wrap.append(el("span", "bui-label", options.label), bar);
  if (options.hint)
    wrap.append(el("span", "bui-hint", options.hint));
  return fieldOf(wrap, () => value, (v) => choose(v, false), () => buttons);
}
function multiSelect(options) {
  styled();
  let chosen = [...options.value ?? []];
  const chips = el("div", "bui-chips");
  const buttons = options.options.map((option) => {
    const b = el("button", "bui-chip-toggle", icon("check", { size: 13 }), option.label);
    b.type = "button";
    b.dataset.value = option.value;
    b.addEventListener("click", () => {
      chosen = chosen.includes(option.value) ? chosen.filter((v) => v !== option.value) : [...chosen, option.value];
      show();
      options.onChange?.([...chosen]);
    });
    chips.append(b);
    return b;
  });
  const show = () => {
    for (const b of buttons)
      b.setAttribute("aria-pressed", String(chosen.includes(b.dataset.value ?? "")));
  };
  show();
  return fieldOf(group(options, chips), () => [...chosen], (v) => {
    chosen = [...v];
    show();
  }, () => buttons);
}
function swatchPicker(options) {
  styled();
  const colors = options.colors ?? PALETTE;
  let value = options.value ?? "";
  const list = el("div", "bui-swatches");
  list.setAttribute("role", "radiogroup");
  list.setAttribute("aria-label", options.label);
  const buttons = colors.map((color) => {
    const b = el("button", "bui-swatch");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-label", color);
    b.dataset.color = color;
    b.style.setProperty("--swatch", safeColor(color) ?? "");
    b.addEventListener("click", () => {
      value = color;
      show();
      options.onChange?.(color);
    });
    list.append(b);
    return b;
  });
  const show = () => {
    for (const b of buttons) {
      b.setAttribute("aria-checked", String(b.dataset.color === value));
      b.tabIndex = b.dataset.color === value || !value && b === buttons[0] ? 0 : -1;
    }
  };
  show();
  const wrap = el("div", "bui-field");
  wrap.append(el("span", "bui-label", options.label), list);
  if (options.hint)
    wrap.append(el("span", "bui-hint", options.hint));
  return fieldOf(wrap, () => value, (v) => {
    value = v;
    show();
  }, () => buttons);
}
function button(options) {
  styled();
  const node = el("button", "bui-button");
  if (options.icon)
    node.append(icon(options.icon, { size: 15 }));
  if (options.iconOnly && options.icon) {
    node.setAttribute("aria-label", options.label);
    node.dataset.buiTip = options.label;
    node.dataset.iconOnly = "";
  } else
    node.append(options.label);
  node.type = "button";
  node.dataset.variant = options.variant ?? "secondary";
  if (options.size === "sm")
    node.dataset.size = "sm";
  if (options.onClick) {
    const onClick = options.onClick;
    node.addEventListener("click", async () => {
      if (node.disabled)
        return;
      const running = onClick();
      if (!(running instanceof Promise))
        return;
      node.disabled = true;
      node.setAttribute("aria-busy", "true");
      try {
        await running;
      } finally {
        node.disabled = false;
        node.removeAttribute("aria-busy");
      }
    });
  }
  return node;
}
// src/ui/overlay.ts
function dialog(options) {
  styled();
  const id = nextId();
  const node = el("dialog", "bui-dialog");
  node.setAttribute("aria-labelledby", id);
  const title = el("h2", "bui-dialog-title", options.title);
  title.id = id;
  const close = button({
    label: "Close",
    variant: "ghost",
    size: "sm",
    icon: "x",
    iconOnly: true,
    onClick: () => node.close()
  });
  node.append(el("div", "bui-dialog-head", title, close));
  const body = el("div", "bui-dialog-body");
  append(body, options.content ?? []);
  node.append(body);
  if (options.actions?.length)
    node.append(el("div", "bui-dialog-foot", ...options.actions));
  node.addEventListener("close", () => {
    options.onClose?.();
    node.remove();
  });
  return {
    el: node,
    open() {
      if (!node.isConnected)
        document.body.append(node);
      node.showModal();
    },
    close: () => node.close()
  };
}
function confirm(options) {
  return new Promise((resolve) => {
    let answer = false;
    const d = dialog({
      title: options.title,
      content: options.text ? [options.text] : [],
      actions: [
        button({
          label: options.cancelLabel ?? "Cancel",
          variant: "secondary",
          onClick: () => d.close()
        }),
        button({
          label: options.confirmLabel ?? "OK",
          variant: options.danger ? "danger" : "primary",
          onClick: () => {
            answer = true;
            d.close();
          }
        })
      ],
      onClose: () => resolve(answer)
    });
    d.open();
  });
}
export {
  ICONS,
  PALETTE,
  accordion,
  avatar,
  badge,
  barChart,
  button,
  card,
  checkbox,
  confirm,
  copyField,
  dateField,
  dialog,
  diffStat,
  divider,
  emptyState,
  grid,
  heading,
  icon,
  keyValue,
  kpi,
  labelChip,
  link,
  list,
  multiSelect,
  navList,
  notice,
  onThemeChange,
  progressBar,
  progressRing,
  radioGroup,
  row,
  sectionHeader,
  segmentedControl,
  select,
  skeleton,
  spinner,
  stack,
  status,
  statusDot,
  stepList,
  swatchPicker,
  table,
  tabs,
  tag,
  text,
  textArea,
  textField,
  theme,
  toast,
  toggle,
  token,
  tokenValue,
  tokenVariable,
  tooltip,
  user
};
