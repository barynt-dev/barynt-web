"use client";

import { useEffect, useState } from "react";
import styles from "./pluginStore.module.scss";

/** How many tile colors there are (`[data-hue]` in the styles). */
const HUES = 8;

/** The color a plugin's id picks (`[data-hue]`), the same everywhere. */
export function tileHue(id: string): number {
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return hash % HUES;
}

/** Where a plugin's logo is served — a 404 without one (BARY-235). */
export const pluginLogoUrl = (id: string) =>
  `/api/plugin-logos/${encodeURIComponent(id)}`;

/**
 * A plugin's mark: its logo, when its installed version brings one
 * (BARY-235) — else its first letter on a color picked from its id, so the
 * same plugin always looks the same. The letter is there from the start;
 * the logo is asked for once mounted and laid over it when it loads.
 */
export function PluginTile({
  id,
  name,
  size = "md",
}: {
  id: string;
  name: string;
  /** `xl`: a plugin page's header, as tall as its name, author and
   *  badges (BARY-237). `hero`: a featured card's, large and glowing in the
   *  plugin's colour. */
  size?: "sm" | "md" | "lg" | "xl" | "hero";
}) {
  const [logo, setLogo] = useState<"asking" | "shown" | "none">("none");
  useEffect(() => setLogo("asking"), []);
  return (
    <span
      className={styles.tile}
      data-hue={tileHue(id)}
      data-size={size}
      data-logo={logo === "shown" || undefined}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
      {logo !== "none" && (
        // biome-ignore lint/performance/noImgElement: a small image Barynt serves itself, not a page's picture to optimize
        <img
          className={styles.tileLogo}
          src={pluginLogoUrl(id)}
          alt=""
          onLoad={() => setLogo("shown")}
          onError={() => setLogo("none")}
        />
      )}
    </span>
  );
}
