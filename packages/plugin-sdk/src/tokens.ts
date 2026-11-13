// Design tokens (BARY-206): Barynt's colours, sizes and spaces under stable
// names, light or dark as Barynt is, live. Use them in your CSS as
// `var(--barynt-color-text)`, or from code with `token("color.text")`.
// Barynt sets them on the frame; the names here are the same list
// (`lib/plugins/tokens.ts` in Barynt, checked by a test).

export const TOKEN_NAMES = [
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
  "duration.normal",
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];

/** A token as CSS: `token("color.text")` → `"var(--barynt-color-text)"`.
 *  For inline styles and anything else that takes CSS. */
export function token(name: TokenName): string {
  return `var(${tokenVariable(name)})`;
}

/** A token's CSS variable: `--barynt-color-text`. */
export function tokenVariable(name: TokenName): string {
  return `--barynt-${name.replaceAll(".", "-")}`;
}

/** A token's value right now, e.g. `"rgb(225 227 228)"` — for a canvas or
 *  a chart library that wants a colour, not a variable. Read it again after
 *  `onThemeChange`. */
export function tokenValue(name: TokenName): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(tokenVariable(name))
    .trim();
}

/** Whether Barynt is light or dark right now. Also on `<html data-theme>`
 *  for your CSS: `[data-theme="dark"] .chart { … }`. */
export function theme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Runs `callback` when Barynt switches between light and dark; returns
 *  what stops it (`this.register(onThemeChange(…))` in a plugin). */
export function onThemeChange(
  callback: (theme: "light" | "dark") => void,
): () => void {
  const listener = () => callback(theme());
  window.addEventListener("barynt:themechange", listener);
  return () => window.removeEventListener("barynt:themechange", listener);
}
