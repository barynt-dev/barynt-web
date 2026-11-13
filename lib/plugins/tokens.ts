// A plugin's design tokens (BARY-206): Barynt's colours, sizes and spaces
// under stable, semantic names — `--barynt-color-text`, `--barynt-space-4`
// — the way VS Code hands webviews `--vscode-*` and Figma `--figma-color-*`.
// Barynt's own variables (`--on-surface` …) may change; these names don't.
//
// Themed tokens point at a host variable, which the host sends into the
// frame (light or dark, live); the rest are fixed values. The SDK has the
// same list of names (`packages/plugin-sdk/src/tokens.ts`, checked by a
// test), so `token("color.text")` autocompletes. No dependencies.

type Token = { host: string } | { value: string };

export const TOKENS = {
  // ── Surfaces, from sunk to raised ──
  "color.surface": { host: "--surface" },
  "color.surface.sunken": { host: "--surface-container-lowest" },
  "color.surface.raised": { host: "--surface-container-low" },
  "color.surface.overlay": { host: "--surface-container" },
  "color.surface.hovered": { host: "--surface-container-high" },
  "color.surface.pressed": { host: "--surface-container-highest" },
  // ── Text ──
  "color.text": { host: "--on-surface" },
  "color.text.subtle": { host: "--on-surface-variant" },
  "color.text.inverse": { host: "--inverse-on-surface" },
  // ── Lines ──
  "color.border": { host: "--outline-variant" },
  "color.border.strong": { host: "--outline" },
  "color.focus": { host: "--tertiary" },
  // ── Roles: the colour, the text on it, a quiet version, its text ──
  "color.primary": { host: "--primary" },
  "color.primary.text": { host: "--on-primary" },
  "color.primary.subtle": { host: "--primary-container" },
  "color.primary.subtle.text": { host: "--on-primary-container" },
  "color.secondary": { host: "--secondary" },
  "color.secondary.text": { host: "--on-secondary" },
  "color.secondary.subtle": { host: "--secondary-container" },
  "color.secondary.subtle.text": { host: "--on-secondary-container" },
  "color.danger": { host: "--error" },
  "color.danger.text": { host: "--on-error" },
  "color.danger.subtle": { host: "--error-container" },
  "color.danger.subtle.text": { host: "--on-error-container" },
  "color.warning": { host: "--warning" },
  "color.success": { host: "--green" },
  "color.info": { host: "--info" },
  // ── The palette — labels, charts, accents ──
  "color.blue": { host: "--blue" },
  "color.teal": { host: "--teal" },
  "color.green": { host: "--green" },
  "color.lime": { host: "--lime" },
  "color.amber": { host: "--amber" },
  "color.orange": { host: "--orange" },
  "color.red": { host: "--red" },
  "color.purple": { host: "--purple" },
  "color.indigo": { host: "--indigo" },
  "color.chart.1": { host: "--chart-1" },
  "color.chart.2": { host: "--chart-2" },
  "color.chart.3": { host: "--chart-3" },
  "color.scrim": { host: "--scrim" },
  // ── Type ──
  "font.family": { host: "--font-ui" },
  "font.family.mono": { host: "--font-mono" },
  "font.size.xxs": { value: "0.625rem" },
  "font.size.xs": { value: "0.6875rem" },
  "font.size.sm": { value: "0.75rem" },
  "font.size.base": { value: "0.875rem" },
  "font.size.md": { value: "0.9375rem" },
  "font.size.lg": { value: "1.125rem" },
  "font.size.xl": { value: "1.25rem" },
  "font.size.2xl": { value: "1.5rem" },
  "font.weight.regular": { value: "400" },
  "font.weight.medium": { value: "500" },
  "font.weight.semibold": { value: "600" },
  "font.weight.bold": { value: "700" },
  "line.height.tight": { value: "1.25" },
  "line.height.normal": { value: "1.45" },
  "line.height.loose": { value: "1.65" },
  // ── Space: a 4px scale ──
  "space.0": { value: "0" },
  "space.1": { value: "0.25rem" },
  "space.2": { value: "0.5rem" },
  "space.3": { value: "0.75rem" },
  "space.4": { value: "1rem" },
  "space.5": { value: "1.25rem" },
  "space.6": { value: "1.5rem" },
  "space.8": { value: "2rem" },
  "space.10": { value: "2.5rem" },
  "space.12": { value: "3rem" },
  // ── Shape and size ──
  "radius.sm": { value: "0.375rem" },
  "radius.md": { value: "0.5rem" },
  "radius.lg": { value: "0.75rem" },
  "radius.pill": { value: "999px" },
  "size.control": { value: "2.25rem" },
  "size.control.sm": { value: "1.875rem" },
  "size.touch": { value: "2.75rem" },
  "shadow.card": { host: "--shadow-card" },
  "shadow.overlay": { host: "--shadow-pop" },
  "opacity.disabled": { value: "0.45" },
  "duration.fast": { value: "120ms" },
  "duration.normal": { value: "200ms" },
} as const satisfies Record<string, Token>;

export type TokenName = keyof typeof TOKENS;
export const TOKEN_NAMES = Object.keys(TOKENS) as TokenName[];

/** A token's CSS variable: `color.text.subtle` → `--barynt-color-text-subtle`. */
export const tokenVar = (name: TokenName) =>
  `--barynt-${name.replaceAll(".", "-")}`;

/**
 * The host variables a frame gets, light or dark as the page has them:
 * the ones the tokens point at, and Barynt's own names plugins could use
 * before there were tokens (BARY-144) — kept so they don't break.
 */
export const HOST_TOKENS: readonly string[] = [
  ...new Set([
    ...Object.values(TOKENS as Record<string, Token>).flatMap((t) =>
      "host" in t ? [t.host] : [],
    ),
    "--radius",
    "--radius-sm",
    "--text-xs",
    "--text-sm",
    "--text-base",
  ]),
];

/** Every token as a CSS variable, for the frame's `:root`. */
export function tokenCss(): string {
  const lines = (Object.entries(TOKENS) as [TokenName, Token][]).map(
    ([name, t]) =>
      `  ${tokenVar(name)}: ${"host" in t ? `var(${t.host})` : t.value};`,
  );
  return `:root {\n${lines.join("\n")}\n}`;
}
